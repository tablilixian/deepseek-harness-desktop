import { useEffect, useState } from 'react'
import type { InjectFace, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { StudioProjectListInjected } from './contracts.js'
import { nodesOf, selectedNodeOf } from './project-store.js'
import { ProjectList } from './ProjectList.js'
import { CanvasSurface } from './canvas/CanvasSurface.js'
import { CanvasTimeline } from './canvas/CanvasTimeline.js'

/** Studio root frame props: the standard root shares plus the studio inject face. */
export type StudioFrameProps = PropsRuntime<'root'>
  & PropsRenderSlots<'conversation' | 'shell.overlay'>
  & InjectFace<StudioProjectListInjected>

/**
 * Three-column studio frame: project list, canvas surface + review timeline,
 * and the official conversation seat on the right. The sidebar and details
 * seats stay declared (upstream registrants keep their paths) but are not
 * rendered. The canvas shows every captured node of the selected project
 * (image/video/sticky/text/prompt) with bloodline edges; the timeline lets the
 * user review and jump to any node.
 */
export function StudioFrame(props: StudioFrameProps) {
  const { renderSlot, useStudio, refreshProjects, createProject, openProject, deleteProject, persistCanvas, selectNode, moveNode, removeNode } = props
  const projects = useStudio(store => store.projects)
  const selectedProjectId = useStudio(store => store.selectedProjectId)
  const selectedNodeId = useStudio(store => store.selectedNodeId)
  const nodes = useStudio(store => nodesOf(store, store.selectedProjectId))
  const selectedNode = useStudio(store => selectedNodeOf(store))
  const phase = useStudio(store => store.phase)
  const error = useStudio(store => store.error)
  const creating = useStudio(store => store.creating)
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null)

  // 首次挂载即拉取项目列表，无需手动点「刷新」。
  useEffect(() => { void refreshProjects() }, [refreshProjects])

  const handleMove = (id: string, x: number, y: number): void => {
    if (selectedProjectId === null) return
    moveNode(selectedProjectId, id, x, y)
  }
  const handlePersist = (): void => {
    if (selectedProjectId === null) return
    persistCanvas(selectedProjectId)
  }
  const handleDelete = (): void => {
    if (selectedProjectId === null || selectedNodeId === null) return
    removeNode(selectedProjectId, selectedNodeId)
    handlePersist()
  }
  const handleTimelineSelect = (id: string): void => {
    selectNode(id)
    setFocusNodeId(id)
  }

  const canvasBody = ((): React.ReactNode => {
    if (selectedProjectId === null) {
      return <div className="csCanvasEmpty">打开或新建一个项目，开始创作</div>
    }
    if (nodes.length === 0) {
      return <div className="csCanvasEmpty">尚未生成画布内容 —— 在右侧对话让 agent 生成图片或视频</div>
    }
    return (
      <>
        <CanvasSurface
          nodes={nodes}
          selectedNodeId={selectedNodeId}
          onSelectNode={selectNode}
          onMoveNode={handleMove}
          onPersist={handlePersist}
          focusNodeId={focusNodeId}
        />
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
        {selectedNode !== null && (
          <div className="csCanvasToolbar">
            <span className="csCanvasToolbarInfo">
              已选中：{selectedNode.kind}
              {selectedNode.title ? ` · ${selectedNode.title}` : ''}
            </span>
            <button type="button" className="csCanvasToolbarDelete" onClick={handleDelete}>删除节点</button>
          </div>
        )}
        {canvasBody}
      </main>
      <section className="csConversation">
        {renderSlot('conversation', {})}
      </section>
      <div className="csOverlay" data-cs-overlay>
        {renderSlot('shell.overlay', {})}
      </div>
    </div>
  )
}
