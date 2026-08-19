import { ProjectRegistry } from './projects.js';
import { registerStudioRoutes } from './routes.js';
/** Stable Cordis plugin name matching the bundle patch row. */
export const name = 'canvas-studio';
/** Services required by the host plugin. */
export const inject = ['webServer'];
/** Host plugin body: the project registry and its routes. */
export function apply(ctx) {
    const registry = new ProjectRegistry();
    ctx.effect(() => registerStudioRoutes(ctx, registry), 'canvas-studio: project routes');
}
