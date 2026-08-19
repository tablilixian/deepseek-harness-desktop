import type { ProjectRegistry } from './projects.js';
/**
 * 创建 P3 媒体生成工具集（供 Host 的 `ctx.tools.register` 逐条注册）。
 * @param registry - 项目注册表。
 * @param port - webServer 监听端口，用于拼装产物 URL。
 * @returns 三个 `defineTool` 定义。
 */
export declare function createStudioTools(registry: ProjectRegistry, port: number): import("@deepseek-ai/dsh-tools").ToolDefinition[];
