/**
 * Studio root-frame inject face: the shared store (via the framework's hooks
 * compartment) plus the business callbacks the apply world provides to the
 * frame (plain data and callbacks; no hooks, no ctx).
 */
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots';
import type { ILayout } from '@deepseek-ai/dsh-client-ui-layout/client';
import type { StudioProject } from '../contracts/project.js';
import type { ProjectStoreState } from './project-store.js';
/** Inject face of the studio root registration. */
export interface StudioProjectListInjected {
    hooks: {
        /** The shared studio store (selection, registry, per-project canvas nodes). */
        studio: HostObservable<ProjectStoreState>;
    };
    /** The layout service the frame exposes through the standard layout slot. */
    layout: ILayout;
    /** Re-pull the project registry into the store. */
    refreshProjects(): Promise<void>;
    /** Create a project (registry + disk directory), select it, and open its session. */
    createProject(name: string): Promise<void>;
    /** Select a project and bind the conversation to its workspace session. */
    openProject(project: StudioProject): Promise<void>;
    /** Delete a project (registry record + disk directory + canvas). */
    deleteProject(projectId: string): Promise<void>;
    /** Persist the selected project's canvas node list to the Host. */
    persistCanvas(projectId: string): Promise<void>;
    /** Select a canvas node (null deselects). */
    selectNode(id: string | null): void;
    /** Move one canvas node to a new position. */
    moveNode(projectId: string, id: string, x: number, y: number): void;
    /** Remove a canvas node and its bloodline references. */
    removeNode(projectId: string, id: string): void;
}
