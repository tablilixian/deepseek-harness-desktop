/**
 * Canvas Studio webServer routes: the project registry HTTP face consumed by
 * the browser client. Reads require a local loopback request; mutations add a
 * same-origin requirement (the established community-market pattern).
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { BlockList, isIP } from 'node:net'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { StudioProject } from './contracts/project.js'
import type { ProjectRegistry } from './projects.js'

const ROUTE_PROJECTS = '/canvas-studio/projects'
const MAX_BODY_BYTES = 16 * 1024

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
    const onRequestAbort = () => finish(() => reject(new DOMException('The request was aborted', 'AbortError')))
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
 * Register the canvas-studio project routes.
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
  ]
  return () => {
    for (const dispose of routes) dispose()
  }
}