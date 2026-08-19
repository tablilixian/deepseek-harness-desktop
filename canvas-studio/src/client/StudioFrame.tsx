import { useEffect } from 'react'
import type { PropsRenderSlots, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { ILayout } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { StudioProjectListInjected } from './contracts.js'
import type { createProjectStore } from './project-store.js'
import { ProjectList } from './ProjectList.js'

/** Studio root frame props: the standard root shares plus the studio layout face. */
export type StudioFrameProps = PropsRuntime<'root'>
  & PropsRenderSlots<'conversation' | 'shell.overlay'>
  & PropsStore<ReturnType<typeof createProjectStore>>
  & StudioProjectListInjected
  & { layout: ILayout }

/**
 * Three-column studio frame: project list, canvas surface, and the official
 * conversation seat on the right. The sidebar and details seats stay
 * declared (upstream registrants keep their paths) but are not rendered.
 */
export function StudioFrame(props: StudioFrameProps) {
  const { renderSlot, useStore, refreshProjects, createProject, openProject } = props
  const projects = useStore(store => store.projects)
  const selectedProjectId = useStore(store => store.selectedProjectId)
  const phase = useStore(store => store.phase)
  const error = useStore(store => store.error)
  const creating = useStore(store => store.creating)
  useEffect(() => {
    void refreshProjects().catch((error: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[canvas-studio] refreshProjects failed on mount:', error)
    })
  }, [refreshProjects])
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
        />
      </aside>
      <main className="csCanvas">
        <div className="csCanvasEmpty">
          画布将在后续阶段提供
        </div>
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