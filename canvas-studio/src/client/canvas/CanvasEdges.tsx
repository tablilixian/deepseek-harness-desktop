import type { StudioCanvasNode } from '../../contracts/canvas.js'

/** Props for the bloodline edge overlay. */
export interface CanvasEdgesProps {
  nodes: readonly StudioCanvasNode[]
}

/**
 * Bloodline edges: every node draws a bezier from each of its `sourceIds`
 * sources. There is no separate edge table — edges are derived from the node
 * graph at render time (plan §7.3). Coordinates are canvas-space; the parent
 * layer applies the pan/zoom transform, so this SVG only needs overflow-visible.
 */
export function CanvasEdges(props: CanvasEdgesProps) {
  const { nodes } = props
  const byId = new Map(nodes.map(node => [node.id, node]))
  const paths: React.ReactNode[] = []
  for (const node of nodes) {
    for (const sourceId of node.sourceIds) {
      const source = byId.get(sourceId)
      if (source === undefined) continue
      const sx = source.x + source.width / 2
      const sy = source.y + source.height
      const tx = node.x + node.width / 2
      const ty = node.y
      const midY = (sy + ty) / 2
      const d = `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`
      paths.push(<path key={`${sourceId}->${node.id}`} className="csEdge" d={d} />)
    }
  }
  return (
    <svg className="csEdges" width={1} height={1}>
      {paths}
    </svg>
  )
}
