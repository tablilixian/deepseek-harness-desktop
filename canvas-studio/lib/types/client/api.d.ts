/**
 * Canvas Studio browser API: same-origin fetch helpers over the project
 * registry and canvas routes (the community-market client fetch pattern).
 */
import type { StudioProject } from '../contracts/project.js';
import type { StudioCanvasNode } from '../contracts/canvas.js';
/** HTTP facts used to localize safe Client-facing Studio failures. */
export declare class StudioApiError extends Error {
    readonly status: number;
    readonly code?: string | undefined;
    constructor(message: string, status: number, code?: string | undefined);
}
/** List all registered projects. */
export declare function listStudioProjects(signal?: AbortSignal): Promise<readonly StudioProject[]>;
/** Create a project and return its record. */
export declare function createStudioProject(name: string, signal?: AbortSignal): Promise<StudioProject>;
/** Delete a project by id (removes its directory and registry record). */
export declare function deleteStudioProject(id: string, signal?: AbortSignal): Promise<void>;
/** Load a project's persisted canvas nodes (empty list when none). */
export declare function loadStudioCanvas(projectId: string, signal?: AbortSignal): Promise<readonly StudioCanvasNode[]>;
/** Persist a project's full canvas node list. */
export declare function saveStudioCanvas(projectId: string, nodes: readonly StudioCanvasNode[], signal?: AbortSignal): Promise<void>;
