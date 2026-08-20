import type { StudioCanvasNode } from '../../contracts/canvas.js';
/** Props for the minimap overlay (drawn inside the surface, screen-space). */
export interface MinimapProps {
    nodes: readonly StudioCanvasNode[];
    offset: {
        x: number;
        y: number;
    };
    scale: number;
    onSetOffset(offset: {
        x: number;
        y: number;
    }): void;
}
/**
 * Content-fit minimap: every node as a colored rect, the current viewport as
 * a draggable frame. Click/drag jumps the canvas so the viewport centers on
 * the minimap position (reference Minimap behavior).
 */
export declare function Minimap(props: MinimapProps): import("react").JSX.Element;
