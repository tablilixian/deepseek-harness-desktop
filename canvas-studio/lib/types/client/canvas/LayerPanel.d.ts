import type { StudioCanvasNode } from '../../contracts/canvas.js';
/** Props for the layer list panel. */
export interface LayerPanelProps {
    nodes: readonly StudioCanvasNode[];
    selectedNodeIds: readonly string[];
    onSelect(id: string, multi: boolean): void;
    onDelete(ids: string[]): void;
    onToggleLock(id: string): void;
    onToggleVisibility(id: string): void;
    onReorder(id: string, direction: 'front' | 'back' | 'forward' | 'backward'): void;
}
/**
 * The layer list: every node as a row with thumbnail/kind, lock and visibility
 * toggles, z-order buttons, and delete. Click selects (ctrl/cmd multi-select);
 * group members indent under their group row. Reference LayerPanel semantics,
 * rendered with the DSH theme tokens.
 */
export declare function LayerPanel(props: LayerPanelProps): import("react").JSX.Element;
