/**
 * Canvas Studio browser API: same-origin fetch helpers over the project
 * registry routes (the community-market client fetch pattern).
 */
import type { StudioProject } from '../contracts/project.js';
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
/** A generated media asset returned by the Host. */
export interface GenerateResult {
    url: string;
    width: number;
    height: number;
    duration?: number;
}
/**
 * Ask the Host to generate a media asset for a project and return its
 * webServer-hosted URL. The Host owns the external API call and disk write.
 */
export declare function generateAsset(projectId: string, tool: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<GenerateResult>;
