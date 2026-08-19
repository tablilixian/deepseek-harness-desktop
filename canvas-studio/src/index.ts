/**
 * Canvas Studio host half: the project registry (durable records under
 * `$DSH_HOME/canvas-studio/`) and its webServer HTTP face. The media tools
 * and asset serving land in P3.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { ProjectRegistry } from './projects.js'
import { registerStudioRoutes } from './routes.js'
import { createStudioTools } from './host-tools.js'

/** Stable Cordis plugin name matching the bundle patch row. */
export const name = 'canvas-studio'

/** Services required by the host plugin. */
export const inject = ['webServer', 'tools']

/** Host plugin body: the project registry, its routes, and the media tools. */
export function apply(ctx: Context): void {
  const registry = new ProjectRegistry()
  const port = ctx.webServer.port
  ctx.effect(() => registerStudioRoutes(ctx, registry), 'canvas-studio: project routes')
  // Media generation tools register on the Host (the `tools` service is
  // Host-only); each tool resolves its project from the session workspace.
  ctx.effect(() => {
    const disposers = createStudioTools(registry, port).map((definition) => ctx.tools.register(definition))
    return () => { for (const dispose of disposers) dispose() }
  }, 'canvas-studio: media generation tools')
}