/**
 * Canvas Studio browser API: same-origin fetch helpers over the project
 * registry and canvas routes (the community-market client fetch pattern).
 */
import type { StudioProject } from '../contracts/project.js';
import type { StudioCanvasNode, StudioCanvasView } from '../contracts/canvas.js';
import type { GenerateParams } from '../generate.js';
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
/** Load a project's persisted canvas (nodes + viewport; view is null pre-v3). */
export declare function loadStudioCanvas(projectId: string, signal?: AbortSignal): Promise<{
    nodes: StudioCanvasNode[];
    view: StudioCanvasView | null;
}>;
/** Persist a project's full canvas node list plus the current viewport state. */
export declare function saveStudioCanvas(projectId: string, nodes: readonly StudioCanvasNode[], view: StudioCanvasView, signal?: AbortSignal): Promise<void>;
/**
 * 节点级重试 / 修改提示词：按原参数（可带 overrides）重新请求 Host 生成，
 * 并把结果写回原节点（retryOf，不产生新边）。成功后返回新的产物 URL。
 */
export declare function retryStudioNode(projectId: string, node: StudioCanvasNode, overrides?: Partial<GenerateParams>, signal?: AbortSignal): Promise<{
    url: string;
}>;
