/**
 * P4+ 画布产物捕获：conversationEvents 节点 definition 工厂（纯副作用）。
 *
 * 放在 src/ 顶层（非 src/client/）：Host 侧 tsc 会编译出 lib/asset-capture.js，
 * 供 Node 冒烟测试直连；客户端 bundle（tsdown）也引用同一份源码。本模块**只**
 * 含 dsh-llm 的 type-only 导入（Host 侧编译安全），不引入 dsh-client-runtime
 * 类型 —— 那会把客户端运行时类型图拖进 Host tsc，触发上游 .d.ts 的模块合并
 * 冲突。definition 用本地结构类型描述，注册时由结构兼容匹配框架契约。
 *
 * 接线模型：agent 调用画布三工具后，会话 surface 依次产生 tool/call 与
 * tool/result。客户端注册一个「副作用型」conversationEvents 节点 definition：
 * - match：画布工具的 tool/call（start）；任意画布工具相关的 tool/result
 *   （update）。不再要求 surfaceOp==='append'（重载幂等，重复无害）。
 * - start：记录工具名，并从 tool/call 参数抽取参考图 URL（video_generate /
 *   video_composite 的 imageUrl）；该参考图用于血缘，但血缘真正的写入由 Host
 *   在落盘时完成（见 generate.ts 的 appendCanvasNode）。
 * - update：在选中项目时调用 hooks.reloadCanvas —— 生成产物的节点由 Host 写入
 *   canvas.json（单一真相源），客户端从这里重载，彻底摆脱对「解析会话事件渲染
 *   文本里的 URL」这一脆弱路径的依赖（后端异常 / 渲染差异时不可靠）。
 * - buildViewNode：恒返回 null —— 对话里的工具卡片渲染仍由内置 tool-call
 *   节点负责，本节点不重复渲染。
 */
import type { ContentBlock } from '@deepseek-ai/dsh-llm';
/** 画布媒体工具名 → 产物类型。 */
export declare const STUDIO_TOOL_KINDS: Readonly<Record<string, 'image' | 'video'>>;
/** 判断工具名是否属于画布媒体工具。 */
export declare function isStudioTool(name: string): name is keyof typeof STUDIO_TOOL_KINDS;
/**
 * 从 tool/result 的内容块中抽取托管 URL。
 * Host 的 renderResult 产出形如 `已生成产物: <url> (WxH...)` 的文本块，产物
 * 是完整 http(s) URL，正则可稳定提取。
 */
export declare function extractAssetUrl(blocks: readonly ContentBlock[] | undefined): string | null;
/** 一条被捕获的画布资产（写入 store 前的形态）。 */
export interface StudioCaptureAsset {
    /** 托管产物 URL。 */
    url: string;
    /** 产物类型（image / video）。 */
    kind: 'image' | 'video';
    /** 产生该资产的工具名。 */
    toolName: string;
    /** 对应 tool/call 事件 id（血缘 / 重试锚点）。 */
    runId: string;
    /** 参考图 URL（image_generate 产物的 URL）；用于反向查找源节点做血缘链接。 */
    sourceUrl?: string;
    /** 创建时间（epoch millis）。 */
    createdAt: number;
}
/** definition 与目标项目画布之间的接线点（React 之外调用）。 */
export interface AssetCaptureHooks {
    /**
     * 重新载入某项目的画布节点。生成产物的节点由 Host 在落盘时写入
     * `canvas.json`（单一真相源），此处只触发客户端重载，避免依赖对会话事件
     * 渲染文本的脆弱 URL 解析。
     */
    reloadCanvas(projectId: string): void;
    /** 当前画布绑定的项目 id；未绑定任何项目时返回 null。 */
    getSelectedProjectId(): string | null;
}
/** definition 自身维护的节点状态：记录发起调用的工具名与参考图 URL。 */
export interface AssetCaptureState {
    toolName: string;
    /** 参考图 URL；空串表示无参考图（image_generate）。 */
    sourceUrl: string;
}
/**
 * conversationEvents 契约的本地结构投影（注册时由结构类型兼容自动匹配
 * ConversationNodeDefinition，无需在 Host 侧引入框架类型）。
 */
/** 本 definition 关心的会话事件最小形态（data 在运行时按 type 收窄）。 */
export interface StudioCaptureEvent {
    readonly type: string;
    readonly data: unknown;
    surfaceOp?: unknown;
}
/** match 的返回：本 definition 的事件身份与生命周期角色。 */
export interface StudioCaptureMatchResult {
    readonly id: string;
    readonly role: 'start' | 'update';
}
/** 被本 definition 接受的 start/update 事件（含事件原文，便于读取 data）。 */
export interface StudioCaptureMatch {
    readonly event: StudioCaptureEvent;
    readonly role: 'start' | 'update';
}
/** 本 definition 产出的节点定义（与 ConversationNodeDefinition 结构兼容）。 */
export interface StudioCaptureDefinition {
    readonly kind: string;
    readonly target: string;
    match(event: StudioCaptureEvent): StudioCaptureMatchResult | null;
    start(context: unknown, match: StudioCaptureMatch): AssetCaptureState;
    /**
     * context 参数放宽为 { state: unknown }：注册端（ConversationNodeDefinition<unknown>）
     * 的 update 上下文 state 是 unknown，收窄后在内部使用，保证逆变兼容。
     */
    update(context: {
        state: unknown;
    }, match: StudioCaptureMatch): AssetCaptureState;
    buildViewNode(): null;
}
/**
 * 创建 P4 的 conversationEvents 节点 definition。
 * @param hooks - 与画布 store 的接线（React 之外）。
 * @returns 节点 definition，供 `ctx.conversationEvents.register` 注册。
 */
export declare function createAssetCaptureDefinition(hooks: AssetCaptureHooks): StudioCaptureDefinition;
