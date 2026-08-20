/**
 * Canvas Studio webServer routes: the project registry HTTP face consumed by
 * the browser client, plus the P3 media-generation and asset-serving faces.
 * Reads require a local loopback request; mutations add a same-origin
 * requirement (the established community-market pattern).
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { BlockList, isIP } from 'node:net'
import { extname, join, sep } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { StudioProject } from './contracts/project.js'
import type { StudioCanvasNode } from './contracts/canvas.js'
import type { ProjectRegistry } from './projects.js'
import { generateAsset, type GenerateParams } from './generate.js'

const ROUTE_PROJECTS = '/canvas-studio/projects'
const ROUTE_GENERATE = '/canvas-studio/generate'
const ROUTE_ASSETS = '/canvas-studio/assets'
const ROUTE_CANVAS = '/canvas-studio/canvas'
const MAX_BODY_BYTES = 16 * 1024 * 1024
const MAX_CANVAS_NODES = 2000

const loopbackAddresses = new BlockList()
loopbackAddresses.addSubnet('127.0.0.0', 8, 'ipv4')
loopbackAddresses.addSubnet('::1', 128, 'ipv6')

interface StudioRequestContext {
  readonly remoteAddress: string | undefined
  readonly origin: string | undefined
  readonly host: string | undefined
  readonly secFetchSite?: string | undefined
  readonly expectedPort: number
}

/** The request's local authority when it arrives from the loopback device. */
function studioAuthority(context: StudioRequestContext): URL | undefined {
  if (context.remoteAddress === undefined || context.host === undefined) return undefined
  const address = context.remoteAddress.replace(/^\[|\]$/gu, '').split('%', 1)[0]!
  const family = isIP(address)
  if (family === 0 || !loopbackAddresses.check(address, family === 4 ? 'ipv4' : 'ipv6')) return undefined
  let authority: URL
  try {
    authority = new URL(`http://${context.host}`)
  } catch {
    return undefined
  }
  if (
    authority.protocol !== 'http:'
    || Number(authority.port || '80') !== context.expectedPort
    || authority.hostname !== '127.0.0.1'
    || context.secFetchSite === 'cross-site'
  ) return undefined
  return authority
}

function requestContext(req: IncomingMessage, expectedPort: number): StudioRequestContext {
  const secFetchSite = req.headers['sec-fetch-site']
  return {
    remoteAddress: req.socket.remoteAddress,
    origin: req.headers.origin,
    host: req.headers.host,
    ...(typeof secFetchSite === 'string' ? { secFetchSite } : {}),
    expectedPort,
  }
}

function requestAllowed(req: IncomingMessage, expectedPort: number): boolean {
  return studioAuthority(requestContext(req, expectedPort)) !== undefined
}

function mutationAllowed(req: IncomingMessage, expectedPort: number): boolean {
  const context = requestContext(req, expectedPort)
  const authority = studioAuthority(context)
  if (authority === undefined || context.origin === undefined) return false
  try {
    const origin = new URL(context.origin)
    return origin.protocol === 'http:' && origin.host === authority.host && origin.pathname === '/'
  } catch {
    return false
  }
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('x-content-type-options', 'nosniff')
  res.end(body)
}

/** Read a bounded JSON request body, rejecting on abort, oversize, or invalid JSON. */
function readJson(req: IncomingMessage, signal: AbortSignal): Promise<unknown> {
  const abortReason = () => signal.reason ?? new DOMException('The operation was aborted', 'AbortError')
  if (signal.aborted) return Promise.reject(abortReason())
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let settled = false
    const cleanup = () => {
      req.off('data', onData)
      req.off('end', onEnd)
      req.off('error', onError)
      req.off('aborted', onRequestAbort)
      signal.removeEventListener('abort', onSignalAbort)
    }
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      callback()
    }
    const onData = (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += buffer.length
      if (size > MAX_BODY_BYTES) {
        const cause = new Error('body too large')
        finish(() => {
          req.destroy(cause)
          reject(cause)
        })
        return
      }
      chunks.push(buffer)
    }
    const onEnd = () => {
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
        finish(() => resolve(value))
      } catch {
        finish(() => reject(new Error('invalid json')))
      }
    }
    const onError = (cause: Error) => finish(() => reject(cause))
    const onRequestAbort = () => finish(() => reject(abortReason()))
    const onSignalAbort = () => finish(() => reject(abortReason()))
    req.on('data', onData)
    req.once('end', onEnd)
    req.once('error', onError)
    req.once('aborted', onRequestAbort)
    signal.addEventListener('abort', onSignalAbort, { once: true })
  })
}

/** Parse a create-project body into a trimmed display name. */
function asProjectName(value: unknown): string {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('请求体必须是 JSON 对象')
  }
  const name = (value as Record<string, unknown>).name
  if (typeof name !== 'string') throw new Error('缺少项目名(name)')
  return name
}

/**
 * Register the canvas-studio project, generation, and asset routes.
 * @param ctx - active Host context (webServer service injected).
 * @param registry - the project registry this plugin owns.
 * @returns the route disposer (all registered routes).
 */
export function registerStudioRoutes(ctx: Context, registry: ProjectRegistry): () => void {
  const expectedPort = ctx.webServer.port
  const routes = [
    ctx.webServer.register({ kind: 'exact', path: ROUTE_PROJECTS, handler: async (req, res) => {
      if (!requestAllowed(req, expectedPort)) {
        sendJson(res, 403, { error: 'canvas-studio request authority rejected' })
        return
      }
      if (req.method === 'GET') {
        try {
          const projects: readonly StudioProject[] = await registry.list()
          if (!res.destroyed) sendJson(res, 200, { projects })
        } catch (cause) {
          if (!res.destroyed) sendJson(res, 500, {
            error: cause instanceof Error ? cause.message : 'project list unavailable',
          })
        }
        return
      }
      if (req.method === 'DELETE') {
        if (!mutationAllowed(req, expectedPort)) {
          sendJson(res, 403, { error: 'canvas-studio delete requires a local same-origin DELETE' })
          return
        }
        const controller = new AbortController()
        const stopWatching = () => {
          req.off('aborted', onRequestAbort)
          res.off('close', onResponseClose)
        }
        const onRequestAbort = () => controller.abort()
        const onResponseClose = () => {
          if (!res.writableEnded) controller.abort()
        }
        req.once('aborted', onRequestAbort)
        res.once('close', onResponseClose)
        try {
          const body = await readJson(req, controller.signal) as { id?: unknown }
          if (typeof body.id !== 'string') {
            sendJson(res, 400, { error: '缺少 id' })
            return
          }
          await registry.removeProject(body.id)
          if (!controller.signal.aborted && !res.destroyed) sendJson(res, 200, { ok: true })
        } catch (cause) {
          if (!controller.signal.aborted && !res.destroyed) {
            sendJson(res, 400, { error: cause instanceof Error ? cause.message : 'project delete failed' })
          }
        } finally {
          stopWatching()
        }
        return
      }
      if (req.method !== 'POST' || !mutationAllowed(req, expectedPort)) {
        sendJson(res, 405, { error: 'project changes require a local same-origin POST' })
        return
      }
      const controller = new AbortController()
      const stopWatching = () => {
        req.off('aborted', onRequestAbort)
        res.off('close', onResponseClose)
      }
      const onRequestAbort = () => controller.abort()
      const onResponseClose = () => {
        if (!res.writableEnded) controller.abort()
      }
      req.once('aborted', onRequestAbort)
      res.once('close', onResponseClose)
      try {
        const name = asProjectName(await readJson(req, controller.signal))
        const project = await registry.create(name)
        if (!controller.signal.aborted && !res.destroyed) sendJson(res, 201, { project })
      } catch (cause) {
        if (!controller.signal.aborted && !res.destroyed) {
          sendJson(res, 400, { error: cause instanceof Error ? cause.message : 'project create failed' })
        }
      } finally {
        stopWatching()
      }
    }}),

    // P3: media generation. The client tool posts the generation request; the
    // Host calls Drama Backend, downloads the asset, writes it to the project's
    // assets/ directory, and returns the webServer-hosted URL.
    ctx.webServer.register({ kind: 'exact', path: ROUTE_GENERATE, handler: async (req, res) => {
      if (!mutationAllowed(req, expectedPort)) {
        sendJson(res, 403, { error: 'canvas-studio generate requires a local same-origin POST' })
        return
      }
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'generate requires POST' })
        return
      }
      const controller = new AbortController()
      const stopWatching = () => {
        req.off('aborted', onRequestAbort)
        res.off('close', onResponseClose)
      }
      const onRequestAbort = () => controller.abort()
      const onResponseClose = () => {
        if (!res.writableEnded) controller.abort()
      }
      req.once('aborted', onRequestAbort)
      res.once('close', onResponseClose)
      try {
        const body = await readJson(req, controller.signal) as {
          tool?: unknown
          projectId?: unknown
          params?: unknown
        }
        if (typeof body.tool !== 'string' || typeof body.projectId !== 'string') {
          sendJson(res, 400, { error: '缺少 tool 或 projectId' })
          return
        }
        const params = (body.params ?? {}) as GenerateParams
        const result = await generateAsset(
          registry,
          body.tool,
          body.projectId,
          params,
          controller.signal,
        )
        if (!controller.signal.aborted && !res.destroyed) sendJson(res, 200, result)
      } catch (cause) {
        if (!controller.signal.aborted && !res.destroyed) {
          sendJson(res, 400, { error: cause instanceof Error ? cause.message : 'generate failed' })
        }
      } finally {
        stopWatching()
      }
    }}),

    // P3: asset serving. The Host writes generated media into each project's
    // assets/ directory; this prefix route streams those files back. Only
    // loopback + same-origin requests are allowed, and path traversal is
    // blocked by verifying the resolved path stays under the project assets dir.
    ctx.webServer.register({ kind: 'prefix', path: ROUTE_ASSETS, handler: async (req, res) => {
      if (!requestAllowed(req, expectedPort)) {
        sendJson(res, 403, { error: 'canvas-studio request authority rejected' })
        return
      }
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'assets only support GET' })
        return
      }
      const requestUrl = new URL(req.url ?? '/', `http://127.0.0.1:${expectedPort}`)
      const relative = decodeURIComponent(requestUrl.pathname.replace(ROUTE_ASSETS, ''))
      const parts = relative.split('/').filter(Boolean)
      if (parts.length !== 2) {
        sendJson(res, 400, { error: 'asset path must be /<projectId>/<file>' })
        return
      }
      const projectId = parts[0]
      const file = parts[1]
      if (!projectId || !file) {
        sendJson(res, 400, { error: 'asset path must be /<projectId>/<file>' })
        return
      }
      const base = registry.assetsDir(projectId)
      const target = join(base, file)
      if (!target.startsWith(base + sep)) {
        sendJson(res, 403, { error: 'forbidden asset path' })
        return
      }
      try {
        const data = await readFile(target)
        const contentType = extname(file).toLowerCase() === '.mp4' ? 'video/mp4' : 'image/png'
        res.statusCode = 200
        res.setHeader('content-type', contentType)
        res.setHeader('cache-control', 'no-store')
        res.setHeader('x-content-type-options', 'nosniff')
        res.end(data)
      } catch {
        sendJson(res, 404, { error: 'asset not found' })
      }
    }}),

    // P4+: canvas persistence. The client saves the project's node list so the
    // canvas survives a restart (plan §7.7). Reads require loopback authority;
    // writes add the same-origin check used by the project routes.
    ctx.webServer.register({ kind: 'exact', path: ROUTE_CANVAS, handler: async (req, res) => {
      if (!requestAllowed(req, expectedPort)) {
        sendJson(res, 403, { error: 'canvas-studio request authority rejected' })
        return
      }
      if (req.method === 'GET') {
        const requestUrl = new URL(req.url ?? '/', `http://127.0.0.1:${expectedPort}`)
        const projectId = requestUrl.searchParams.get('projectId')
        if (!projectId) {
          sendJson(res, 400, { error: '缺少 projectId' })
          return
        }
        try {
          const nodes = await registry.readCanvas(projectId)
          if (!res.destroyed) sendJson(res, 200, { nodes })
        } catch (cause) {
          if (!res.destroyed) sendJson(res, 500, {
            error: cause instanceof Error ? cause.message : 'canvas load unavailable',
          })
        }
        return
      }
      if (req.method !== 'POST' || !mutationAllowed(req, expectedPort)) {
        sendJson(res, 405, { error: 'canvas changes require a local same-origin POST' })
        return
      }
      const controller = new AbortController()
      const stopWatching = () => {
        req.off('aborted', onRequestAbort)
        res.off('close', onResponseClose)
      }
      const onRequestAbort = () => controller.abort()
      const onResponseClose = () => {
        if (!res.writableEnded) controller.abort()
      }
      req.once('aborted', onRequestAbort)
      res.once('close', onResponseClose)
      try {
        const body = await readJson(req, controller.signal) as {
          projectId?: unknown
          nodes?: unknown
        }
        if (typeof body.projectId !== 'string' || !Array.isArray(body.nodes)) {
          sendJson(res, 400, { error: '缺少 projectId 或 nodes' })
          return
        }
        const nodes = body.nodes as StudioCanvasNode[]
        if (nodes.length > MAX_CANVAS_NODES) {
          sendJson(res, 413, { error: 'canvas node count exceeded' })
          return
        }
        await registry.writeCanvas(body.projectId, nodes)
        if (!controller.signal.aborted && !res.destroyed) sendJson(res, 200, { ok: true })
      } catch (cause) {
        if (!controller.signal.aborted && !res.destroyed) {
          sendJson(res, 400, { error: cause instanceof Error ? cause.message : 'canvas save failed' })
        }
      } finally {
        stopWatching()
      }
    }}),
  ]
  return () => {
    for (const dispose of routes) dispose()
  }
}
