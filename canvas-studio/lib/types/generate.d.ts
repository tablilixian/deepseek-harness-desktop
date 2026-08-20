import type { ProjectRegistry } from './projects.js';
import type { StudioCanvasOperationType } from './contracts/canvas.js';
/** 一次生成的请求参数（来自客户端工具）。 */
export interface GenerateParams {
    prompt: string;
    aspectRatio?: string;
    imageUrl?: string;
    imageUrls?: string[];
    negativePrompt?: string;
    duration?: number;
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
/** 生成工具名 → 画布操作类型（边颜色/标签的语义来源）。 */
export declare function operationTypeOf(tool: string, params: GenerateParams): StudioCanvasOperationType;
/** 把生成参数序列化为 generationPrompt（节点重试时原样重放；retryOf 不入档）。 */
export declare function generationPromptOf(params: GenerateParams): string;
/**
 * 执行一次生成并落盘。
 * @param registry - 项目注册表（提供 assetsDir）。
 * @param tool - 工具名（image_generate / video_generate / video_composite）。
 * @param projectId - 目标项目 id。
 * @param params - 生成参数。
 * @param signal - 取消信号。
 */
export declare function generateAsset(registry: ProjectRegistry, tool: string, projectId: string, params: GenerateParams, signal?: AbortSignal): Promise<GenerateResult>;
