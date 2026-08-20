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
  nodes: readonly StudioCanvasNode[]
  selectedNodeId: string | null
  /** Select a node from the strip (also used to jump/center it on the surface). */
  onSelect(id: string): void
}

/** Short HH:MM:SS label for a node timestamp. */
function timeLabel(createdAt: number): string {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleTimeString()
}

/**
 * The review strip: every node of the project, ordered by creation time, as a
 * thumbnail chip. Clicking a chip selects the node and (via the parent) centers
 * it on the surface — this is the "回看" entry point.
 */
export function CanvasTimeline(props: CanvasTimelineProps) {
  const { nodes, selectedNodeId, onSelect } = props
  const ordered = [...nodes].sort((left, right) => left.createdAt - right.createdAt)
  if (ordered.length === 0) {
    return <div className="csTimeline csTimelineEmpty">尚无产物 —— 在右侧对话让 agent 生成后，按时间线回看</div>
  }
  return (
    <div className="csTimeline">
      {ordered.map(node => {
        const className = node.id === selectedNodeId ? 'csTimelineItem csTimelineItemActive' : 'csTimelineItem'
        return (
          <button type="button" key={node.id} className={className} onClick={() => { onSelect(node.id) }}>
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
