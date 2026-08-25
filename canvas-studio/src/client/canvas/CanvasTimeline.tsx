import { useState } from 'react'
import type { StudioCanvasNode, StudioCanvasNodeKind } from '../../contracts/canvas.js'

/** Human-readable labels for the node kinds. */
const KIND_LABEL: Readonly<Record<StudioCanvasNodeKind, string>> = {
  image: '图',
  video: '视频',
  sticky: '便签',
  text: '文本',
  prompt: '提示',
  group: '分组',
}

/** Props for the bottom review/timeline strip. */
export interface CanvasTimelineProps {
  /** 已按有效顺序排好的条目（调用方经 deriveTimelineOrder 派生）。 */
  ordered: readonly StudioCanvasNode[]
  selectedNodeId: string | null
  /** Select a node from the strip (also used to jump/center it on the surface). */
  onSelect(id: string): void
  /** P9.1：拖拽重排完成，回调整条的完整 id 顺序（由父级写入 view.timeline）。 */
  onReorder(ids: string[]): void
}

/** Short HH:MM:SS label for a node timestamp. */
function timeLabel(createdAt: number): string {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleTimeString()
}

/**
 * The review strip: every node of the project as a thumbnail chip. Clicking a
 * chip selects the node and (via the parent) centers it on the surface — this
 * is the "回看" entry point. P9.1: chips are drag-reorderable; the resulting
 * order persists via view.timeline and later feeds compose 的 clipIds。
 */
export function CanvasTimeline(props: CanvasTimelineProps) {
  const { ordered, selectedNodeId, onSelect, onReorder } = props
  // HTML5 DnD 的拖起/悬停下标（组件内瞬态；落点即目标插入位）。
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  if (ordered.length === 0) {
    return <div className="csTimeline csTimelineEmpty">尚无产物 —— 在右侧对话让 agent 生成后，按时间线回看</div>
  }

  const handleDrop = (targetIndex: number): void => {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null)
      setHoverIndex(null)
      return
    }
    const ids = ordered.map(node => node.id)
    const [moved] = ids.splice(dragIndex, 1)
    if (moved !== undefined) ids.splice(targetIndex, 0, moved)
    onReorder(ids)
    setDragIndex(null)
    setHoverIndex(null)
  }

  return (
    <div className="csTimeline">
      {ordered.map((node, index) => {
        const className = [
          'csTimelineItem',
          node.id === selectedNodeId ? 'csTimelineItemActive' : '',
          index === hoverIndex && dragIndex !== null && dragIndex !== index ? 'csTimelineItemTarget' : '',
        ].filter(Boolean).join(' ')
        return (
          <button
            type="button"
            key={node.id}
            className={className}
            draggable
            onDragStart={() => { setDragIndex(index) }}
            onDragOver={event => {
              if (dragIndex === null) return
              event.preventDefault()
              setHoverIndex(index)
            }}
            onDrop={event => {
              event.preventDefault()
              handleDrop(index)
            }}
            onDragEnd={() => { setDragIndex(null); setHoverIndex(null) }}
            onClick={() => { onSelect(node.id) }}
            title={`${node.title ?? KIND_LABEL[node.kind]} · 拖拽排序`}
          >
            <span className="csTimelineThumb">
              {node.kind === 'image' && node.url
                ? <img src={node.url} alt={node.title ?? 'image'} draggable={false} />
                : null}
              {node.kind === 'video' && node.url
                ? <video src={node.url} muted preload="metadata" />
                : null}
              {node.kind !== 'image' && node.kind !== 'video'
                ? <span className="csTimelineKind">{KIND_LABEL[node.kind]}</span>
                : null}
            </span>
            <span className="csTimelineTime">{timeLabel(node.createdAt)}</span>
          </button>
        )
      })}
    </div>
  )
}
