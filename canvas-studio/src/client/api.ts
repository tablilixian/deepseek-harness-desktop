/**
 * Canvas Studio browser API: same-origin fetch helpers over the project
 * registry routes (the community-market client fetch pattern).
 */
import type { StudioProject } from '../contracts/project.js'

/** HTTP facts used to localize safe Client-facing Studio failures. */
export class StudioApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'StudioApiError'
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const value = await response.json() as T & { error?: unknown; code?: unknown }
  if (!response.ok) {
    throw new StudioApiError(
      typeof value.error === 'string' ? value.error : `request failed: ${response.status}`,
      response.status,
      typeof value.code === 'string' ? value.code : undefined,
    )
  }
  return value
}

/** List all registered projects. */
export async function listStudioProjects(signal?: AbortSignal): Promise<readonly StudioProject[]> {
  const response = await readJson<{ projects: readonly StudioProject[] }>(await fetch('/canvas-studio/projects', {
    cache: 'no-store',
    ...(signal === undefined ? {} : { signal }),
  }))
  return response.projects
}

/** Create a project and return its record. */
export async function createStudioProject(name: string, signal?: AbortSignal): Promise<StudioProject> {
  const response = await readJson<{ project: StudioProject }>(await fetch('/canvas-studio/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
    ...(signal === undefined ? {} : { signal }),
  }))
  return response.project
}

/** A generated media asset returned by the Host. */
export interface GenerateResult {
  url: string
  width: number
  height: number
  duration?: number
}

/**
 * Ask the Host to generate a media asset for a project and return its
 * webServer-hosted URL. The Host owns the external API call and disk write.
 */
export async function generateAsset(
  projectId: string,
  tool: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<GenerateResult> {
  const response = await readJson<GenerateResult>(await fetch('/canvas-studio/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tool, projectId, params }),
    ...(signal === undefined ? {} : { signal }),
  }))
  return response
}