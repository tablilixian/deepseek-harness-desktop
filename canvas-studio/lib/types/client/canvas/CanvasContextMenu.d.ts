import type { StudioCanvasNode } from '../../contracts/canvas.js';
/** Props for the node context menu. */
export interface CanvasContextMenuProps {
    node: StudioCanvasNode;
    x: number;
    y: number;
    onClose(): void;
    onRename(id: string): void;
    onCopy(id: string): void;
    onDelete(id: string): void;
    onReorder(id: string, direction: 'front' | 'back' | 'forward' | 'backward'): void;
    onToggleLock(id: string): void;
    onToggleVisibility(id: string): void;
    onRetry(id: string): void;
    onSteer(id: string): void;
    onCancel(id: string): void;
    onUngroup(id: string): void;
}
/**
 * The node context menu: edit/order/state actions plus generation actions.
 * Positioned at the cursor; closes on any action or blur.
 */
export declare function CanvasContextMenu(props: CanvasContextMenuProps): import("react").JSX.Element;
