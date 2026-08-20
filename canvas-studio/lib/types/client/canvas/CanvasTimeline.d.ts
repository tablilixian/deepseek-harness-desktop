import type { StudioCanvasNode } from '../../contracts/canvas.js';
/** Props for the bottom review/timeline strip. */
export interface CanvasTimelineProps {
    nodes: readonly StudioCanvasNode[];
    selectedNodeId: string | null;
    /** Select a node from the strip (also used to jump/center it on the surface). */
    onSelect(id: string): void;
}
/**
 * The review strip: every node of the project, ordered by creation time, as a
 * thumbnail chip. Clicking a chip selects the node and (via the parent) centers
 * it on the surface — this is the "回看" entry point.
 */
export declare function CanvasTimeline(props: CanvasTimelineProps): import("react").JSX.Element;
