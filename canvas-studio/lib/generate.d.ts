import type { ProjectRegistry } from './projects.js';
/** 一次生成的请求参数（来自客户端工具）。 */
export interface GenerateParams {
    prompt: string;
    aspectRatio?: string;
    imageUrl?: string;
    imageUrls?: string[];
    negativePrompt?: string;
    duration?: number;
}
/** 一次生成的产物描述（返回给模型）。 */
export interface GenerateResult {
    url: string;
    width: number;
    height: number;
    duration?: number;
}
/**
 * 执行一次生成并落盘。
 * @param registry - 项目注册表（提供 assetsDir）。
 * @param port - webServer 监听端口，用于拼装产物 URL。
 * @param tool - 工具名（image_generate / video_generate / video_composite）。
 * @param projectId - 目标项目 id。
 * @param params - 生成参数。
 * @param signal - 取消信号。
 */
export declare function generateAsset(registry: ProjectRegistry, port: number, tool: string, projectId: string, params: GenerateParams, signal?: AbortSignal): Promise<GenerateResult>;
