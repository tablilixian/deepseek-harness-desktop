import type { StudioCanvasNode } from '../../contracts/canvas.js';
/** Props for the reference tray. */
export interface ReferenceTrayProps {
    /** 当前项目标记为参考图的图片节点。 */
    nodes: readonly StudioCanvasNode[];
    /** 更新某参考节点的字段（角色/强度/标记）。 */
    onUpdateNode(id: string, updates: Partial<StudioCanvasNode>): void;
    /** 把该节点作为 @ref 引用标记复制到聊天输入框。 */
    onReferenceToChat(node: StudioCanvasNode): void;
}
/**
 * 参考托盘（左侧栏，复用画布作为素材库）：列出所有标记为参考图的图片节点，
 * 每项带缩略图、角色 chip、强度滑块、「引用到对话」与「移除」操作。对应
 * Runway 的参考区 + Midjourney 的钉住参考；节点即画布节点，不另开素材库。
 */
export declare function ReferenceTray(props: ReferenceTrayProps): import("react").JSX.Element | null;
