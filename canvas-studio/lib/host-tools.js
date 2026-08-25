/**
 * Canvas Studio P3 媒体生成工具（Host 侧）。
 *
 * `ctx.tools` 是 Host 服务，因此工具定义必须注册在 Host（浏览器客户端没有
 * `tools` 服务，之前在客户端注册正是桌面闪退的根因）。每个工具的 `execute`
 * 从会话工作区解析绑定的项目（`exec.agent.session.header.cwd`，即项目拥有的
 * 目录），再调用 Host 的 `generateAsset` —— 外部 API 调用与落盘都在 Host 完成，
 * 既规避浏览器 CORS，也避免跨进程 HTTP 往返。
 */
import { randomUUID } from 'node:crypto';
import { sep } from 'node:path';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { normalizeWorkflow } from './contracts/project.js';
import { newAssetId } from './config.js';
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
    return resolveProjectId(registry, cwd).then(async (projectId) => {
        // P7 硬门禁：逐步确认模式下，分镜/视频生成必须先经 submit_storyboard_for_approval
        // 获得用户批准（state=executing）。放手跑模式（auto）不受限。门禁只约束 agent 的
        // 工具调用；画布上用户手动发起的节点重试走 /generate 路由，不经此处。
        const workflow = normalizeWorkflow((await registry.getProject(projectId))?.workflow);
        if (GATED_TOOLS.has(tool) && workflow.mode === 'confirm' && workflow.state !== 'executing') {
            throw new Error(workflow.state === 'awaiting_approval'
                ? '分镜表正在等待用户批准（画布上方审批条）。请停止生成，等待用户点击「批准」并在对话中发送「继续」后再执行；不要自行重试。'
                : '当前项目为「逐步确认」模式：请先与用户确认需求（时长/画幅/风格/节奏/受众），再用 submit_storyboard_for_approval 提交分镜表；用户批准前不能调用分镜/视频生成工具（概念图 image_generate 允许）。');
        }
        return generateAsset(registry, tool, projectId, params, signal);
    });
}
/** P7 门禁覆盖的生成类工具：正式流程的入口动作。 */
const GATED_TOOLS = new Set(['storyboard_generate', 'video_generate', 'video_composite']);
/**
 * ask_user_choice 的等待上限（毫秒）：比最长视频超时更宽，到点按推荐项继续。
 */
const QUESTION_WAIT_MS = 600_000;
function sleep(ms) {
    return new Promise((resolve) => { setTimeout(resolve, ms); });
}
/**
 * 创建 P3 媒体生成工具集（供 Host 的 `ctx.tools.register` 逐条注册）。
 * @param registry - 项目注册表。
 * @returns 11 个 `defineTool` 定义：image_generate, upload_image, video_generate,
 *   video_composite, prompt_enhance, image2vl, style_transfer, storyboard_generate, deduction，
 *   P7 的 submit_storyboard_for_approval（分镜表审批门禁）与 ask_user_choice（点选式提问）。
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
                sourceUrls: { type: 'array', description: '本图参考的画布产物 URL 数组（此前工具结果里的 url），用于在画布上画出流程箭头；没有参考图可省略' },
            },
            output: { schema: resultSchema, render: renderResult },
            async execute(args, exec) {
                const a = args;
                return runGeneration(registry, 'image_generate', {
                    prompt: a.prompt,
                    ...(a.aspectRatio !== undefined ? { aspectRatio: a.aspectRatio } : {}),
                    ...(a.filename !== undefined ? { filename: a.filename } : {}),
                    ...(a.negativePrompt !== undefined ? { negativePrompt: a.negativePrompt } : {}),
                    ...(a.sourceUrls !== undefined ? { sourceUrls: a.sourceUrls } : {}),
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
            description: '根据提示词生成视频，统一走 FL2VA 接口，支持两种模式：不传 filename 时为纯文生视频；传入 filename（upload_image 返回的 Drama Backend 文件名）时为「首帧」图生视频。返回视频的托管 URL、尺寸与时长。',
            parameters: {
                prompt: { type: 'string', required: true, description: '生成提示词' },
                filename: { type: 'string', description: '可选：已上传的 Drama Backend 文件名（来自 upload_image 工具），用作视频首帧；不传则为纯文生视频' },
                aspectRatio: { type: 'string', enum: ['16:9', '9:16', '1:1'], description: '宽高比，默认 16:9' },
                duration: { type: 'number', description: '视频时长（秒），默认 5；上限 15，建议 8–10（更长请拆多段）' },
                sourceUrls: { type: 'array', description: '首帧图对应的画布产物 URL（此前工具结果里的 url），用于画布流程箭头' },
            },
            output: { schema: resultSchema, render: renderResult },
            async execute(args, exec) {
                const a = args;
                const params = { prompt: a.prompt, filename: a.filename };
                if (a.aspectRatio !== undefined)
                    params.aspectRatio = a.aspectRatio;
                if (a.duration !== undefined)
                    params.duration = a.duration;
                if (a.sourceUrls !== undefined)
                    params.sourceUrls = a.sourceUrls;
                return runGeneration(registry, 'video_generate', params, exec.signal, exec.agent?.session.header.cwd);
            },
        }),
        defineTool({
            name: 'video_composite',
            description: '将多张参考图合成一段视频。两张图走首尾帧插值（FL2VA，image1 首帧 + image2 尾帧）；三张及以上走多参考图合成（REF2VA，最多 6 张，后端自动排布保持角色/场景一致性）。必须提供 filenames（upload_image 返回的 Drama Backend 文件名数组）。返回合成视频的托管 URL、尺寸与时长。',
            parameters: {
                prompt: { type: 'string', required: true, description: '生成提示词' },
                filenames: { type: 'array', required: true, description: '已上传的 Drama Backend 文件名数组（来自 upload_image 工具，最多 6 张，超出自动采样）' },
                aspectRatio: { type: 'string', enum: ['16:9', '9:16', '1:1'], description: '宽高比，默认 16:9' },
                duration: { type: 'number', description: '视频时长（秒），默认 10；上限 15。两张图走首尾帧插值（fl2va），三张及以上走多参考图合成（ref2va）' },
                sourceUrls: { type: 'array', description: '输入图对应的画布产物 URL 数组（按 filenames 同序），用于画布流程箭头' },
            },
            output: { schema: resultSchema, render: renderResult },
            async execute(args, exec) {
                const a = args;
                const params = { prompt: a.prompt, filenames: a.filenames };
                if (a.aspectRatio !== undefined)
                    params.aspectRatio = a.aspectRatio;
                if (a.duration !== undefined)
                    params.duration = a.duration;
                if (a.sourceUrls !== undefined)
                    params.sourceUrls = a.sourceUrls;
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
        defineTool({
            name: 'submit_storyboard_for_approval',
            description: '把分镜表提交给用户确认。「逐步确认」模式下必须在调用 storyboard_generate / video_generate / video_composite 之前使用：提交后本回合结束，等待用户在画布上方点击「批准」。返回文本会说明下一步；收到批准放行的回复后再开始正式生成。',
            parameters: {
                storyboard: { type: 'string', required: true, description: '完整分镜表 markdown 文本（镜号/景别/镜头运动/时长/画面描述/声音）' },
                summary: { type: 'string', description: '一句话概述（如「8 镜 · 竖屏 · 治愈系」），展示在审批提示里' },
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        text: { type: 'string', description: '提交结果与下一步指引' },
                    },
                },
                render: renderTextResult,
            },
            async execute(args, exec) {
                const a = args;
                const projectId = await resolveProjectId(registry, exec.agent?.session.header.cwd);
                const workflow = normalizeWorkflow((await registry.getProject(projectId))?.workflow);
                if (workflow.mode === 'auto') {
                    if (workflow.state !== 'executing')
                        await registry.updateWorkflow(projectId, { state: 'executing' });
                    return { text: '放手跑模式：分镜表已记录到画布，无需等待批准，直接开始执行生成流程。' };
                }
                await registry.updateWorkflow(projectId, { state: 'awaiting_approval' });
                // 分镜表落为画布文本节点：审批条之外，用户还能在画布上直接看到并修改内容。
                const existing = (await registry.readCanvas(projectId)).nodes;
                const index = existing.length;
                const node = {
                    id: newAssetId(),
                    kind: 'text',
                    title: a.summary ?? '分镜表（待确认）',
                    text: a.storyboard,
                    x: 40 + (index % 4) * 300,
                    y: 40 + Math.floor(index / 4) * 240,
                    width: 360,
                    height: 280,
                    createdAt: Date.now(),
                    toolName: 'submit_storyboard_for_approval',
                    origin: 'agent',
                    sourceIds: [],
                    operationType: 'storyboard',
                };
                await registry.appendCanvasNode(projectId, node);
                return { text: '分镜表已提交并落到画布，本回合到此结束。请等待用户在画布上方点击「批准」并在对话中发送「继续」；未获批准前不要调用任何分镜/视频生成工具。' };
            },
        }),
        defineTool({
            name: 'ask_user_choice',
            description: '向用户提出一道点选题：选项卡片会内联显示在对话区（本工具调用卡片下方），用户点击后选择自动作为本工具结果返回（无需用户打字）。需求澄清阶段必须用本工具逐项提问（一次一个问题），不要用文本列表提问。问题会阻塞到用户作答或超时；超时返回提示时，采用带「推荐」标记的选项继续。',
            parameters: {
                question: { type: 'string', required: true, description: '问题文本（简短一句话）' },
                options: {
                    type: 'array',
                    required: true,
                    description: '候选项数组（2–6 个短标签）；推荐的选项末尾加「（推荐）」',
                },
                allowFreeText: { type: 'boolean', description: 'true 时卡片额外提供自由输入框（适合品牌名等开放要素）' },
            },
            output: {
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        text: { type: 'string', description: '用户的选择 / 超时或取消说明' },
                    },
                },
                render: renderTextResult,
            },
            async execute(args, exec) {
                const a = args;
                const options = Array.isArray(a.options) ? a.options.map(String).filter((option) => option.length > 0) : [];
                if (a.question.trim().length === 0)
                    throw new Error('question 不能为空');
                if (options.length < 2)
                    throw new Error('options 至少需要两个候选项');
                const projectId = await resolveProjectId(registry, exec.agent?.session.header.cwd);
                const pending = {
                    id: randomUUID(),
                    question: a.question.trim(),
                    options,
                    ...(a.allowFreeText === true ? { allowFreeText: true } : {}),
                };
                await registry.setPendingQuestion(projectId, pending);
                try {
                    const deadline = Date.now() + QUESTION_WAIT_MS;
                    while (Date.now() < deadline) {
                        if (exec.signal.aborted)
                            throw exec.signal.reason ?? new DOMException('aborted', 'AbortError');
                        const current = normalizeWorkflow((await registry.getProject(projectId))?.workflow).pendingQuestion;
                        if (current === null || current === undefined) {
                            return { text: '问题已被清除（用户跳过）。请采用推荐项继续，并在回复中说明该要素采用了默认假设。' };
                        }
                        if (current.id === pending.id && typeof current.answer === 'string') {
                            await registry.setPendingQuestion(projectId, null);
                            return { text: `用户的选择：${current.answer}` };
                        }
                        await sleep(1500);
                    }
                    return { text: `用户暂未回答（超过等待上限）。请采用推荐项继续：「${options.find((option) => option.includes('推荐')) ?? options[0]}」，并在回复中说明这是默认假设。` };
                }
                catch (cause) {
                    // 打断 / 出错都要把挂起的问题清掉，避免卡片残留。
                    await registry.setPendingQuestion(projectId, null).catch(() => { });
                    throw cause;
                }
            },
        }),
    ];
}
