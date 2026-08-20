import type { StudioCanvasNode } from '../../contracts/canvas.js';
/** Props for the bloodline edge overlay. */
export interface CanvasEdgesProps {
    nodes: readonly StudioCanvasNode[];
}
/**
 * Bloodline edges: every node draws a bezier from each of its `sourceIds`
 * sources. There is no separate edge table — edges are derived from the node
 * graph at render time (plan §7.3). Coordinates are canvas-space; the parent
 * layer applies the pan/zoom transform, so this SVG only needs overflow-visible.
 */
export declare function CanvasEdges(props: CanvasEdgesProps): import("react").JSX.Element;
