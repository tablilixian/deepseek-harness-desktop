/**
 * Canvas Studio host half. P1 ships the composition only: the row exists so
 * the profile layer and the browser client-module graph can mount. Project
 * registry, asset serving, and the media tools land in P2/P3.
 */
import type { Context } from '@deepseek-ai/cordis';
/** Stable Cordis plugin name matching the bundle patch row. */
export declare const name = "canvas-studio";
/** Services required by the host plugin. */
export declare const inject: string[];
/** Host plugin body: nothing to mount before the project registry (P2). */
export declare function apply(_ctx: Context): void;
