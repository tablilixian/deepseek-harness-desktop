/**
 * Canvas Studio browser API: same-origin fetch helpers over the project
 * registry and canvas routes (the community-market client fetch pattern).
 */
import type { StudioProject } from '../contracts/project.js'
import type { StudioCanvasNode } from '../contracts/canvas.js'

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

/** Delete a project by id (removes its directory and registry record). */
export async function deleteStudioProject(id: string, signal?: AbortSignal): Promise<void> {
  await readJson<{ ok: boolean }>(await fetch('/canvas-studio/projects', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id }),
    ...(signal === undefined ? {} : { signal }),
  }))
}

/**
 * 把历史节点里写死的 `http://127.0.0.1:<port>/canvas-studio/...` 绝对 URL 归一化为
 * 同源相对路径。渲染进程与 webServer 同源，相对 URL 自动解析到当前端口，桌面重启
 * 换端口也不会 404（早期版本把端口写死在 URL 里，换端口后已有产物会失效）。
 */
function normalizeCanvasNodes(nodes: readonly StudioCanvasNode[]): StudioCanvasNode[] {
  return nodes.map((node) => {
    if (typeof node.url !== 'string') return node
    const rewritten = node.url.replace(/^https?:\/\/127\.0\.0\.1:\d+(\/canvas-studio\/.*)$/, '$1')
    return rewritten === node.url ? node : { ...node, url: rewritten }
  })
}

/** Load a project's persisted canvas nodes (empty list when none). */
export async function loadStudioCanvas(projectId: string, signal?: AbortSignal): Promise<readonly StudioCanvasNode[]> {
  const response = await readJson<{ nodes: readonly StudioCanvasNode[] }>(
    await fetch(`/canvas-studio/canvas?projectId=${encodeURIComponent(projectId)}`, {
      cache: 'no-store',
      ...(signal === undefined ? {} : { signal }),
    }),
  )
  return normalizeCanvasNodes(response.nodes)
}

/** Persist a project's full canvas node list. */
export async function saveStudioCanvas(projectId: string, nodes: readonly StudioCanvasNode[], signal?: AbortSignal): Promise<void> {
  await readJson<{ ok: boolean }>(await fetch('/canvas-studio/canvas', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ projectId, nodes }),
    ...(signal === undefined ? {} : { signal }),
  }))
}