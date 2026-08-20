import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { StudioCanvasNode } from '../../contracts/canvas.js'
import { calculateSnap, clamp, contentBounds, screenToWorld } from './canvas-math.js'
import { CanvasEdges } from './CanvasEdges.js'
import { CanvasNode, type ResizeCorner } from './CanvasNode.js'
import { Minimap } from './Minimap.js'
import { compareNodes } from '../project-store.js'

/** Zoom clamp range (reference design doc §9.6: 0.1x – 5x). */
const MIN_SCALE = 0.1
const MAX_SCALE = 5
const ZOOM_STEP = 1.2
const MIN_NODE_SIZE = 50

/** A drag/resize/link gesture in progress. */
interface Gesture {
  mode: 'pan' | 'node' | 'resize' | 'link'
  startX: number
  startY: number
  nodeId?: string
  originX?: number
  originY?: number
  originWidth?: number
  originHeight?: number
  corner?: ResizeCorner
  sourceId?: string
  fromWorldX?: number
  fromWorldY?: number
}

/** Props for the pannable / zoomable canvas surface. */
export interface CanvasSurfaceProps {
  nodes: readonly StudioCanvasNode[]
  selectedNodeId: string | null
  selectedNodeIds: readonly string[]
  /** Select a node (or null to clear); `multi` toggles in the multi-select roster. */
  onSelectNode(id: string | null, multi?: boolean): void
  /** Select all nodes of the project. */
  onSelectAllNodes(): void
  /** Live node move during drag (canvas-space coordinates). */
  onMoveNode(id: string, x: number, y: number): void
  /** Live node field update (resize). */
  onUpdateNode(id: string, updates: Partial<StudioCanvasNode>): void
  /** Snapshot history before a mutation gesture (drag/resize start). */
  onBeginEdit(): void
  /** Persist after a drag / resize / link / rename ends. */
  onPersist(): void
  /** Remove nodes (keyboard / context menu). */
  onRemoveNodes(ids: string[]): void
  onCopy(): void
  onPaste(): void
  onUndo(): void
  onRedo(): void
  /** Manual bloodline: target node gains the source ids. */
  onLinkLayers(sourceIds: string[], targetId: string): void
  /** Inline rename commit. */
  onRename(id: string, title: string): void
  /** Context menu request (rendered by the frame). */
  onContextMenu(node: StudioCanvasNode, clientX: number, clientY: number): void
  /** When set, center this node in the viewport (timeline / review jump). */
  focusNodeId?: string | null
  /** Report the current zoom level so the frame can show it in the toolbar. */
  onScaleChange?(scale: number): void
  /** Whether the minimap overlay is shown (toggle lives in the toolbar). */
  minimapVisible?: boolean
}

/** Imperative zoom controls exposed to the frame toolbar. */
export interface CanvasSurfaceHandle {
  zoomBy(factor: number): void
  fitToContent(): void
  resetZoom(): void
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
export const CanvasSurface = forwardRef<CanvasSurfaceHandle, CanvasSurfaceProps>(function CanvasSurface(props, ref) {
  const {
    nodes,
    selectedNodeIds,
    onSelectNode,
    onSelectAllNodes,
    onMoveNode,
    onUpdateNode,
    onBeginEdit,
    onPersist,
    onRemoveNodes,
    onCopy,
    onPaste,
    onUndo,
    onRedo,
    onLinkLayers,
    onRename,
    onContextMenu,
    focusNodeId,
    onScaleChange,
    minimapVisible = true,
  } = props
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [guides, setGuides] = useState<{ vertical: number[]; horizontal: number[] }>({ vertical: [], horizontal: [] })
  const [linkLine, setLinkLine] = useState<{ fromX: number; fromY: number; toX: number; toY: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(offset)
  const scaleRef = useRef(scale)
  offsetRef.current = offset
  scaleRef.current = scale
  const gesture = useRef<Gesture>({ mode: 'pan', startX: 0, startY: 0 })
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes

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

  const panBy = useCallback((deltaX: number, deltaY: number) => {
    setOffset(previous => ({ x: previous.x + deltaX, y: previous.y + deltaY }))
  }, [])

  const zoomAround = useCallback((pointX: number, pointY: number, factor: number) => {
    const el = containerRef.current
    if (el === null) return
    const rect = el.getBoundingClientRect()
    const px = pointX - rect.left
    const py = pointY - rect.top
    const newScale = clamp(scaleRef.current * factor, MIN_SCALE, MAX_SCALE)
    const wx = (px - offsetRef.current.x) / scaleRef.current
    const wy = (py - offsetRef.current.y) / scaleRef.current
    setOffset({ x: px - wx * newScale, y: py - wy * newScale })
    setScale(newScale)
  }, [])

  // Native non-passive wheel listener so preventDefault works (React roots
  // attach wheel as passive). Ctrl/Cmd+wheel zooms around the cursor; a plain
  // wheel pans (reference behavior).
  useEffect(() => {
    const el = containerRef.current
    if (el === null) return
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      if (event.ctrlKey || event.metaKey) {
        zoomAround(event.clientX, event.clientY, event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP)
      } else {
        panBy(-event.deltaX, -event.deltaY)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => { el.removeEventListener('wheel', onWheel) }
  }, [zoomAround, panBy])

  // Keyboard shortcuts (window-level; skip while typing in a field).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      if (target !== null && target.closest('input, textarea, select, [contenteditable="true"]') !== null) return
      const modifier = event.ctrlKey || event.metaKey
      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) onRedo()
        else onUndo()
        return
      }
      if (modifier && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        onRedo()
        return
      }
      if (modifier && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        onCopy()
        return
      }
      if (modifier && event.key.toLowerCase() === 'v') {
        event.preventDefault()
        onPaste()
        return
      }
      if (modifier && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        onSelectAllNodes()
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedNodeIds.length > 0) onRemoveNodes([...selectedNodeIds])
        return
      }
      if (event.key === 'Escape') {
        onSelectNode(null)
        return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown) }
  }, [selectedNodeIds, onSelectNode, onSelectAllNodes, onRemoveNodes, onCopy, onPaste, onUndo, onRedo])

  const fitToContent = useCallback(() => {
    const el = containerRef.current
    if (el === null) return
    const bounds = contentBounds(nodesRef.current)
    const vw = el.clientWidth
    const vh = el.clientHeight
    if (bounds === null) {
      setScale(1)
      setOffset({ x: 0, y: 0 })
      return
    }
    const padding = 60
    const scaleX = (vw - padding * 2) / bounds.width
    const scaleY = (vh - padding * 2) / bounds.height
    const newScale = clamp(Math.min(scaleX, scaleY), MIN_SCALE, MAX_SCALE)
    const centerX = bounds.x + bounds.width / 2
    const centerY = bounds.y + bounds.height / 2
    setScale(newScale)
    setOffset({ x: vw / 2 - centerX * newScale, y: vh / 2 - centerY * newScale })
  }, [])

  const zoomBy = useCallback((factor: number) => {
    const el = containerRef.current
    if (el === null) return
    zoomAround(el.clientWidth / 2, el.clientHeight / 2, factor)
  }, [zoomAround])

  const resetZoom = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  const onSurfacePointerDown = (event: React.PointerEvent): void => {
    if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
      gesture.current = { mode: 'pan', startX: event.clientX, startY: event.clientY }
      event.preventDefault()
      return
    }
    if (event.button !== 0) return
    gesture.current = { mode: 'pan', startX: event.clientX, startY: event.clientY }
    if (!event.shiftKey) onSelectNode(null)
  }

  const onNodePointerDown = (event: React.PointerEvent, node: StudioCanvasNode): void => {
    onSelectNode(node.id, event.ctrlKey || event.metaKey)
    if (node.locked) return
    onBeginEdit()
    gesture.current = {
      mode: 'node',
      startX: event.clientX,
      startY: event.clientY,
      nodeId: node.id,
      originX: node.x,
      originY: node.y,
    }
  }

  const onResizePointerDown = (event: React.PointerEvent, node: StudioCanvasNode, corner: ResizeCorner): void => {
    onSelectNode(node.id)
    onBeginEdit()
    gesture.current = {
      mode: 'resize',
      startX: event.clientX,
      startY: event.clientY,
      nodeId: node.id,
      originX: node.x,
      originY: node.y,
      originWidth: node.width,
      originHeight: node.height,
      corner,
    }
  }

  const onLinkPointerDown = (event: React.PointerEvent, node: StudioCanvasNode): void => {
    const world = screenToWorld(event.clientX, event.clientY, offsetRef.current.x, offsetRef.current.y, scaleRef.current)
    gesture.current = {
      mode: 'link',
      startX: event.clientX,
      startY: event.clientY,
      sourceId: node.id,
      fromWorldX: world.x,
      fromWorldY: world.y,
    }
    setLinkLine({ fromX: world.x, fromY: world.y, toX: world.x, toY: world.y })
  }

  const onPointerMove = (event: React.PointerEvent): void => {
    const current = gesture.current
    const el = containerRef.current
    if (el === null) return
    if (current.mode === 'pan') {
      setOffset(previous => ({
        x: previous.x + (event.clientX - current.startX),
        y: previous.y + (event.clientY - current.startY),
      }))
      current.startX = event.clientX
      current.startY = event.clientY
      return
    }
    if (current.mode === 'node' && current.nodeId !== undefined && current.originX !== undefined && current.originY !== undefined) {
      const dx = (event.clientX - current.startX) / scaleRef.current
      const dy = (event.clientY - current.startY) / scaleRef.current
      const targetX = current.originX + dx
      const targetY = current.originY + dy
      const dragged = nodesRef.current.find(candidate => candidate.id === current.nodeId)
      if (dragged === undefined) return
      const snapped = calculateSnap(nodesRef.current, dragged, targetX, targetY)
      onMoveNode(current.nodeId, snapped.x, snapped.y)
      setGuides({
        vertical: snapped.guides.filter(guide => guide.type === 'vertical').map(guide => guide.position),
        horizontal: snapped.guides.filter(guide => guide.type === 'horizontal').map(guide => guide.position),
      })
      return
    }
    if (current.mode === 'resize' && current.nodeId !== undefined && current.originX !== undefined
      && current.originY !== undefined && current.originWidth !== undefined && current.originHeight !== undefined
      && current.corner !== undefined) {
      const dx = (event.clientX - current.startX) / scaleRef.current
      const dy = (event.clientY - current.startY) / scaleRef.current
      const corner = current.corner
      let x = current.originX
      let y = current.originY
      let width = current.originWidth
      let height = current.originHeight
      if (corner.includes('e')) width = Math.max(MIN_NODE_SIZE, current.originWidth + dx)
      if (corner.includes('s')) height = Math.max(MIN_NODE_SIZE, current.originHeight + dy)
      if (corner.includes('w')) {
        width = Math.max(MIN_NODE_SIZE, current.originWidth - dx)
        x = current.originX + current.originWidth - width
      }
      if (corner.includes('n')) {
        height = Math.max(MIN_NODE_SIZE, current.originHeight - dy)
        y = current.originY + current.originHeight - height
      }
      onUpdateNode(current.nodeId, { x, y, width, height })
      return
    }
    if (current.mode === 'link' && current.fromWorldX !== undefined && current.fromWorldY !== undefined) {
      const world = screenToWorld(event.clientX, event.clientY, offsetRef.current.x, offsetRef.current.y, scaleRef.current)
      setLinkLine({ fromX: current.fromWorldX, fromY: current.fromWorldY, toX: world.x, toY: world.y })
    }
  }

  const onPointerUp = (event: React.PointerEvent): void => {
    const current = gesture.current
    if (current.mode === 'link' && current.sourceId !== undefined) {
      const world = screenToWorld(event.clientX, event.clientY, offsetRef.current.x, offsetRef.current.y, scaleRef.current)
      const target = nodesRef.current.find(candidate =>
        candidate.id !== current.sourceId
        && candidate.visible !== false
        && world.x >= candidate.x && world.x <= candidate.x + candidate.width
        && world.y >= candidate.y && world.y <= candidate.y + candidate.height,
      )
      if (target !== undefined) onLinkLayers([current.sourceId], target.id)
      setLinkLine(null)
      onPersist()
    }
    if (current.mode === 'node' || current.mode === 'resize') onPersist()
    setGuides({ vertical: [], horizontal: [] })
    gesture.current = { mode: 'pan', startX: 0, startY: 0 }
  }

  const visibleNodes = nodes.filter(node => node.visible !== false)
  const ordered = [...visibleNodes].sort(compareNodes)

  // Report the zoom level to the frame so the toolbar can display it.
  useEffect(() => {
    onScaleChange?.(scale)
  }, [scale, onScaleChange])

  // Expose zoom actions (incl. keyboard-driven zoomBy/fit/reset) to the frame.
  useImperativeHandle(ref, () => ({ zoomBy, fitToContent, resetZoom }), [zoomBy, fitToContent, resetZoom])

  return (
    <div
      className="csCanvasSurface"
      ref={containerRef}
      onPointerDown={onSurfacePointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => {
        if (gesture.current.mode !== 'pan') {
          onPointerUp(new MouseEvent('pointerup') as unknown as React.PointerEvent)
        }
      }}
      style={{
        backgroundPosition: `${offset.x}px ${offset.y}px`,
        backgroundSize: `${40 * scale}px ${40 * scale}px`,
      }}
    >
      <div
        className="csCanvasLayer"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: '0 0' }}
      >
        <CanvasEdges nodes={visibleNodes} selectedNodeIds={selectedNodeIds} />
        {guides.vertical.map(position => (
          <div key={`gv-${position}`} className="csGuide csGuideVertical" style={{ left: position }} />
        ))}
        {guides.horizontal.map(position => (
          <div key={`gh-${position}`} className="csGuide csGuideHorizontal" style={{ top: position }} />
        ))}
        {ordered.map(node => (
          <CanvasNode
            key={node.id}
            node={node}
            selected={selectedNodeIds.includes(node.id)}
            onNodePointerDown={onNodePointerDown}
            onResizePointerDown={onResizePointerDown}
            onLinkPointerDown={onLinkPointerDown}
            onRenameSubmit={onRename}
            onContextMenu={onContextMenu}
          />
        ))}
        {linkLine !== null && (
          <svg className="csEdges" width={1} height={1}>
            <path
              className="csEdge csEdgeDraft"
              d={`M ${linkLine.fromX} ${linkLine.fromY} L ${linkLine.toX} ${linkLine.toY}`}
            />
          </svg>
        )}
      </div>
      {minimapVisible && <Minimap nodes={visibleNodes} offset={offset} scale={scale} onSetOffset={setOffset} />}
    </div>
  )
})