/**
 * Canvas Studio host half: the project registry (durable records under
 * `$DSH_HOME/canvas-studio/`) and its webServer HTTP face. The media tools
 * and asset serving land in P3.
 */
import type { Context } from '@deepseek-ai/cordis';
/** Stable Cordis plugin name matching the bundle patch row. */
export declare const name = "canvas-studio";
/** Services required by the host plugin. */
export declare const inject: string[];
/** Host plugin body: the project registry, its routes, and the media tools. */
export declare function apply(ctx: Context): void;
