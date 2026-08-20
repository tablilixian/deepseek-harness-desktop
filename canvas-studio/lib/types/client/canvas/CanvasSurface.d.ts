import type { StudioCanvasNode } from '../../contracts/canvas.js';
/** Props for the pannable / zoomable canvas surface. */
export interface CanvasSurfaceProps {
    nodes: readonly StudioCanvasNode[];
    selectedNodeId: string | null;
    /** Select a node (or null to clear, e.g. clicking empty canvas). */
    onSelectNode(id: string | null): void;
    /** Live node move during drag (canvas-space coordinates). */
    onMoveNode(id: string, x: number, y: number): void;
    /** Persist after a drag / pan finishes. */
    onPersist(): void;
    /** When set, center this node in the viewport (timeline / review jump). */
    focusNodeId?: string | null;
}
/**
 * The infinite canvas: a grid background that pans/zooms with content, node
 * boxes placed at their canvas-space coordinates, and the bloodline edge
 * overlay. Background pointer-down pans; node pointer-down begins a node drag;
 * wheel zooms around the cursor. Node coordinates are transformed by the layer
 * so edges and nodes share one coordinate system.
 */
export declare function CanvasSurface(props: CanvasSurfaceProps): import("react").JSX.Element;
