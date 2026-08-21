/**
 * Canvas Studio P3 媒体生成（Host 侧）。
 *
 * 调用 Drama Backend（参考 WL 适配器），下载产物并落盘到项目 `assets/`，
 * 返回 webServer 托管的 URL。浏览器侧工具经 `/canvas-studio/generate` 路由
 * 调用本模块，规避渲染进程的 CORS 限制。
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DRAMA_API_BASE, DRAMA_ENDPOINTS, newAssetId, sizeForAspectRatio, } from './config.js';
/**
 * 将相对 URL 解析为 loopback 绝对 URL（Host 端 fetch 用）。
 * 浏览器端 <img src> 能自动解析同源相对路径，但 Node 原生 fetch 不支持，
 * 而 image_generate 返回的产物 URL 是相对路径（/canvas-studio/assets/...），
 * 后续 video_generate / video_composite 作为参考图传入时必须先补全。
 */
function resolveImageUrl(url, port) {
    return url.startsWith('/') ? `http://127.0.0.1:${port}${url}` : url;
}
/** 上传一张图（本地/远程 URL）到 Drama Backend，返回服务器 filename。 */
async function uploadImage(sourceUrl, signal) {
    const response = await fetch(sourceUrl, { signal: signal ?? null });
    if (!response.ok)
        throw new Error(`参考图下载失败: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const form = new FormData();
    form.append('file', new Blob([bytes]), 'reference.png');
    const upload = await fetch(`${DRAMA_API_BASE}${DRAMA_ENDPOINTS.uploadimage}`, {
        method: 'POST',
        body: form,
        signal: signal ?? null,
    });
    if (!upload.ok)
        throw new Error(`参考图上传失败: ${upload.status}`);
    const data = await upload.json();
    // 兼容多种响应格式：{ filename } / { name } / { data: { filename } } / { data: { url } }
    const filename = (data.filename
        ?? data.name
        ?? data.data?.filename
        ?? data.data?.url);
    if (!filename)
        throw new Error(`参考图上传成功但未返回 filename（响应: ${JSON.stringify(data)}）`);
    return filename;
}
/** 调用 Drama Backend 生成接口，取回产物 URL。 */
async function callDrama(endpoint, body, signal) {
    const response = await fetch(`${DRAMA_API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: signal ?? null,
    });
    if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
            const data = await response.json();
            message = data.error?.message || data.msg || message;
        }
        catch {
            /* keep default */
        }
        throw new Error(`生成失败: ${message}`);
    }
    const data = await response.json();
    if (data.full_url)
        return data.full_url;
    const imageUrl = data.data?.[0]?.url;
    if (imageUrl)
        return imageUrl;
    throw new Error('生成响应中未找到产物 URL');
}
/** 生成工具名 → 画布操作类型（边颜色/标签的语义来源）。 */
export function operationTypeOf(tool, params) {
    if (tool === 'image_generate')
        return params.filename !== undefined ? 'image-to-image' : 'text-to-image';
    if (tool === 'video_generate')
        return 'image-to-video';
    if (tool === 'video_composite')
        return 'mkr-video';
    if (tool === 'style_transfer')
        return 'style-transfer';
    if (tool === 'storyboard_generate')
        return 'storyboard';
    return 'import';
}
/** 把生成参数序列化为 generationPrompt（节点重试时原样重放；retryOf 不入档）。 */
export function generationPromptOf(params) {
    const { retryOf: _retryOf, ...rest } = params;
    return JSON.stringify(rest);
}
/** 提示词增强：调用 Drama Backend 的 image2promptenhance 接口。 */
export async function enhancePrompt(prompt, signal) {
    const data = await callDramaRaw(DRAMA_ENDPOINTS.promptEnhance, { prompt }, signal);
    return (data.output ?? data.msg ?? data);
}
/** 图像分析（VLM）：调用 Drama Backend 的 image2vl 接口，使用已上传的文件名。 */
export async function analyzeImage(filename, prompt, systemPrompt, signal) {
    const data = await callDramaRaw(DRAMA_ENDPOINTS.image2vl, {
        image: filename,
        prompt,
        system_prompt: systemPrompt,
    }, signal);
    return (data.output ?? data.msg ?? JSON.stringify(data));
}
/** 剧情推演：分析当前帧画面，推演下一帧构图，使用已上传的文件名。 */
export async function deduction(filename, analysisPrompt, deductionPrompt, analysisSystemPrompt, deductionSystemPrompt, signal) {
    const body = { image: filename };
    if (analysisPrompt !== undefined)
        body.analysis_prompt = analysisPrompt;
    if (deductionPrompt !== undefined)
        body.deduction_prompt = deductionPrompt;
    if (analysisSystemPrompt !== undefined)
        body.analysis_system_prompt = analysisSystemPrompt;
    if (deductionSystemPrompt !== undefined)
        body.deduction_system_prompt = deductionSystemPrompt;
    return callDramaRaw(DRAMA_ENDPOINTS.deduction, body, signal);
}
/** 带 raw 响应解析的 callDrama（文本工具用，返回完整 JSON）。 */
async function callDramaRaw(endpoint, body, signal) {
    const response = await fetch(`${DRAMA_API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: signal ?? null,
    });
    if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
            const data = await response.json();
            message = data.error?.message || data.msg || message;
        }
        catch {
            /* keep default */
        }
        throw new Error(`生成失败: ${message}`);
    }
    return response.json();
}
/**
 * 执行一次生成并落盘。
 * @param registry - 项目注册表（提供 assetsDir）。
 * @param tool - 工具名（image_generate / video_generate / video_composite / style_transfer / storyboard_generate）。
 * @param projectId - 目标项目 id。
 * @param params - 生成参数。
 * @param signal - 取消信号。
 */
export async function generateAsset(registry, tool, projectId, params, signal) {
    const projects = await registry.list();
    const project = projects.find((entry) => entry.id === projectId);
    if (!project)
        throw new Error(`项目不存在: ${projectId}`);
    const size = sizeForAspectRatio(params.aspectRatio);
    const isVideo = tool === 'video_generate' || tool === 'video_composite';
    let mediaUrl;
    if (tool === 'image_generate') {
        if (params.filename) {
            mediaUrl = await callDrama(DRAMA_ENDPOINTS.image2image, {
                prompt: params.prompt,
                width: size.width,
                height: size.height,
                image1: params.filename,
                ...(params.negativePrompt ? { negative_prompt: params.negativePrompt } : {}),
            }, signal);
        }
        else {
            mediaUrl = await callDrama(DRAMA_ENDPOINTS.txt2image, {
                prompt: params.prompt,
                width: size.width,
                height: size.height,
                ...(params.negativePrompt ? { negative_prompt: params.negativePrompt } : {}),
            }, signal);
        }
    }
    else if (tool === 'video_generate') {
        if (!params.filename)
            throw new Error('video_generate 需要提供 filename（来自 upload_image 工具）');
        mediaUrl = await callDrama(DRAMA_ENDPOINTS.videoMsr, {
            prompt: params.prompt,
            width: size.width,
            height: size.height,
            duration: params.duration ?? 5,
            fps: 30,
            background: params.filename,
        }, signal);
    }
    else if (tool === 'video_composite') {
        const filenames = params.filenames ?? [];
        if (filenames.length < 1)
            throw new Error('video_composite 需要提供 filenames（来自 upload_image 工具）');
        // frame_index 按时间轴均分：API 期望的是帧位置（duration × fps），不是数组下标。
        // 最后一张图用 -1 标记（文档约定表示结束）。
        const totalFrames = (params.duration ?? 12) * 30;
        const images = filenames.map((image, index) => ({
            image,
            frame_index: index === filenames.length - 1
                ? -1
                : Math.round((index / (filenames.length - 1)) * totalFrames),
        }));
        mediaUrl = await callDrama(DRAMA_ENDPOINTS.videoMkr, {
            prompt: params.prompt,
            width: size.width,
            height: size.height,
            duration: params.duration ?? 12,
            fps: 30,
            images,
        }, signal);
    }
    else if (tool === 'style_transfer') {
        if (!params.filename || !params.styleFilename) {
            throw new Error('style_transfer 需要提供 filename（目标图）和 styleFilename（风格参考图）');
        }
        mediaUrl = await callDrama(DRAMA_ENDPOINTS.styleTransfer, {
            image1: params.filename,
            image2: params.styleFilename,
            ...(params.prompt ? { prompt: params.prompt } : {}),
            ...(params.enhance !== undefined ? { enhance: params.enhance } : {}),
        }, signal);
    }
    else if (tool === 'storyboard_generate') {
        mediaUrl = await callDrama(DRAMA_ENDPOINTS.storyboard, {
            prompt: params.prompt,
            gridnum: params.gridnum ?? 4,
            width: size.width,
            ...(params.filename ? { image: params.filename } : {}),
        }, signal);
    }
    else {
        throw new Error(`未知的生成工具: ${tool}`);
    }
    const download = await fetch(mediaUrl, { signal: signal ?? null });
    if (!download.ok)
        throw new Error(`产物下载失败: ${download.status}`);
    const bytes = Buffer.from(await download.arrayBuffer());
    const assetId = newAssetId();
    const extension = isVideo ? 'mp4' : 'png';
    const filename = `${assetId}.${extension}`;
    const directory = registry.assetsDir(projectId);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, filename), bytes);
    // 同源相对路径：渲染进程与 webServer 同源，相对 URL 自动解析到当前端口，
    // 桌面重启换端口也不失效（此前写死 127.0.0.1:<port> 在端口变化后会 404）。
    const url = `/canvas-studio/assets/${projectId}/${filename}`;
    // Persist a canvas node the moment the asset lands on disk (Host is the
    // source of truth). The client reloads the canvas document on tool/result,
    // so a successful generation shows on the canvas even if the conversation
    // event's rendered text carries no usable URL.
    const sourceIds = [];
    // 节点级重试（params.retryOf）：原地更新已有节点，保留 id/位置/血缘/编组，
    // 边不增加（plan §7.8 标准 2）。普通生成则追加新节点。
    if (params.retryOf !== undefined) {
        const existing = (await registry.readCanvas(projectId)).nodes;
        const target = existing.find((node) => node.id === params.retryOf);
        if (target === undefined) {
            throw new Error(`重试目标节点不存在: ${params.retryOf}`);
        }
        const { error: _staleError, ...targetRest } = target;
        const updated = {
            ...targetRest,
            url,
            width: size.width,
            height: size.height,
            operationType: operationTypeOf(tool, params),
            toolName: tool,
            generationPrompt: generationPromptOf(params),
            ...(isVideo ? { duration: params.duration ?? (tool === 'video_composite' ? 12 : 5) } : {}),
        };
        await registry.writeCanvas(projectId, existing.map((node) => (node.id === target.id ? updated : node)));
    }
    else {
        const node = {
            id: assetId,
            kind: isVideo ? 'video' : 'image',
            url,
            x: 0,
            y: 0,
            width: size.width,
            height: size.height,
            createdAt: Date.now(),
            toolName: tool,
            runId: assetId,
            origin: 'agent',
            sourceIds,
            operationType: operationTypeOf(tool, params),
            generationPrompt: generationPromptOf(params),
            ...(isVideo ? { duration: params.duration ?? (tool === 'video_composite' ? 12 : 5) } : {}),
        };
        await registry.appendCanvasNode(projectId, node);
    }
    const result = { url, width: size.width, height: size.height };
    if (isVideo)
        result.duration = params.duration ?? (tool === 'video_composite' ? 12 : 5);
    return result;
}
// 导出供 host-tools.ts 中 upload_image 工具使用。
export { uploadImage, resolveImageUrl };
