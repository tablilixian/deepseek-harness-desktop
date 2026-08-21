import { useEffect, useRef, useState } from 'react'
import type { InjectFace, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { StudioProjectListInjected } from './contracts.js'
import { nodesOf, selectedNodeOf, viewOf } from './project-store.js'
import { ProjectList } from './ProjectList.js'
import { CanvasToolbar } from './canvas/CanvasToolbar.js'
import { CanvasSurface, type CanvasSurfaceHandle } from './canvas/CanvasSurface.js'
import { CanvasTimeline } from './canvas/CanvasTimeline.js'
import { LayerPanel } from './canvas/LayerPanel.js'
import { LayerDetailPanel } from './canvas/LayerDetailPanel.js'
import { CanvasContextMenu } from './canvas/CanvasContextMenu.js'
import type { StudioCanvasNode, StudioCanvasView } from '../contracts/canvas.js'

// Zoom step for the toolbar +/− buttons (matches the surface wheel step).
const ZOOM_STEP = 1.2
/** Debounce for viewport saves (pan/zoom fire per frame; disk saves must not). */
const VIEW_SAVE_DEBOUNCE_MS = 400

/** Studio root frame props: the standard root shares plus the studio inject face. */
export type StudioFrameProps = PropsRuntime<'root'>
  & PropsRenderSlots<'conversation' | 'shell.overlay'>
  & InjectFace<StudioProjectListInjected>

/**
 * Three-region studio frame: project list + layer list on the left, the canvas
 * surface (toolbar on top, review timeline at the bottom) in the center, and
 * the official conversation seat on the right. The sidebar and details seats
 * stay declared (upstream registrants keep their paths) but are not rendered.
 * A single selected node opens the detail panel; a context menu offers node
 * ordering / lock / generation actions. The canvas shows every captured node
 * of the selected project (image/video/sticky/text/prompt/group) with
 * bloodline edges; the timeline lets the user review and jump to any node.
 */
export function StudioFrame(props: StudioFrameProps) {
  const { renderSlot, useStudio, refreshProjects, createProject, openProject, deleteProject, persistCanvas, retryNode, steerNode, cancelCurrentTurn, actions } = props
  const projects = useStudio(store => store.projects)
  const selectedProjectId = useStudio(store => store.selectedProjectId)
  const selectedNodeId = useStudio(store => store.selectedNodeId)
  const selectedNodeIds = useStudio(store => store.selectedNodeIds)
  const nodes = useStudio(store => nodesOf(store, store.selectedProjectId))
  const selectedNode = useStudio(store => selectedNodeOf(store))
  const phase = useStudio(store => store.phase)
  const error = useStudio(store => store.error)
  const creating = useStudio(store => store.creating)
  const historyIndex = useStudio(store => store.historyIndex)
  const historyLength = useStudio(store => store.history.length)
  const viewEntry = useStudio(store => viewOf(store, store.selectedProjectId))
  const view = viewEntry.view
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const surfaceRef = useRef<CanvasSurfaceHandle>(null)
  const [menu, setMenu] = useState<{ node: StudioCanvasNode; x: number; y: number } | null>(null)
  const viewSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fitPendingRef = useRef(false)
  const fittedProjectRef = useRef<string | null>(null)
  // 整理布局后等新坐标渲染完成再适配视野（imperative fit 读的是渲染后的节点表）。
  const [fitRequestedAt, setFitRequestedAt] = useState(0)

  // 首次挂载即拉取项目列表，无需手动点「刷新」。
  useEffect(() => { void refreshProjects() }, [refreshProjects])
  // 视口/面板变化 → store 已即时更新；磁盘持久化防抖合并（拖拽平移每帧触发）。
  useEffect(() => () => {
    if (viewSaveTimer.current !== null) clearTimeout(viewSaveTimer.current)
  }, [])
  // 右键菜单：任意按下即关闭。
  useEffect(() => {
    if (menu === null) return
    const close = () => { setMenu(null) }
    window.addEventListener('mousedown', close)
    return () => { window.removeEventListener('mousedown', close) }
  }, [menu])

  const projectId = selectedProjectId
  // 无持久化视图的旧项目：节点首次就绪后自动适配一次视野。
  useEffect(() => {
    if (projectId === null || viewEntry.saved || nodes.length === 0) return
    if (fittedProjectRef.current === projectId) return
    fittedProjectRef.current = projectId
    surfaceRef.current?.fitToContent()
  }, [projectId, viewEntry.saved, nodes])
  // 整理布局后的适配：等 nodes 新坐标渲染进 surface 再执行。
  useEffect(() => {
    if (fitRequestedAt === 0) return
    if (!fitPendingRef.current) return
    fitPendingRef.current = false
    surfaceRef.current?.fitToContent()
  }, [fitRequestedAt, nodes])
  const beginEdit = (): void => {
    if (projectId !== null) actions.pushHistory(projectId)
  }
  const persist = (): void => {
    if (projectId !== null) void persistCanvas(projectId).catch((cause) => {
      actions.setFailed(cause instanceof Error ? cause.message : '画布保存失败')
    })
  }
  const persistAfter = (mutate: () => void): void => {
    mutate()
    persist()
  }
  // 视口/面板状态：store 即时合并（画布受控渲染），磁盘保存防抖合并。
  const handleViewChange = (patch: Partial<StudioCanvasView>): void => {
    if (projectId === null) return
    actions.setView(projectId, patch)
    if (viewSaveTimer.current !== null) clearTimeout(viewSaveTimer.current)
    viewSaveTimer.current = setTimeout(() => {
      viewSaveTimer.current = null
      persist()
    }, VIEW_SAVE_DEBOUNCE_MS)
  }
  const handleDelete = (ids: string[]): void => {
    if (projectId === null || ids.length === 0) return
    persistAfter(() => actions.removeNodes(projectId, ids))
    setDetailOpen(false)
  }
  const handleToggleVisibility = (id: string): void => {
    if (projectId === null) return
    const node = nodes.find(candidate => candidate.id === id)
    if (node === undefined) return
    actions.setVisibility(projectId, id, node.visible === false)
  }
  const handleReorder = (id: string, direction: 'front' | 'back' | 'forward' | 'backward'): void => {
    if (projectId === null) return
    persistAfter(() => actions.reorderNode(projectId, id, direction))
  }
  const handleUndo = (): void => {
    persistAfter(() => actions.undo())
  }
  const handleRedo = (): void => {
    persistAfter(() => actions.redo())
  }
  const handleRename = (id: string, title: string): void => {
    if (projectId === null) return
    persistAfter(() => actions.renameNode(projectId, id, title))
  }
  const handleRetry = (id: string): void => {
    if (projectId === null) return
    void retryNode(projectId, id).catch((cause) => {
      actions.setFailed(cause instanceof Error ? cause.message : '重试失败')
    })
  }
  const handleSteer = (id: string, prompt: string): void => {
    if (projectId === null) return
    void steerNode(projectId, id, prompt).catch((cause) => {
      actions.setFailed(cause instanceof Error ? cause.message : '重新生成失败')
    })
  }
  const handleTimelineSelect = (id: string): void => {
    actions.selectNode(id)
    setFocusNodeId(id)
    setDetailOpen(false)
  }

  const canvasBody = ((): React.ReactNode => {
    if (projectId === null) {
      return <div className="csCanvasEmpty">打开或新建一个项目，开始创作</div>
    }
    return (
      <>
        <div className="csCanvasBody">
          <CanvasSurface
            nodes={nodes}
            view={view}
            onViewChange={handleViewChange}
            selectedNodeId={selectedNodeId}
            selectedNodeIds={selectedNodeIds}
            onSelectNode={(id, multi) => { actions.selectNode(id, multi) }}
            onSelectAllNodes={() => { actions.selectAllNodes() }}
            onMoveNode={(id, x, y) => { actions.moveNode(projectId, id, x, y) }}
            onUpdateNode={(id, updates) => { actions.updateNode(projectId, id, updates) }}
            onBeginEdit={beginEdit}
            onPersist={persist}
            onRemoveNodes={handleDelete}
            onCopy={() => { actions.copySelected(projectId) }}
            onPaste={() => { persistAfter(() => actions.pasteNodes(projectId)) }}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onLinkLayers={(sourceIds, targetId) => { persistAfter(() => actions.linkLayers(projectId, sourceIds, targetId)) }}
            onRename={handleRename}
            onContextMenu={(node, x, y) => { setMenu({ node, x, y }) }}
            focusNodeId={focusNodeId}
            ref={surfaceRef}
            minimapVisible={view.minimapVisible}
          />
          {view.layersOpen && (
            <aside className="csCanvasLayers">
              <LayerPanel
                nodes={nodes}
                selectedNodeIds={selectedNodeIds}
                onSelect={(id, multi) => { actions.selectNode(id, multi) }}
                onDelete={handleDelete}
                onToggleLock={id => { if (projectId !== null) persistAfter(() => actions.toggleLock(projectId, id)) }}
                onToggleVisibility={handleToggleVisibility}
                onReorder={handleReorder}
              />
            </aside>
          )}
        </div>
        <CanvasTimeline nodes={nodes} selectedNodeId={selectedNodeId} onSelect={handleTimelineSelect} />
      </>
    )
  })()

  return (
    <div className="csFrame">
      <aside className="csProjects">
        <header className="csProjectsHeader">
          <span>项目</span>
          <button type="button" disabled={phase === 'loading' || creating} onClick={() => void refreshProjects()}>
            刷新
          </button>
        </header>
        <ProjectList
          projects={projects}
          selectedProjectId={selectedProjectId}
          phase={phase}
          error={error}
          creating={creating}
          onRefresh={() => void refreshProjects()}
          onCreate={createProject}
          onOpen={openProject}
          onDelete={deleteProject}
        />
      </aside>
      <main className="csCanvas">
        <CanvasToolbar
          canUndo={historyIndex >= 0}
          canRedo={historyIndex + 1 < historyLength}
          selectedCount={selectedNodeIds.length}
          hasSelection={selectedNodeIds.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onDelete={() => { handleDelete(selectedNodeIds) }}
          onGroup={() => { if (projectId !== null) persistAfter(() => actions.groupSelected(projectId)) }}
          onUngroup={() => {
            if (selectedNode !== null && selectedNode.kind === 'group' && projectId !== null) {
              persistAfter(() => actions.ungroup(projectId, selectedNode.id))
            }
          }}
          onAutoArrange={() => {
            if (projectId === null) return
            persistAfter(() => actions.autoArrange(projectId))
            fitPendingRef.current = true
            setFitRequestedAt(Date.now())
          }}
          onAddNode={kind => { if (projectId !== null) persistAfter(() => actions.addNode(projectId, kind)) }}
          layersOpen={view.layersOpen}
          onToggleLayers={() => { handleViewChange({ layersOpen: !view.layersOpen }) }}
          scale={view.scale}
          onZoomOut={() => { surfaceRef.current?.zoomBy(1 / ZOOM_STEP) }}
          onZoomIn={() => { surfaceRef.current?.zoomBy(ZOOM_STEP) }}
          onFitContent={() => { surfaceRef.current?.fitToContent() }}
          onResetZoom={() => { surfaceRef.current?.resetZoom() }}
          minimapVisible={view.minimapVisible}
          onToggleMinimap={() => { handleViewChange({ minimapVisible: !view.minimapVisible }) }}
        />
        {canvasBody}
      </main>
      <aside className="csChat">
        <section className="csConversation">
          {renderSlot('conversation', {})}
        </section>
      </aside>
      {selectedNode !== null && projectId !== null && detailOpen && (
        <LayerDetailPanel
          node={selectedNode}
          onClose={() => { setDetailOpen(false) }}
          onRename={handleRename}
          onSetOpacity={(id, opacity) => { if (projectId !== null) persistAfter(() => actions.setOpacity(projectId, id, opacity)) }}
          onToggleFlip={(id, axis) => {
            if (projectId !== null) {
              const node = nodes.find(candidate => candidate.id === id)
              if (node === undefined) return
              persistAfter(() => actions.updateNode(projectId, id, { [axis]: !node[axis] }))
            }
          }}
          onToggleLock={id => { if (projectId !== null) persistAfter(() => actions.toggleLock(projectId, id)) }}
          onToggleVisibility={handleToggleVisibility}
          onReorder={handleReorder}
          onDelete={id => { handleDelete([id]) }}
          onRetry={handleRetry}
          onSteer={handleSteer}
          onCancel={() => { void cancelCurrentTurn() }}
        />
      )}
      {menu !== null && projectId !== null && (
        <CanvasContextMenu
          node={menu.node}
          x={menu.x}
          y={menu.y}
          onClose={() => { setMenu(null) }}
          onRename={id => { actions.selectNode(id); setDetailOpen(true) }}
          onCopy={id => { actions.selectNode(id); actions.copySelected(projectId) }}
          onDelete={id => { handleDelete([id]) }}
          onReorder={handleReorder}
          onToggleLock={id => { if (projectId !== null) persistAfter(() => actions.toggleLock(projectId, id)) }}
          onToggleVisibility={handleToggleVisibility}
          onRetry={handleRetry}
          onSteer={id => { actions.selectNode(id); setDetailOpen(true) }}
          onCancel={() => { void cancelCurrentTurn() }}
          onUngroup={id => { if (projectId !== null) persistAfter(() => actions.ungroup(projectId, id)) }}
        />
      )}
      <div className="csOverlay" data-cs-overlay>
        {renderSlot('shell.overlay', {})}
      </div>
    </div>
  )
}