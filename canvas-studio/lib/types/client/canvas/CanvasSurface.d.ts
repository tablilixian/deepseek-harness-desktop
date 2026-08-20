import type { StudioCanvasNode } from '../../contracts/canvas.js';
/** Props for the pannable / zoomable canvas surface. */
export interface CanvasSurfaceProps {
    nodes: readonly StudioCanvasNode[];
    selectedNodeId: string | null;
    selectedNodeIds: readonly string[];
    /** Select a node (or null to clear); `multi` toggles in the multi-select roster. */
    onSelectNode(id: string | null, multi?: boolean): void;
    /** Select all nodes of the project. */
    onSelectAllNodes(): void;
    /** Live node move during drag (canvas-space coordinates). */
    onMoveNode(id: string, x: number, y: number): void;
    /** Live node field update (resize). */
    onUpdateNode(id: string, updates: Partial<StudioCanvasNode>): void;
    /** Snapshot history before a mutation gesture (drag/resize start). */
    onBeginEdit(): void;
    /** Persist after a drag / resize / link / rename ends. */
    onPersist(): void;
    /** Remove nodes (keyboard / context menu). */
    onRemoveNodes(ids: string[]): void;
    onCopy(): void;
    onPaste(): void;
    onUndo(): void;
    onRedo(): void;
    /** Manual bloodline: target node gains the source ids. */
    onLinkLayers(sourceIds: string[], targetId: string): void;
    /** Inline rename commit. */
    onRename(id: string, title: string): void;
    /** Context menu request (rendered by the frame). */
    onContextMenu(node: StudioCanvasNode, clientX: number, clientY: number): void;
    /** When set, center this node in the viewport (timeline / review jump). */
    focusNodeId?: string | null;
}
/**
 * The infinite canvas: a grid background that pans/zooms with content, node
 * boxes placed at their canvas-space coordinates, the bloodline edge overlay,
 * snap alignment guides, a minimap, and corner zoom controls.
 *
 * Interactions follow the reference canvas controls: background pointer-down
 * pans (middle button or Shift+left also pan), wheel without modifiers pans,
 * Ctrl/Cmd+wheel zooms around the cursor, node pointer-down begins a node drag
 * (snap alignment + guides), the node's resize handles begin a resize, and the
 * link handle begins a manual connection drag. Keyboard: Delete removes the
 * selection, Ctrl/Cmd+C/V copy/paste, Ctrl/Cmd+Z / Ctrl+Shift+Z / Ctrl+Y
 * undo/redo, Ctrl/Cmd+A selects all, Escape clears the selection.
 */
export declare function CanvasSurface(props: CanvasSurfaceProps): import("react").JSX.Element;
