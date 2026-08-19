import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type { StudioProject } from '../contracts/project.js'
import { createStudioProject, listStudioProjects } from './api.js'
import { StudioLayoutController } from './layout-controller.js'
import { createProjectStore } from './project-store.js'
import { installStudioStyles } from './styles.js'
import { StudioFrame } from './StudioFrame.js'

/** Services required before the studio frame can mount. */
export const inject = ['slots', 'workspaces']

/**
 * Client plugin body: provide the standard ctx.layout contract (owned by the
 * disabled ui-layout row) and register the studio frame into the runtime's
 * built-in root slot, declaring the standard child seats so the upstream
 * sidebar/conversation/details plugins keep their registration paths.
 *
 * Project switching binds the conversation to the project's workspace: each
 * project owns one workspace registered at its disk directory, and opening a
 * project connects (reusing a blank session) and navigates to it.
 * @param ctx - active browser Cordis context.
 */
export function apply(ctx: ClientContext): void {
  // The desktop advanced shell owns the root slot with its own children
  // declarations; the studio frame is a compatibility-mode surface, so the
  // desktop's advanced frame keeps the desktop presentation unchanged.
  const params = new URLSearchParams(window.location.search)
  if (params.get('dsh-desktop-mode') === 'advanced') {
    ctx.logger.warn(
      'canvas-studio: advanced desktop mode keeps the desktop frame; switch the desktop profile to compatibility mode to use the studio layout',
    )
    return
  }
  const layout = new StudioLayoutController()
  ctx.effect(() => installStudioStyles(), 'canvas-studio: studio styles')
  ctx.effect(() => {
    const disposeService = ctx.reflect.provide('layout', layout)
    const disposeRegistration = ctx.slots.register({
      name: 'root',
      children: {
        'sidebar': { kind: 'single', scope: 'root' },
        'conversation': { kind: 'single', scope: 'session-maybe' },
        'details': { kind: 'single', scope: 'session' },
        'shell.overlay': { kind: 'list', scope: 'root' },
      },
      store: createProjectStore,
      inject: ({ select, setPhase, setLoaded, setFailed, setCreating }) => {
        const refreshProjects = async (): Promise<void> => {
          setPhase('loading')
          try {
            setLoaded(await listStudioProjects())
          } catch (cause) {
            setFailed(cause instanceof Error ? cause.message : '项目列表加载失败')
          }
        }
        const openProject = async (project: StudioProject): Promise<void> => {
          select(project.id)
          try {
            // workspace.create resolves an existing registration by path, so
            // binding is idempotent; the returned workspace is then in the
            // runtime list and the shared New Session action can navigate.
            const workspace = await ctx.workspaces.create({ path: project.dir })
            ctx.workspaces.startSession(workspace.workspaceId)
          } catch (cause) {
            setFailed(cause instanceof Error ? cause.message : '项目会话绑定失败')
          }
        }
        const createProject = async (name: string): Promise<void> => {
          setCreating(true)
          try {
            const project = await createStudioProject(name)
            await refreshProjects()
            await openProject(project)
          } catch (cause) {
            setFailed(cause instanceof Error ? cause.message : '项目创建失败')
          } finally {
            setCreating(false)
          }
        }
        return {
          layout,
          refreshProjects,
          createProject,
          openProject,
        }
      },
    }, StudioFrame)
    return () => {
      disposeRegistration()
      void disposeService()
    }
  }, 'canvas-studio: layout service + studio root frame')
}