/**
 * Studio root-frame inject face: the business callbacks the apply world
 * provides to the frame (plain data and callbacks; no hooks, no ctx).
 */
import type { StudioProject } from '../contracts/project.js'

/** Inject face of the studio root registration. */
export interface StudioProjectListInjected {
  /** Re-pull the project registry into the store. */
  refreshProjects(): Promise<void>
  /** Create a project (registry + disk directory), select it, and open its session. */
  createProject(name: string): Promise<void>
  /** Select a project and bind the conversation to its workspace session. */
  openProject(project: StudioProject): Promise<void>
}