/**
 * Canvas Studio P3 媒体生成工具（Host 侧）。
 *
 * `ctx.tools` 是 Host 服务，因此工具定义必须注册在 Host（浏览器客户端没有
 * `tools` 服务，之前在客户端注册正是桌面闪退的根因）。每个工具的 `execute`
 * 从会话工作区解析绑定的项目（`exec.agent.session.header.cwd`，即项目拥有的
 * 目录），再调用 Host 的 `generateAsset` —— 外部 API 调用与落盘都在 Host 完成，
 * 既规避浏览器 CORS，也避免跨进程 HTTP 往返。
 */
import { sep } from 'node:path';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { generateAsset, uploadImage, resolveImageUrl, enhancePrompt, analyzeImage, deduction } from './generate.js';
/** 产物结果 schema（工具返回给模型的结构）。 */
const resultSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        url: { type: 'string', description: '产物托管 URL，可在画布中直接引用' },
        width: { type: 'integer', description: '宽度（像素）' },
        height: { type: 'integer', description: '高度（像素）' },
        duration: { type: 'number', description: '视频时长（秒）；图片无此项' },
    },
};
/** 把产物结果渲染成模型可读的文本块。 */
function renderResult(_args, value) {
    const result = value;
    const duration = result.duration !== undefined ? `, ${result.duration}s` : '';
    return [{ type: 'text', text: `已生成产物: ${result.url} (${result.width}x${result.height}${duration})` }];
}
/** 把上传结果渲染成模型可读的文本块。 */
function renderUploadResult(_args, value) {
    const v = value;
    return [{ type: 'text', text: `已上传到 Drama Backend: ${v.filename}` }];
}
/** 把文本结果渲染成模型可读的文本块。 */
function renderTextResult(_args, value) {
    const v = value;
    return [{ type: 'text', text: v.text }];
}
/** 把推演结果渲染成模型可读的文本块。 */
function renderDeductionResult(_args, value) {
    const v = value;
    return [{ type: 'text', text: `画面分析: ${v.analysis}\n\n剧情推演: ${v.deduction}` }];
}
/**
 * 从会话工作区目录解析绑定的 Canvas Studio 项目 id。
 * 项目的工作区目录即 `project.dir`；精确匹配优先，否则取最长前缀匹配
 * （会话 cwd 落在项目目录内的子路径时也能命中）。
 */
async function resolveProjectId(registry, cwd) {
    if (!cwd) {
        throw new Error('当前会话未绑定工作区，请先在左侧打开或创建一个 Canvas Studio 项目');
    }
    const projects = await registry.list();
    let match = null;
    let bestLength = -1;
    for (const project of projects) {
        const dir = project.dir;
        if (dir === cwd || cwd.startsWith(dir + sep)) {
            if (dir.length > bestLength) {
                bestLength = dir.length;
                match = project.id;
            }
        }
    }
    if (match === null) {
        throw new Error('当前会话工作区未绑定任何 Canvas Studio 项目，请先在左侧打开或创建一个项目');
    }
    return match;
}
/** 解析项目后调用 Host 的 generateAsset 执行一次生成。 */
function runGeneration(registry, tool, params, signal, cwd) {
    return resolveProjectId(registry, cwd).then((projectId) => generateAsset(registry, tool, projectId, params, signal));
}
/**
 * 创建 P3 媒体生成工具集（供 Host 的 `ctx.tools.register` 逐条注册）。
 * @param registry - 项目注册表。
 * @returns 9 个 `defineTool` 定义：image_generate, upload_image, video_generate,
 *   video_composite, prompt_enhance, image2vl, style_transfer, storyboard_generate, deduction。
 */
export function createStudioTools(registry, port) {
    return [
        defineTool({
            name: 'image_generate',
            description: '根据提示词生成一张图片。如果传入 filename（upload_image 返回的 Drama Backend 文件名），则基于该参考图进行图生图。返回图片的托管 URL 与尺寸。',
            parameters: {
                prompt: { type: 'string', required: true, description: '生成提示词' },
                aspectRatio: { type: 'string', enum: ['16:9', '9:16', '1:1'], description: '宽高比，默认 16:9' },
                filename: { type: 'string', description: '可选参考图：已上传的 Drama Backend 文件名（来自 upload_image 工具，用于图生图）' },
                negativePrompt: { type: 'string', description: '反向提示词' },
            },
            output: { schema: resultSchema, render: renderResult },
            async execute(args, exec) {
                const a = args;
                return runGeneration(registry, 'image_generate', {
                    prompt: a.prompt,
                    ...(a.aspectRatio !== undefined ? { aspectRatio: a.aspectRatio } : {}),
                    ...(a.filename !== undefined ? { filename: a.filename } : {}),
                    ...(a.negativePrompt !== undefined ? { negativePrompt: a.negativePrompt } : {}),
                }, exec.signal, exec.agent?.session.header.cwd);
            },
        }),
        defineTool({
            name: 'upload_image',
            description: '将图片上传到 Drama Backend 服务器，返回服务器上的文件名。该文件名可直接用于其他工具的 filename 或 filenames 参数。所有需要图片作为输入的工具都必须先使用本工具上传图片，拿到服务器文件名后再传入。',
            parameters: {
                imageUrl: { type: 'string', required: true, description: '图片 URL（通常是 image_generate 的产物 URL）' },
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        filename: { type: 'string', description: 'Drama Backend 服务器上的文件名' },
                    },
                },
                render: renderUploadResult,
            },
            async execute(args, exec) {
                const a = args;
                const sourceUrl = port !== undefined ? resolveImageUrl(a.imageUrl, port) : a.imageUrl;
                const filename = await uploadImage(sourceUrl, exec.signal);
                return { filename };
            },
        }),
        defineTool({
            name: 'video_generate',
            description: '根据提示词与一张参考图生成视频（图生视频）。必须提供 filename（upload_image 返回的 Drama Backend 文件名）。返回视频的托管 URL、尺寸与时长。',
            parameters: {
                prompt: { type: 'string', required: true, description: '生成提示词' },
                filename: { type: 'string', required: true, description: '已上传的 Drama Backend 文件名（来自 upload_image 工具）' },
                aspectRatio: { type: 'string', enum: ['16:9', '9:16', '1:1'], description: '宽高比，默认 16:9' },
                duration: { type: 'number', description: '视频时长（秒），默认 5' },
            },
            output: { schema: resultSchema, render: renderResult },
            async execute(args, exec) {
                const a = args;
                const params = { prompt: a.prompt, filename: a.filename };
                if (a.aspectRatio !== undefined)
                    params.aspectRatio = a.aspectRatio;
                if (a.duration !== undefined)
                    params.duration = a.duration;
                return runGeneration(registry, 'video_generate', params, exec.signal, exec.agent?.session.header.cwd);
            },
        }),
        defineTool({
            name: 'video_composite',
            description: '将多张参考图合成一段视频，首尾帧插值。必须提供 filenames（upload_image 返回的 Drama Backend 文件名数组）。返回合成视频的托管 URL、尺寸与时长。',
            parameters: {
                prompt: { type: 'string', required: true, description: '生成提示词' },
                filenames: { type: 'array', required: true, description: '已上传的 Drama Backend 文件名数组（来自 upload_image 工具）' },
                aspectRatio: { type: 'string', enum: ['16:9', '9:16', '1:1'], description: '宽高比，默认 16:9' },
                duration: { type: 'number', description: '视频时长（秒），默认 12' },
            },
            output: { schema: resultSchema, render: renderResult },
            async execute(args, exec) {
                const a = args;
                const params = { prompt: a.prompt, filenames: a.filenames };
                if (a.aspectRatio !== undefined)
                    params.aspectRatio = a.aspectRatio;
                if (a.duration !== undefined)
                    params.duration = a.duration;
                return runGeneration(registry, 'video_composite', params, exec.signal, exec.agent?.session.header.cwd);
            },
        }),
        defineTool({
            name: 'prompt_enhance',
            description: '增强提示词，使生成的图像/视频质量更高。输入原始提示词，返回更丰富、更详细的描述。',
            parameters: {
                prompt: { type: 'string', required: true, description: '原始提示词' },
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        text: { type: 'string', description: '增强后的提示词' },
                    },
                },
                render: renderTextResult,
            },
            async execute(args, exec) {
                const a = args;
                const text = await enhancePrompt(a.prompt, exec.signal);
                return { text };
            },
        }),
        defineTool({
            name: 'image2vl',
            description: '分析一张图片的内容，返回详细的画面描述。必须提供 filename（upload_image 返回的 Drama Backend 文件名）。可用于分析已生成的图片，为后续视频生成提供参考。',
            parameters: {
                filename: { type: 'string', required: true, description: '已上传的 Drama Backend 文件名（来自 upload_image 工具）' },
                prompt: { type: 'string', required: true, description: '分析提示词，描述需要分析的内容' },
                systemPrompt: { type: 'string', description: '系统提示词，设定分析角色和风格' },
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        text: { type: 'string', description: '画面分析结果' },
                    },
                },
                render: renderTextResult,
            },
            async execute(args, exec) {
                const a = args;
                const text = await analyzeImage(a.filename, a.prompt, a.systemPrompt ?? '你是一个专业的影视镜头分析师。请从电影摄影的角度分析这张画面。', exec.signal);
                return { text };
            },
        }),
        defineTool({
            name: 'style_transfer',
            description: '将一张图片的风格迁移到另一张图片上。必须提供 filename（目标图）和 styleFilename（风格参考图），两者均为 upload_image 返回的 Drama Backend 文件名。返回图片的托管 URL 与尺寸。',
            parameters: {
                filename: { type: 'string', required: true, description: '目标图：已上传的 Drama Backend 文件名（需要改变风格的图片）' },
                styleFilename: { type: 'string', required: true, description: '风格参考图：已上传的 Drama Backend 文件名（提供风格参考的图片）' },
                prompt: { type: 'string', description: '增强提示词，描述期望的风格效果' },
                enhance: { type: 'boolean', description: '是否增强风格迁移效果' },
                aspectRatio: { type: 'string', enum: ['16:9', '9:16', '1:1'], description: '宽高比，默认 16:9' },
            },
            output: { schema: resultSchema, render: renderResult },
            async execute(args, exec) {
                const a = args;
                const params = {
                    prompt: a.prompt ?? '',
                    filename: a.filename,
                    styleFilename: a.styleFilename,
                };
                if (a.enhance !== undefined)
                    params.enhance = a.enhance;
                if (a.aspectRatio !== undefined)
                    params.aspectRatio = a.aspectRatio;
                return runGeneration(registry, 'style_transfer', params, exec.signal, exec.agent?.session.header.cwd);
            },
        }),
        defineTool({
            name: 'storyboard_generate',
            description: '根据文本描述生成分镜图像（格子分镜）。每行描述一个分镜场景。可传入 filename（upload_image 返回的 Drama Backend 文件名）作为参考图。返回图片的托管 URL 与尺寸。',
            parameters: {
                prompt: { type: 'string', required: true, description: '场景描述，每行描述一个分镜场景' },
                gridnum: { type: 'number', description: '分镜格子数量，默认 4' },
                filename: { type: 'string', description: '可选参考图：已上传的 Drama Backend 文件名（来自 upload_image 工具）' },
                aspectRatio: { type: 'string', enum: ['16:9', '9:16', '1:1'], description: '宽高比，默认 16:9' },
            },
            output: { schema: resultSchema, render: renderResult },
            async execute(args, exec) {
                const a = args;
                const params = { prompt: a.prompt };
                if (a.gridnum !== undefined)
                    params.gridnum = a.gridnum;
                if (a.filename !== undefined)
                    params.filename = a.filename;
                if (a.aspectRatio !== undefined)
                    params.aspectRatio = a.aspectRatio;
                return runGeneration(registry, 'storyboard_generate', params, exec.signal, exec.agent?.session.header.cwd);
            },
        }),
        defineTool({
            name: 'deduction',
            description: '剧情推演：基于当前帧画面分析 + 剧情方向，推演下一帧的构图描述和关键要素。必须提供 filename（upload_image 返回的 Drama Backend 文件名）。返回画面分析和推演结果。',
            parameters: {
                filename: { type: 'string', required: true, description: '当前帧图片：已上传的 Drama Backend 文件名（来自 upload_image 工具）' },
                analysisPrompt: { type: 'string', description: 'VLM 画面分析提示词' },
                deductionPrompt: { type: 'string', description: '剧情推演提示词' },
                analysisSystemPrompt: { type: 'string', description: 'VLM 画面分析系统提示词' },
                deductionSystemPrompt: { type: 'string', description: '剧情推演系统提示词' },
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        analysis: { type: 'string', description: '画面分析结果' },
                        deduction: { type: 'string', description: '剧情推演结果' },
                    },
                },
                render: renderDeductionResult,
            },
            async execute(args, exec) {
                const a = args;
                const result = await deduction(a.filename, a.analysisPrompt, a.deductionPrompt, a.analysisSystemPrompt, a.deductionSystemPrompt, exec.signal);
                return {
                    analysis: JSON.stringify(result.analysis ?? ''),
                    deduction: JSON.stringify(result.deduction ?? ''),
                };
            },
        }),
    ];
}
