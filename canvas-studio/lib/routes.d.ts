import type { Context } from '@deepseek-ai/cordis';
import type { ProjectRegistry } from './projects.js';
/**
 * Register the canvas-studio project routes.
 * @param ctx - active Host context (webServer service injected).
 * @param registry - the project registry this plugin owns.
 * @returns the route disposer (all registered routes).
 */
export declare function registerStudioRoutes(ctx: Context, registry: ProjectRegistry): () => void;
