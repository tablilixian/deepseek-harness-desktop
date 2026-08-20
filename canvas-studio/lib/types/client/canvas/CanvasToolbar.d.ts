import type { StudioCanvasNodeKind } from '../../contracts/canvas.js';
/** Alignment targets (kept explicit so the loop stays type-safe). */
type AlignTarget = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
/** Manually addable node kinds (media comes from agent generation). */
type ManualNodeKind = Extract<StudioCanvasNodeKind, 'sticky' | 'text' | 'prompt'>;
/** Props for the floating canvas toolbar. */
export interface CanvasToolbarProps {
    canUndo: boolean;
    canRedo: boolean;
    selectedCount: number;
    hasSelection: boolean;
    onUndo(): void;
    onRedo(): void;
    onDelete(): void;
    onGroup(): void;
    onUngroup(): void;
    onAlign(alignment: AlignTarget): void;
    onDistribute(direction: 'horizontal' | 'vertical'): void;
    onAutoArrange(): void;
    onAddNode(kind: ManualNodeKind): void;
}
/**
 * The canvas toolbar: undo/redo, selection editing (delete/group/ungroup/
 * align/distribute), auto-arrange, and manual node creation (sticky/text/
 * prompt). Everything is props-driven — the frame wires the store actions.
 */
export declare function CanvasToolbar(props: CanvasToolbarProps): import("react").JSX.Element;
export {};
