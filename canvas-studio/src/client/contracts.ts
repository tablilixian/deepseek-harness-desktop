/**
 * Studio root-frame inject face: the shared store (via the framework's hooks
 * compartment) plus the business callbacks the apply world provides to the
 * frame (plain data and callbacks; no hooks, no ctx).
 */
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { ILayout } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { EngineStoreInstance } from '@deepseek-ai/dsh-client-runtime/client'
import type { StudioProject } from '../contracts/project.js'
import type { ProjectStoreActions, ProjectStoreState } from './project-store.js'

/** The store instance's bound actions (draft stripped by the runtime). */
export type StudioActions = EngineStoreInstance<ProjectStoreState, ProjectStoreActions>['actions']

/** Inject face of the studio root registration. */
export interface StudioProjectListInjected {
  hooks: {
    /** The shared studio store (selection, registry, per-project canvas nodes). */
    studio: HostObservable<ProjectStoreState>
  }
  /** The layout service the frame exposes through the standard layout slot. */
  layout: ILayout
  /**
   * All declared store actions, bound to the shared instance. Components write
   * through these; the apply world owns async fetch/persist orchestration.
   */
  actions: StudioActions
  /** Re-pull the project registry into the store. */
  refreshProjects(): Promise<void>
  /** Create a project (registry + disk directory), select it, and open its session. */
  createProject(name: string): Promise<void>
  /** Select a project and bind the conversation to its workspace session. */
  openProject(project: StudioProject): Promise<void>
  /** Delete a project (registry record + disk directory + canvas). */
  deleteProject(projectId: string): Promise<void>
  /** Persist the selected project's canvas node list to the Host. */
  persistCanvas(projectId: string): Promise<void>
  /** 按原生成参数重试一个节点（写回原节点，不产生新边）。 */
  retryNode(projectId: string, nodeId: string): Promise<void>
  /** 修改提示词后重新生成该节点（原地更新）。 */
  steerNode(projectId: string, nodeId: string, prompt: string): Promise<void>
  /** 打断当前会话的运行中回合（stop 生成）。 */
  cancelCurrentTurn(): Promise<void>
}