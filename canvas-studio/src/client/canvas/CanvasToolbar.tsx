import type { StudioCanvasNodeKind } from '../../contracts/canvas.js'

/** Manually addable node kinds (media comes from agent generation). */
type ManualNodeKind = Extract<StudioCanvasNodeKind, 'sticky' | 'text' | 'prompt'>

/** Props for the floating canvas toolbar. */
export interface CanvasToolbarProps {
  canUndo: boolean
  canRedo: boolean
  selectedCount: number
  hasSelection: boolean
  onUndo(): void
  onRedo(): void
  onDelete(): void
  onGroup(): void
  onUngroup(): void
  /** One-click overlap-free arrange (the only layout action by design). */
  onAutoArrange(): void
  onAddNode(kind: ManualNodeKind): void
  /** Toggle the layer list overlay inside the canvas. */
  layersOpen: boolean
  onToggleLayers(): void
  /** Current zoom level (percent) shown next to the zoom buttons. */
  scale: number
  onZoomOut(): void
  onZoomIn(): void
  onFitContent(): void
  onResetZoom(): void
  /** Show / hide the minimap overlay. */
  minimapVisible: boolean
  onToggleMinimap(): void
}

/**
 * The canvas toolbar: undo/redo, selection editing (delete/group/ungroup),
 * the one-click arrange, and manual node creation (sticky/text/prompt).
 * Everything is props-driven — the frame wires the store actions.
 */
export function CanvasToolbar(props: CanvasToolbarProps) {
  const { canUndo, canRedo, selectedCount, hasSelection, onUndo, onRedo, onDelete, onGroup, onUngroup, onAutoArrange, onAddNode, layersOpen, onToggleLayers, scale, onZoomOut, onZoomIn, onFitContent, onResetZoom, minimapVisible, onToggleMinimap } = props
  return (
    <div className="csToolbar">
      <div className="csToolbarGroup">
        <button type="button" className="csToolbarButton" disabled={!canUndo} title="撤销 (Ctrl+Z)" onClick={onUndo}>↩ 撤销</button>
        <button type="button" className="csToolbarButton" disabled={!canRedo} title="重做 (Ctrl+Shift+Z)" onClick={onRedo}>↪ 重做</button>
      </div>
      <div className="csToolbarGroup">
        <button type="button" className="csToolbarButton" disabled={!hasSelection} onClick={onDelete}>删除</button>
        <button type="button" className="csToolbarButton" disabled={selectedCount < 2} onClick={onGroup}>编组</button>
        <button type="button" className="csToolbarButton" disabled={selectedCount !== 1} onClick={onUngroup}>解组</button>
      </div>
      <div className="csToolbarGroup">
        <button type="button" className="csToolbarButton" title="整理布局：消除重叠并适配视野" onClick={onAutoArrange}>整理布局</button>
      </div>
      <div className="csToolbarGroup">
        <button type="button" className="csToolbarButton" onClick={() => { onAddNode('sticky') }}>+ 便签</button>
        <button type="button" className="csToolbarButton" onClick={() => { onAddNode('text') }}>+ 文本</button>
        <button type="button" className="csToolbarButton" onClick={() => { onAddNode('prompt') }}>+ 提示</button>
      </div>
      <div className="csToolbarGroup">
        <button type="button" className="csToolbarButton" onClick={onToggleLayers}>
          {layersOpen ? '隐藏图层' : '显示图层'}
        </button>
      </div>
      <div className="csToolbarGroup">
        <span className="csToolbarZoomValue">{Math.round(scale * 100)}%</span>
        <button type="button" className="csToolbarButton" title="缩小" onClick={onZoomOut}>−</button>
        <button type="button" className="csToolbarButton" title="放大" onClick={onZoomIn}>+</button>
        <button type="button" className="csToolbarButton" title="适配内容" onClick={onFitContent}>⤢</button>
        <button type="button" className="csToolbarButton" title="重置缩放" onClick={onResetZoom}>1:1</button>
      </div>
      <div className="csToolbarGroup">
        <button type="button" className="csToolbarButton" onClick={onToggleMinimap}>
          {minimapVisible ? '隐藏小地图' : '显示小地图'}
        </button>
      </div>
    </div>
  )
}