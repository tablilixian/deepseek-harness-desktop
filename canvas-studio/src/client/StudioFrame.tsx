import type { PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ILayout } from '@deepseek-ai/dsh-client-ui-layout/client'

/** Studio root frame props: the standard root shares plus the studio layout face. */
export type StudioFrameProps = PropsRuntime<'root'>
  & PropsRenderSlots<'conversation' | 'shell.overlay'>
  & { layout: ILayout }

/**
 * Three-column studio frame: project list, canvas surface, and the official
 * conversation seat on the right. The sidebar and details seats stay
 * declared (upstream registrants keep their paths) but are not rendered.
 */
export function StudioFrame({ renderSlot }: StudioFrameProps) {
  return (
    <div className="csFrame">
      <aside className="csProjects">
        <header className="csProjectsHeader">
          <span>项目</span>
          <button type="button" disabled>新建项目</button>
        </header>
        <div className="csProjectsEmpty">
          项目列表将在后续阶段提供
        </div>
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