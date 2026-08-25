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
import { ReferenceTray } from './canvas/ReferenceTray.js'
import { uploadLocalStudioImage, bytesToBase64 } from './api.js'
import type { StudioCanvasNode, StudioCanvasView } from '../contracts/canvas.js'
import { formatRefToken } from '../reference-token.js'

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
  const {
    renderSlot, useStudio, refreshProjects, createProject, openProject, deleteProject, persistCanvas,
    retryNode, steerNode, cancelCurrentTurn, approveStoryboard, rejectStoryboard, setWorkflowMode, actions,
  } = props
  const projects = useStudio(store => store.projects)
  const selectedProjectId = useStudio(store => store.selectedProjectId)
  const selectedNodeId = useStudio(store => store.selectedNodeId)
  const selectedNodeIds = useStudio(store => store.selectedNodeIds)
  const nodes = useStudio(store => nodesOf(store, store.selectedProjectId))
  // 参考托盘数据源：所有标记为参考图的图片节点。
  const referenceNodes = nodes.filter(node => node.isReference === true && node.kind === 'image')
  const selectedNode = useStudio(store => selectedNodeOf(store))
  const phase = useStudio(store => store.phase)
  const error = useStudio(store => store.error)
  const creating = useStudio(store => store.creating)
  const historyIndex = useStudio(store => store.historyIndex)
  const historyLength = useStudio(store => store.history.length)
  const viewEntry = useStudio(store => viewOf(store, store.selectedProjectId))
  const view = viewEntry.view
  // P7：当前项目的工作流（模式 + 审批门禁状态），驱动工作流条与审批按钮。
  const workflow = useStudio(store => store.selectedProjectId === null ? undefined : store.workflows[store.selectedProjectId])
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
  // P8.1：本地图片上传入口（工具条按钮）。读取用户选择的图片 → base64 →
  // Host 落地并上传 Drama 拿 filename → 画布新增 import 素材节点。
  const handleUploadImage = async (file: File): Promise<void> => {
    if (projectId === null) return
    // 直接走 ArrayBuffer：file.text() 会按 UTF-8 解码二进制，把 0x80–0xFF
    // 字节替换成 U+FFFD，导致 PNG/JPEG 头部字节被破坏（验收已复现）。
    const buffer = await file.arrayBuffer()
    const dataBase64 = bytesToBase64(new Uint8Array(buffer))
    try {
      // P8.1：上传同时拿回同源 url 与 Drama filename；filename 落节点，使参考
      // 托盘 / list_references 能直接把它交给生成工具，免去运行时再上传。
      const { url, filename } = await uploadLocalStudioImage(projectId, file.name, dataBase64)
      persistAfter(() => actions.addImportNode(projectId, url, file.name || '本地素材', filename))
    } catch (cause) {
      // 上传失败不破坏画布；错误提示由调用方（按钮）展示给用户。
      throw cause instanceof Error ? cause : new Error('图片上传失败')
    }
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
  // P9 参考托盘：节点字段更新（角色/强度/标记）走 updateNode 并持久化。
  const handleUpdateNode = (id: string, updates: Partial<StudioCanvasNode>): void => {
    if (projectId !== null) persistAfter(() => actions.updateNode(projectId, id, updates))
  }
  // 引用到对话：把 @ref[显示名] 复制到剪贴板，提示用户粘贴到聊天框。
  // 上游 InputBar 限制直接注入，故走「复制 + 提示」的稳健退化方案（plan §4.1 ③）。
  const handleReferenceToChat = (node: StudioCanvasNode): void => {
    const token = formatRefToken(node.title ?? node.id)
    void navigator.clipboard?.writeText(token).catch(() => {})
    window.alert(`已复制引用标记：${token}\n在右侧聊天框粘贴，并补充说明（如「用这张角色图生成分镜」）。`)
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
  // P7：审批动作后无需手动刷新 —— Host 返回的工作流已写回 store。
  const handleApprove = (): void => {
    if (projectId !== null) void approveStoryboard(projectId).catch((cause) => {
      actions.setFailed(cause instanceof Error ? cause.message : '批准失败')
    })
  }
  const handleReject = (): void => {
    if (projectId !== null) void rejectStoryboard(projectId).catch((cause) => {
      actions.setFailed(cause instanceof Error ? cause.message : '驳回失败')
    })
  }
  const handleSetMode = (mode: 'confirm' | 'auto'): void => {
    if (projectId !== null) void setWorkflowMode(projectId, mode).catch((cause) => {
      actions.setFailed(cause instanceof Error ? cause.message : '模式切换失败')
    })
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
            onNodeOpenDetail={(node) => { actions.selectNode(node.id); setDetailOpen(true) }}
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
        {referenceNodes.length > 0 && (
          <ReferenceTray
            nodes={referenceNodes}
            onUpdateNode={handleUpdateNode}
            onReferenceToChat={handleReferenceToChat}
          />
        )}
      </aside>
      <main
        className="csCanvas"
        onDragOver={(event) => {
          // P8.1：允许把本地图片拖到画布区域，松手即上传落素材节点。
          if (event.dataTransfer.types.includes('Files')) event.preventDefault()
        }}
        onDrop={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return
          event.preventDefault()
          const file = Array.from(event.dataTransfer.files).find(item => item.type.startsWith('image/'))
          if (file === undefined) return
          void (async () => {
            try {
              await handleUploadImage(file)
            } catch (cause) {
              window.alert(`图片上传失败：${cause instanceof Error ? cause.message : String(cause)}`)
            }
          })()
        }}
      >
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
          onUploadImage={async (file) => {
            try {
              await handleUploadImage(file)
            } catch (cause) {
              // 上传失败不影响画布；用浏览器原生提示告知用户（轻量、无需新增 toast 体系）。
              window.alert(`图片上传失败：${cause instanceof Error ? cause.message : String(cause)}`)
            }
          }}
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
        <div className="csWorkflowBar">
          <div className="csWorkflowMode" role="group" aria-label="执行模式">
            <button
              type="button"
              className={workflow?.mode !== 'auto' ? 'csActive' : ''}
              onClick={() => { handleSetMode('confirm') }}
            >
              逐步确认
            </button>
            <button
              type="button"
              className={workflow?.mode === 'auto' ? 'csActive' : ''}
              onClick={() => { handleSetMode('auto') }}
            >
              放手跑
            </button>
          </div>
          <span className="csWorkflowState">
            {workflow?.state === 'awaiting_approval' ? '等待批准' : workflow?.state === 'executing' ? '制作中' : '需求沟通中'}
          </span>
          {workflow?.state === 'awaiting_approval' && (
            <div className="csWorkflowApproval">
              <span className="csWorkflowMessage">分镜表已提交到画布，请确认后批准</span>
              <button type="button" className="csPrimary" onClick={handleApprove}>批准并开始制作</button>
              <button type="button" onClick={handleReject}>驳回，继续修改</button>
              <span className="csWorkflowState">批准后在对话中发送「继续」恢复流程</span>
            </div>
          )}
        </div>
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
          onUpdateNode={handleUpdateNode}
          onReferenceToChat={handleReferenceToChat}
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