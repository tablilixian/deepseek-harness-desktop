/** 画布媒体工具名 → 产物类型。 */
export const STUDIO_TOOL_KINDS = {
    image_generate: 'image',
    video_generate: 'video',
    video_composite: 'video',
};
/** 判断工具名是否属于画布媒体工具。 */
export function isStudioTool(name) {
    return Object.prototype.hasOwnProperty.call(STUDIO_TOOL_KINDS, name);
}
/**
 * 从 tool/result 的内容块中抽取托管 URL。
 * Host 的 renderResult 产出形如 `已生成产物: <url> (WxH...)` 的文本块，产物
 * 是完整 http(s) URL，正则可稳定提取。
 */
export function extractAssetUrl(blocks) {
    if (blocks === undefined)
        return null;
    for (const block of blocks) {
        if (block.type === 'text') {
            const match = /https?:\/\/[^\s)）]+/.exec(block.text);
            if (match !== null)
                return match[0];
        }
    }
    return null;
}
/** 从 tool/call 的 arguments 字段解析出参考图 URL（video 工具的 imageUrl）。 */
function sourceUrlFromArguments(value) {
    if (value === undefined || value === null)
        return undefined;
    let parsed = value;
    if (typeof value === 'string') {
        try {
            parsed = JSON.parse(value);
        }
        catch {
            return undefined;
        }
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
        return undefined;
    const imageUrl = parsed.imageUrl;
    return typeof imageUrl === 'string' && imageUrl.length > 0 ? imageUrl : undefined;
}
/**
 * 创建 P4 的 conversationEvents 节点 definition。
 * @param hooks - 与画布 store 的接线（React 之外）。
 * @returns 节点 definition，供 `ctx.conversationEvents.register` 注册。
 */
export function createAssetCaptureDefinition(hooks) {
    const match = (event) => {
        if (event.type === 'tool/call') {
            const data = event.data;
            if (isStudioTool(data.name))
                return { id: String(data.callId), role: 'start' };
            return null;
        }
        if (event.type === 'tool/result') {
            // 画布工具的任意结果都视为 update（触发画布重载）。不再要求
            // surfaceOp==='append'：重载是幂等操作，compaction 重放 / 崩溃合成
            // 的副本只会重复触发一次无害的本地 reload，不会产生重复节点。
            const source = event.data.message.source;
            return { id: String(source.callId), role: 'update' };
        }
        return null;
    };
    return {
        kind: 'canvas-studio-asset',
        target: 'chat',
        match,
        start: (_context, startMatch) => {
            const data = startMatch.event.data;
            return {
                toolName: data.name,
                sourceUrl: sourceUrlFromArguments(data.arguments) ?? '',
            };
        },
        update: (context, updateMatch) => {
            const state = context.state;
            if (updateMatch.event.type === 'tool/result') {
                // 生成产物的节点由 Host 在落盘时写入 canvas.json；这里只触发画布重载，
                // 让客户端从单一真相源拿到最新节点（含血缘 sourceIds），不再依赖
                // 解析事件渲染文本里的 URL —— 那在后端异常 / 渲染差异时并不可靠。
                const projectId = hooks.getSelectedProjectId();
                if (projectId !== null)
                    hooks.reloadCanvas(projectId);
            }
            return state;
        },
        buildViewNode: () => null,
    };
}
