import type { StudioCanvasNode } from '../../contracts/canvas.js';
/** Props for the bloodline edge overlay. */
export interface CanvasEdgesProps {
    nodes: readonly StudioCanvasNode[];
    /** Selected node ids (edge highlight when either endpoint is selected). */
    selectedNodeIds: readonly string[];
}
/**
 * Bloodline edges: every node draws a bezier from each of its `sourceIds`
 * sources to its own left edge, colored by the target node's operationType
 * with an arrow marker and a Chinese operation chip at the midpoint (the
 * reference ConnectionLines rendering, adapted to canvas-space coordinates —
 * this SVG sits inside the transformed layer, so no manual offset/scale).
 * There is no separate edge table — edges are derived from the node graph at
 * render time (plan §7.3).
 */
export declare function CanvasEdges(props: CanvasEdgesProps): import("react").JSX.Element;
