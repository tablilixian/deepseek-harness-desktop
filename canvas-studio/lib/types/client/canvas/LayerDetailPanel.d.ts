import type { StudioCanvasNode } from '../../contracts/canvas.js';
/** Props for the layer detail panel. */
export interface LayerDetailPanelProps {
    node: StudioCanvasNode;
    onClose(): void;
    onRename(id: string, title: string): void;
    onSetOpacity(id: string, opacity: number): void;
    onToggleFlip(id: string, axis: 'flipX' | 'flipY'): void;
    onToggleLock(id: string): void;
    onToggleVisibility(id: string, visible: boolean): void;
    onReorder(id: string, direction: 'front' | 'back'): void;
    onDelete(id: string): void;
    /** Node-level retry (agent nodes with generationPrompt). */
    onRetry(id: string): void;
    /** Steer the agent with a new prompt (agent nodes). */
    onSteer(id: string, prompt: string): void;
    /** Cancel the running turn (loading nodes). */
    onCancel(id: string): void;
}
/**
 * The layer detail panel: edit the selected node's title, opacity, flip,
 * lock/visibility, z-order, and run node-level generation actions (retry /
 * steer / cancel). Reference LayerDetailPanel semantics, DSH tokens.
 */
export declare function LayerDetailPanel(props: LayerDetailPanelProps): import("react").JSX.Element;
