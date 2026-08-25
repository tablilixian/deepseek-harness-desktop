import type { StudioCanvasNode } from '../../contracts/canvas.js';
/** Props for the bottom review/timeline strip. */
export interface CanvasTimelineProps {
    /** 已按有效顺序排好的条目（调用方经 deriveTimelineOrder 派生）。 */
    ordered: readonly StudioCanvasNode[];
    selectedNodeId: string | null;
    /** Select a node from the strip (also used to jump/center it on the surface). */
    onSelect(id: string): void;
    /** P9.1：拖拽重排完成，回调整条的完整 id 顺序（由父级写入 view.timeline）。 */
    onReorder(ids: string[]): void;
}
/**
 * The review strip: every node of the project as a thumbnail chip. Clicking a
 * chip selects the node and (via the parent) centers it on the surface — this
 * is the "回看" entry point. P9.1: chips are drag-reorderable; the resulting
 * order persists via view.timeline and later feeds compose 的 clipIds。
 */
export declare function CanvasTimeline(props: CanvasTimelineProps): import("react").JSX.Element;
