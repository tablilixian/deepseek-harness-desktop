/**
 * Canvas Studio host half: the project registry (durable records under
 * `$DSH_HOME/canvas-studio/`) and its webServer HTTP face. The media tools
 * and asset serving land in P3.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { ProjectRegistry } from './projects.js'
import { registerStudioRoutes } from './routes.js'

/** Stable Cordis plugin name matching the bundle patch row. */
export const name = 'canvas-studio'

/** Services required by the host plugin. */
export const inject = ['webServer']

/** Host plugin body: the project registry and its routes. */
export function apply(ctx: Context): void {
  const registry = new ProjectRegistry()
  ctx.effect(() => registerStudioRoutes(ctx, registry), 'canvas-studio: project routes')
}