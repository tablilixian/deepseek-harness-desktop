export interface StudioToolsContext {
    /** 返回当前激活项目 id；无激活项目时返回 null。 */
    getActiveProjectId(): string | null;
}
/**
 * 创建 P3 媒体生成工具集。
 * @param context - 提供当前激活项目 id 的读取器。
 * @returns 三个 `defineTool` 定义，供 `ctx.tools.register` 逐条注册。
 */
export declare function createStudioTools(context: StudioToolsContext): import("@deepseek-ai/dsh-tools").ToolDefinition[];
