import { useEffect, useRef, useState } from 'react'
import type { StudioCanvasNode } from '../../contracts/canvas.js'
import { CanvasEdges } from './CanvasEdges.js'
import { CanvasNode } from './CanvasNode.js'

/** Clamp a zoom scale to a sane range. */
function clampScale(value: number): number {
  return Math.min(3, Math.max(0.2, value))
}

/** Props for the pannable / zoomable canvas surface. */
export interface CanvasSurfaceProps {
  nodes: readonly StudioCanvasNode[]
  selectedNodeId: string | null
  /** Select a node (or null to clear, e.g. clicking empty canvas). */
  onSelectNode(id: string | null): void
  /** Live node move during drag (canvas-space coordinates). */
  onMoveNode(id: string, x: number, y: number): void
  /** Persist after a drag / pan finishes. */
  onPersist(): void
  /** When set, center this node in the viewport (timeline / review jump). */
  focusNodeId?: string | null
}

/**
 * The infinite canvas: a grid background that pans/zooms with content, node
 * boxes placed at their canvas-space coordinates, and the bloodline edge
 * overlay. Background pointer-down pans; node pointer-down begins a node drag;
 * wheel zooms around the cursor. Node coordinates are transformed by the layer
 * so edges and nodes share one coordinate system.
 */
export function CanvasSurface(props: CanvasSurfaceProps) {
  const { nodes, selectedNodeId, onSelectNode, onMoveNode, onPersist, focusNodeId } = props
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(offset)
  const scaleRef = useRef(scale)
  offsetRef.current = offset
  scaleRef.current = scale
  const drag = useRef<{ mode: 'pan' | 'node'; sx: number; sy: number; nodeId?: string; ox?: number; oy?: number }>({
    mode: 'pan',
    sx: 0,
    sy: 0,
  })

  // Center on a focused node (timeline/review jump) once when focusNodeId changes.
  useEffect(() => {
    if (focusNodeId === undefined || focusNodeId === null) return
    const node = nodes.find(candidate => candidate.id === focusNodeId)
    const el = containerRef.current
    if (node === undefined || el === null) return
    const vw = el.clientWidth
    const vh = el.clientHeight
    const cx = node.x + node.width / 2
    const cy = node.y + node.height / 2
    setOffset({ x: vw / 2 - cx * scaleRef.current, y: vh / 2 - cy * scaleRef.current })
  }, [focusNodeId, nodes])

  // Native non-passive wheel listener so preventDefault works (React roots
  // attach wheel as passive, which would ignore preventDefault).
  useEffect(() => {
    const el = containerRef.current
    if (el === null) return
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1
      const newScale = clampScale(scaleRef.current * factor)
      const wx = (px - offsetRef.current.x) / scaleRef.current
      const wy = (py - offsetRef.current.y) / scaleRef.current
      setOffset({ x: px - wx * newScale, y: py - wy * newScale })
      setScale(newScale)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => { el.removeEventListener('wheel', onWheel) }
  }, [])

  const onSurfacePointerDown = (event: React.PointerEvent): void => {
    drag.current = { mode: 'pan', sx: event.clientX, sy: event.clientY }
    onSelectNode(null)
  }

  const onNodePointerDown = (event: React.PointerEvent, node: StudioCanvasNode): void => {
    event.stopPropagation()
    drag.current = { mode: 'node', sx: event.clientX, sy: event.clientY, nodeId: node.id, ox: node.x, oy: node.y }
    onSelectNode(node.id)
  }

  const onPointerMove = (event: React.PointerEvent): void => {
    const current = drag.current
    if (current.mode === 'pan') {
      setOffset(previous => ({ x: previous.x + (event.clientX - current.sx), y: previous.y + (event.clientY - current.sy) }))
      current.sx = event.clientX
      current.sy = event.clientY
    } else if (current.mode === 'node' && current.nodeId !== undefined && current.ox !== undefined && current.oy !== undefined) {
      const dx = (event.clientX - current.sx) / scaleRef.current
      const dy = (event.clientY - current.sy) / scaleRef.current
      onMoveNode(current.nodeId, current.ox + dx, current.oy + dy)
    }
  }

  const onPointerUp = (event: React.PointerEvent): void => {
    if (drag.current.mode === 'node') onPersist()
    drag.current = { mode: 'pan', sx: 0, sy: 0 }
    void event
  }

  return (
    <div
      className="csCanvasSurface"
      ref={containerRef}
      onPointerDown={onSurfacePointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        backgroundPosition: `${offset.x}px ${offset.y}px`,
        backgroundSize: `${40 * scale}px ${40 * scale}px`,
      }}
    >
      <div
        className="csCanvasLayer"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: '0 0' }}
      >
        <CanvasEdges nodes={nodes} />
        {nodes.map(node => (
          <CanvasNode
            key={node.id}
            node={node}
            selected={node.id === selectedNodeId}
            onPointerDown={(event) => { onNodePointerDown(event, node) }}
          />
        ))}
      </div>
      <div className="csCanvasZoom">{Math.round(scale * 100)}%</div>
    </div>
  )
}
