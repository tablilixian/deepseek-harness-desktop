/**
 * Pure canvas-view helpers shared by the Host persistence layer and the
 * browser store: viewport validation for `canvas.json` v3 documents and the
 * overlap-free auto-arrange grid. Kept free of runtime imports so the Host
 * tsc emit (`lib/canvas-view.js`) is directly testable under `node --test`.
 */
import type { StudioCanvasNode, StudioCanvasView } from './contracts/canvas.js';
/** Zoom clamp range (matches the surface wheel/zoom clamp). */
export declare const MIN_VIEW_SCALE = 0.1;
export declare const MAX_VIEW_SCALE = 5;
/** Clamp a zoom factor into the supported range. */
export declare function clampViewScale(scale: number): number;
/**
 * Coerce an unknown parsed `view` value into a safe viewport. Returns
 * `undefined` when the value is absent or not an object, so callers can
 * distinguish "no saved view" (fit content instead) from a default one.
 * Invalid individual fields fall back to their defaults; scale is clamped.
 */
export declare function normalizeCanvasView(value: unknown): StudioCanvasView | undefined;
/**
 * P9.1 时间轴的有效顺序：优先持久化的 `timeline`（自动剔除已删除的节点 id），
 * 没入过列的节点（新建/旧文档）按 createdAt 追加在后。纯函数 —— Host 单测
 * 可直接跑，客户端渲染与 compose 的 clipIds 都以它为准。
 */
export declare function deriveTimelineOrder(nodes: readonly StudioCanvasNode[], timeline: readonly string[] | undefined): StudioCanvasNode[];
/**
 * Compute the auto-arrange layout: an overlap-free grid over top-level units
 * (nodes without a live parent), ordered by bloodline depth then creation
 * time. Group nodes travel with their children (relative offsets inside the
 * group are preserved), so a group's box keeps wrapping its members and no
 * two boxes can overlap regardless of user-resized sizes.
 * @returns the new canvas-space position per moved node id.
 */
export declare function computeArrangeLayout(nodes: readonly StudioCanvasNode[]): Map<string, {
    x: number;
    y: number;
}>;
