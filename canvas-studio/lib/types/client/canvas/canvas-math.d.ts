/**
 * Pure canvas math + snap alignment helpers.
 *
 * Ported as concepts from the reference canvas module
 * (`reference/canvas/utils/canvasMath.ts`, `hooks/useSnapAlignment.ts`,
 * design doc §9.5): 5px threshold, six guide kinds (vertical: left/right/
 * center; horizontal: top/bottom/center), optional grid snapping (default
 * 50px). All functions are dependency-free so the surface can call them
 * per pointer-move frame without store round-trips.
 */
import type { StudioCanvasNode } from '../../contracts/canvas.js';
/** Clamp a value into [min, max]. */
export declare function clamp(value: number, min: number, max: number): number;
/** A snap guide line to render while dragging. */
export interface SnapGuide {
    type: 'vertical' | 'horizontal';
    position: number;
}
/** The snapped position plus the guides that fired. */
export interface SnapResult {
    x: number;
    y: number;
    guides: SnapGuide[];
}
/**
 * Snap a dragged node's target position against every other node: left/right/
 * center edges on both axes, with optional grid snapping first.
 */
export declare function calculateSnap(nodes: readonly StudioCanvasNode[], dragged: StudioCanvasNode, targetX: number, targetY: number, options?: {
    gridSnap?: boolean;
    gridSize?: number;
}): SnapResult;
/** Union bounds of nodes (null when empty). */
export declare function contentBounds(nodes: readonly StudioCanvasNode[]): {
    x: number;
    y: number;
    width: number;
    height: number;
} | null;
/** Screen → canvas-space coordinate (inverse of the surface transform). */
export declare function screenToWorld(screenX: number, screenY: number, offsetX: number, offsetY: number, scale: number): {
    x: number;
    y: number;
};
/** Canvas-space → screen coordinate. */
export declare function worldToScreen(worldX: number, worldY: number, offsetX: number, offsetY: number, scale: number): {
    x: number;
    y: number;
};
