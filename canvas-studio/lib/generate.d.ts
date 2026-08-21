import type { ProjectRegistry } from './projects.js';
import type { StudioCanvasOperationType } from './contracts/canvas.js';
/** 一次生成的请求参数（来自客户端工具）。 */
export interface GenerateParams {
    prompt: string;
    aspectRatio?: string;
    /** 已上传到 Drama Backend 的服务器文件名（image_generate 图生图 / video_generate / style_transfer / image2vl / deduction / storyboard_generate 用）。 */
    filename?: string;
    /** 已上传的 Drama Backend 文件名数组（video_composite 用）。 */
    filenames?: string[];
    /** 风格迁移的参考风格图文件名（style_transfer 用，已上传到 Drama Backend）。 */
    styleFilename?: string;
    negativePrompt?: string;
    duration?: number;
    /** 分镜格子数量（storyboard_generate 用，默认 4）。 */
    gridnum?: number;
    /** 是否增强风格迁移效果（style_transfer 用）。 */
    enhance?: boolean;
    /**
     * 节点级重试锚点：设置时把结果写回该已有节点（保留 id/位置/血缘），
     * 而不是追加新节点 —— 重试不产生新边（plan §7.8 标准 2）。
     */
    retryOf?: string;
}
/** 一次生成的产物描述（返回给模型）。 */
export interface GenerateResult {
    url: string;
    width: number;
    height: number;
    duration?: number;
}
/**
 * 将相对 URL 解析为 loopback 绝对 URL（Host 端 fetch 用）。
 * 浏览器端 <img src> 能自动解析同源相对路径，但 Node 原生 fetch 不支持，
 * 而 image_generate 返回的产物 URL 是相对路径（/canvas-studio/assets/...），
 * 后续 video_generate / video_composite 作为参考图传入时必须先补全。
 */
declare function resolveImageUrl(url: string, port: number): string;
/** 上传一张图（本地/远程 URL）到 Drama Backend，返回服务器 filename。 */
declare function uploadImage(sourceUrl: string, signal?: AbortSignal): Promise<string>;
/** 生成工具名 → 画布操作类型（边颜色/标签的语义来源）。 */
export declare function operationTypeOf(tool: string, params: GenerateParams): StudioCanvasOperationType;
/** 把生成参数序列化为 generationPrompt（节点重试时原样重放；retryOf 不入档）。 */
export declare function generationPromptOf(params: GenerateParams): string;
/** 提示词增强：调用 Drama Backend 的 image2promptenhance 接口。 */
export declare function enhancePrompt(prompt: string, signal?: AbortSignal): Promise<string>;
/** 图像分析（VLM）：调用 Drama Backend 的 image2vl 接口，使用已上传的文件名。 */
export declare function analyzeImage(filename: string, prompt: string, systemPrompt: string, signal?: AbortSignal): Promise<string>;
/** 剧情推演：分析当前帧画面，推演下一帧构图，使用已上传的文件名。 */
export declare function deduction(filename: string, analysisPrompt?: string, deductionPrompt?: string, analysisSystemPrompt?: string, deductionSystemPrompt?: string, signal?: AbortSignal): Promise<Record<string, unknown>>;
/**
 * 执行一次生成并落盘。
 * @param registry - 项目注册表（提供 assetsDir）。
 * @param tool - 工具名（image_generate / video_generate / video_composite / style_transfer / storyboard_generate）。
 * @param projectId - 目标项目 id。
 * @param params - 生成参数。
 * @param signal - 取消信号。
 */
export declare function generateAsset(registry: ProjectRegistry, tool: string, projectId: string, params: GenerateParams, signal?: AbortSignal): Promise<GenerateResult>;
export { uploadImage, resolveImageUrl };
