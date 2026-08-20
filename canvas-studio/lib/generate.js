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
    if (!data.filename)
        throw new Error('参考图上传成功但未返回 filename');
    return data.filename;
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
/**
 * 执行一次生成并落盘。
 * @param registry - 项目注册表（提供 assetsDir）。
 * @param tool - 工具名（image_generate / video_generate / video_composite）。
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
        if (params.imageUrl) {
            const filename = await uploadImage(params.imageUrl, signal);
            mediaUrl = await callDrama(DRAMA_ENDPOINTS.image2image, {
                prompt: params.prompt,
                width: size.width,
                height: size.height,
                image1: filename,
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
        if (!params.imageUrl)
            throw new Error('video_generate 需要提供 imageUrl（参考图）');
        const background = await uploadImage(params.imageUrl, signal);
        mediaUrl = await callDrama(DRAMA_ENDPOINTS.videoMsr, {
            prompt: params.prompt,
            width: size.width,
            height: size.height,
            duration: params.duration ?? 5,
            fps: 30,
            background,
        }, signal);
    }
    else if (tool === 'video_composite') {
        const urls = params.imageUrls ?? [];
        if (urls.length < 1)
            throw new Error('video_composite 需要提供 imageUrls');
        const filenames = await Promise.all(urls.slice(0, 4).map((url) => uploadImage(url, signal)));
        const images = filenames.map((image, index) => ({
            image,
            frame_index: index === filenames.length - 1 ? -1 : index,
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
    if (params.imageUrl !== undefined) {
        const prior = await registry.readCanvas(projectId);
        const source = prior.find((node) => node.url === params.imageUrl);
        if (source !== undefined)
            sourceIds.push(source.id);
    }
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
    };
    await registry.appendCanvasNode(projectId, node);
    const result = { url, width: size.width, height: size.height };
    if (isVideo)
        result.duration = params.duration ?? (tool === 'video_composite' ? 12 : 5);
    return result;
}
