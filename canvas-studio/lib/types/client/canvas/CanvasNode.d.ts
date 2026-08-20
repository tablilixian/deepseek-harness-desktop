import type { StudioCanvasNode } from '../../contracts/canvas.js';
/** Props for a single canvas node box. */
export interface CanvasNodeProps {
    node: StudioCanvasNode;
    selected: boolean;
    onPointerDown(event: React.PointerEvent): void;
}
/**
 * One canvas node: an image/video media box or a text annotation box, placed
 * at its canvas-space coordinates. The surface owns pan/zoom/drag; this
 * component is purely presentational and reports pointer-down so the surface
 * can begin a node drag.
 */
export declare function CanvasNode(props: CanvasNodeProps): import("react").JSX.Element;
