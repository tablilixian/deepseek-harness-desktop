import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type { StudioCanvasNode } from '../contracts/canvas.js'
import type { StudioProject } from '../contracts/project.js'
import { createAssetCaptureDefinition } from '../asset-capture.js'
import { createStudioProject, deleteStudioProject, listStudioProjects, loadStudioCanvas, saveStudioCanvas } from './api.js'
import { StudioLayoutController } from './layout-controller.js'
import { createProjectStore } from './project-store.js'
import { installStudioStyles } from './styles.js'
import { StudioFrame } from './StudioFrame.js'

/**
 * Services required before the studio frame can mount.
 *
 * 注意：`tools` 是 Host 专属服务，客户端没有该服务。媒体生成工具已在 Host
 * 侧（`src/host-tools.ts`）注册，客户端只负责 UI、项目/工作区绑定，以及
 * 通过 `conversationEvents` 捕获工具产物到画布 store（P4），并把画布节点
 * 持久化到 Host（P4+ 重启恢复）。
 */
export const inject = ['slots', 'workspaces', 'conversationEvents']

/** Dev-only seed sample media so the canvas is verifiable without a backend. */
const SEED_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="260" height="180">'
  + '<rect width="100%" height="100%" fill="#4285f4"/>'
  + '<text x="50%" y="50%" fill="white" font-size="18" text-anchor="middle" dominant-baseline="middle">种子示例图</text>'
  + '</svg>',
)}`
const SEED_VIDEO = 'https://example.invalid/canvas-studio-seed/sample.mp4'

/**
 * Build dev-seed nodes for a project: an image, a video derived from it
 * (bloodline edge), and a sticky note — enough to exercise every node kind,
 * the edge renderer, and the timeline without a live Drama Backend.
 */
function seedNodes(): StudioCanvasNode[] {
  const now = Date.now()
  return [
    {
      id: 'seed-image',
      kind: 'image',
      url: SEED_IMAGE,
      title: '示例图',
      x: 40,
      y: 40,
      width: 260,
      height: 180,
      createdAt: now,
      origin: 'manual',
      sourceIds: [],
    },
    {
      id: 'seed-video',
      kind: 'video',
      url: SEED_VIDEO,
      title: '示例视频',
      x: 340,
      y: 40,
      width: 260,
      height: 180,
      createdAt: now + 1,
      origin: 'manual',
      sourceIds: ['seed-image'],
    },
    {
      id: 'seed-sticky',
      kind: 'sticky',
      text: '种子便签：演示文本 / 提示节点与画布交互',
      x: 40,
      y: 300,
      width: 220,
      height: 140,
      createdAt: now + 2,
      origin: 'manual',
      sourceIds: [],
    },
  ]
}

/**
 * Client plugin body: provide the standard ctx.layout contract (owned by the
 * disabled ui-layout row) and register the studio frame into the runtime's
 * built-in root slot, declaring the standard child seats so the upstream
 * sidebar/conversation/details plugins keep their registration paths.
 *
 * Project switching binds the conversation to the project's workspace: each
 * project owns one workspace registered at its disk directory, and opening a
 * project connects (reusing a blank session) and navigates to it. The canvas
 * nodes for that project are loaded (and, with `?cs-dev-seed=1`, seeded) here.
 * @param ctx - active browser Cordis context.
 */
export function apply(ctx: ClientContext): void {
  ctx.logger.info('canvas-studio client v2 loaded')
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
  const devSeed = params.get('cs-dev-seed') === '1'
  const layout = new StudioLayoutController()
  // 唯一的 store 实例：apply 世界（workspace 订阅、capture 回调、openProject）
  // 与 React 组件（经 inject hooks 舱的 useStudio）读写同一个实例。不能再把
  // store 座位交给框架 —— 框架会按 handle×scopeKey 再 create() 一个独立实例，
  // 两个实例互不可见，导致「选中了项目但画布永远空态」。
  const storeInstance = createProjectStore().create()

  // 会话级项目归属：画布应跟随「当前会话绑定的 workspace」，而非仅用户手动点击
  // 的项目行。Host 写入产物时用的是会话 cwd（workspace 目录）解析出的 projectId；
  // 应用重启后会话会自动恢复到某 workspace，但 selectedProjectId 是内存态会丢失，
  // 导致画布显示空态 —— 而产物其实已落在该项目的 canvas.json（这正是「小猪已生成
  // 但画布空白」的根因）。这里把当前 workspace 映射回项目，保持选中态与画布内容一致。
  const resolveActiveProjectId = (): string | null => {
    const manual = storeInstance.getSnapshot().selectedProjectId
    if (manual !== null) return manual
    const snapshot = ctx.workspaces.list.getSnapshot()
    if (!snapshot.baselinesReady) return null
    const recentId = snapshot.recentWorkspaceId
    if (recentId === undefined) return null
    const view = snapshot.items.find((item) => item.workspaceId === recentId)
    if (view === undefined || view.path === undefined) return null
    const project = storeInstance.getSnapshot().projects.find((entry) => entry.dir === view.path)
    return project?.id ?? null
  }
  const syncActiveProject = (): void => {
    const id = resolveActiveProjectId()
    if (id === null) return
    if (storeInstance.getSnapshot().selectedProjectId === id) return
    storeInstance.actions.select(id)
    void (async () => {
      try {
        storeInstance.actions.setNodes(id, await loadStudioCanvas(id))
      } catch {
        /* 载入失败静默：下一次切换 / 重载仍会尝试 */
      }
    })()
  }

  ctx.effect(() => installStudioStyles(), 'canvas-studio: studio styles')
  ctx.effect(() => {
    // P4+：捕获画布工具产物。生成的节点由 Host 在落盘时写入 canvas.json（单一
    // 真相源）；这里只在该项目被选中时触发画布重载，不再依赖解析事件渲染文本
    // 里的 URL（后端异常 / 渲染差异时不可靠）。
    const reloadCanvas = async (projectId: string): Promise<void> => {
      try {
        storeInstance.actions.setNodes(projectId, await loadStudioCanvas(projectId))
      } catch {
        /* 重载失败静默：下一次打开项目仍会载入 */
      }
    }
    const disposeCapture = ctx.conversationEvents.register(createAssetCaptureDefinition({
      reloadCanvas,
      getSelectedProjectId: () => resolveActiveProjectId(),
    }))
    return disposeCapture
  }, 'canvas-studio: reload canvas on generated assets')
  // 会话级归属：当前 workspace 变化（含应用启动恢复会话）时，把画布选中态对齐到
  // 该 workspace 绑定的项目并载入其画布，避免「产物已写盘却显示空态」。
  ctx.effect(() => {
    syncActiveProject()
    return ctx.workspaces.list.subscribe(syncActiveProject)
  }, 'canvas-studio: sync canvas to active workspace')
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
      inject: () => {
        const refreshProjects = async (): Promise<void> => {
          storeInstance.actions.setPhase('loading')
          try {
            storeInstance.actions.setLoaded(await listStudioProjects())
            // 项目列表就绪后，对齐一次「当前 workspace → 项目」选中态。
            syncActiveProject()
          } catch (cause) {
            storeInstance.actions.setFailed(cause instanceof Error ? cause.message : '项目列表加载失败')
          }
        }
        const persistCanvas = async (projectId: string): Promise<void> => {
          await saveStudioCanvas(projectId, storeInstance.getSnapshot().nodes[projectId] ?? [])
        }
        const openProject = async (project: StudioProject): Promise<void> => {
          storeInstance.actions.select(project.id)
          try {
            // workspace.create resolves an existing registration by path, so
            // binding is idempotent; the returned workspace is then in the
            // runtime list and the shared New Session action can navigate.
            const workspace = await ctx.workspaces.create({ path: project.dir })
            // Keep the workspace/session title in sync with the project name
            // so the conversation header matches the project list.
            await ctx.workspaces.rename(workspace.workspaceId, project.name)
            ctx.workspaces.startSession(workspace.workspaceId)
            // P4+：载入持久化画布；dev 模式下若项目为空则注入种子。
            const loaded = await loadStudioCanvas(project.id)
            storeInstance.actions.setNodes(project.id, loaded)
            if (devSeed && loaded.length === 0) {
              const seeded = seedNodes()
              storeInstance.actions.setNodes(project.id, seeded)
              await saveStudioCanvas(project.id, seeded)
            }
          } catch (cause) {
            storeInstance.actions.setFailed(cause instanceof Error ? cause.message : '项目会话绑定失败')
          }
        }
        const createProject = async (name: string): Promise<void> => {
          storeInstance.actions.setCreating(true)
          try {
            const project = await createStudioProject(name)
            await refreshProjects()
            await openProject(project)
          } catch (cause) {
            storeInstance.actions.setFailed(cause instanceof Error ? cause.message : '项目创建失败')
          } finally {
            storeInstance.actions.setCreating(false)
          }
        }
        const deleteProject = async (projectId: string): Promise<void> => {
          try {
            await deleteStudioProject(projectId)
            await refreshProjects()
            if (storeInstance.getSnapshot().selectedProjectId === projectId) {
              storeInstance.actions.select(null)
              storeInstance.actions.clearProject(projectId)
            }
          } catch (cause) {
            storeInstance.actions.setFailed(cause instanceof Error ? cause.message : '项目删除失败')
          }
        }
        return {
          layout,
          refreshProjects,
          createProject,
          openProject,
          deleteProject,
          persistCanvas,
          selectNode: storeInstance.actions.selectNode,
          moveNode: storeInstance.actions.moveNode,
          removeNode: storeInstance.actions.removeNode,
          // 组件经 useStudio 读取同一个实例（hooks 舱绑定为 use<Name>）。
          hooks: { studio: storeInstance },
        }
      },
    }, StudioFrame)
    return () => {
      disposeRegistration()
      void disposeService()
    }
  }, 'canvas-studio: layout service + studio root frame')
}
