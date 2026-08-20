import type { StudioCanvasNodeKind } from '../../contracts/canvas.js'

/** Alignment targets (kept explicit so the loop stays type-safe). */
type AlignTarget = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

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
  onAlign(alignment: AlignTarget): void
  onDistribute(direction: 'horizontal' | 'vertical'): void
  onAutoArrange(): void
  onAddNode(kind: ManualNodeKind): void
}

const ALIGN_LABELS: Readonly<Record<AlignTarget, string>> = {
  left: '左对齐',
  center: '水平居中',
  right: '右对齐',
  top: '顶对齐',
  middle: '垂直居中',
  bottom: '底对齐',
}

/**
 * The canvas toolbar: undo/redo, selection editing (delete/group/ungroup/
 * align/distribute), auto-arrange, and manual node creation (sticky/text/
 * prompt). Everything is props-driven — the frame wires the store actions.
 */
export function CanvasToolbar(props: CanvasToolbarProps) {
  const { canUndo, canRedo, selectedCount, hasSelection, onUndo, onRedo, onDelete, onGroup, onUngroup, onAlign, onDistribute, onAutoArrange, onAddNode } = props
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
        {(Object.keys(ALIGN_LABELS) as AlignTarget[]).map(alignment => (
          <button
            key={alignment}
            type="button"
            className="csToolbarButton"
            disabled={selectedCount < 2}
            title={ALIGN_LABELS[alignment]}
            onClick={() => { onAlign(alignment) }}
          >
            {ALIGN_LABELS[alignment]}
          </button>
        ))}
      </div>
      <div className="csToolbarGroup">
        <button type="button" className="csToolbarButton" disabled={selectedCount < 3} onClick={() => { onDistribute('horizontal') }}>水平分布</button>
        <button type="button" className="csToolbarButton" disabled={selectedCount < 3} onClick={() => { onDistribute('vertical') }}>垂直分布</button>
        <button type="button" className="csToolbarButton" title="按血缘深度整理布局" onClick={onAutoArrange}>整理布局</button>
      </div>
      <div className="csToolbarGroup">
        <button type="button" className="csToolbarButton" onClick={() => { onAddNode('sticky') }}>+ 便签</button>
        <button type="button" className="csToolbarButton" onClick={() => { onAddNode('text') }}>+ 文本</button>
        <button type="button" className="csToolbarButton" onClick={() => { onAddNode('prompt') }}>+ 提示</button>
      </div>
    </div>
  )
}