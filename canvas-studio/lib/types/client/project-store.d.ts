/**
 * Project-list viewing store: the registry snapshot plus the current
 * selection. Reads happen through the framework-bound `useStore`; writes
 * through the declared actions only (async fetching lives in the apply-world
 * inject callbacks, which commit through these actions).
 */
import { type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client';
import type { StudioProject } from '../contracts/project.js';
/** Project-list store state. */
export interface ProjectStoreState {
    projects: readonly StudioProject[];
    selectedProjectId: string | null;
    phase: 'idle' | 'loading' | 'error';
    error: string | null;
    creating: boolean;
}
/** Annotation twin of the actions literal below. */
export type ProjectStoreActions = {
    setPhase: (draft: ProjectStoreState, phase: ProjectStoreState['phase']) => void;
    setLoaded: (draft: ProjectStoreState, projects: readonly StudioProject[]) => void;
    setFailed: (draft: ProjectStoreState, error: string) => void;
    select: (draft: ProjectStoreState, projectId: string | null) => void;
    setCreating: (draft: ProjectStoreState, creating: boolean) => void;
};
/**
 * Create the project-list store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export declare function createProjectStore(): EngineStoreHandle<ProjectStoreState, ProjectStoreActions>;
