import type { StudioCanvasNode, StudioCanvasNodeKind } from '../../contracts/canvas.js'

/** Human-readable labels for the non-media node kinds. */
const KIND_LABEL: Readonly<Record<StudioCanvasNodeKind, string>> = {
  image: '图片',
  video: '视频',
  sticky: '便签',
  text: '文本',
  prompt: '提示',
}

/** Props for a single canvas node box. */
export interface CanvasNodeProps {
  node: StudioCanvasNode
  selected: boolean
  onPointerDown(event: React.PointerEvent): void
}

/**
 * One canvas node: an image/video media box or a text annotation box, placed
 * at its canvas-space coordinates. The surface owns pan/zoom/drag; this
 * component is purely presentational and reports pointer-down so the surface
 * can begin a node drag.
 */
export function CanvasNode(props: CanvasNodeProps) {
  const { node, selected, onPointerDown } = props
  const className = selected ? 'csNode csNodeSelected' : 'csNode'
  return (
    <div
      className={className}
      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
      onPointerDown={onPointerDown}
      data-node-id={node.id}
    >
      {node.kind === 'image' && node.url
        ? <img className="csNodeMedia" src={node.url} alt={node.title ?? 'image'} draggable={false} />
        : null}
      {node.kind === 'video' && node.url
        ? <video className="csNodeMedia" src={node.url} controls preload="metadata" />
        : null}
      {node.kind === 'sticky' || node.kind === 'text' || node.kind === 'prompt'
        ? (
          <div className="csNodeText">
            <span className="csNodeKind">{KIND_LABEL[node.kind]}</span>
            <p className="csNodeBody">{node.text ?? node.title ?? ''}</p>
          </div>
        )
        : null}
      {selected && <div className="csNodeRing" />}
    </div>
  )
}
