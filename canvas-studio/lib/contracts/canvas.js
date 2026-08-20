/**
 * Shared canvas-node wire types for the Canvas Studio host persistence and the
 * browser client. Pure types only: both halves import them and erase them at
 * build time, so this file never appears in the runtime bundles.
 *
 * The shape mirrors the WL-AI-Director `LayerData` model (see plan §7.2 and
 * docs/plans/canvas-studio-reference-integration.md S1) extended with the
 * fields Canvas Studio renders: visual state (locked/visible/opacity/zIndex),
 * generation provenance (operationType/generationPrompt/duration), transient
 * generation state (isLoading/progress/error), and grouping (parentId).
 * Bloodline is derived from `sourceIds` at render time — there is no separate
 * edge table (plan §7.3: bloodline IS the edge).
 */
/** Current canvas document version (2: S1 node-model extension). */
export const CANVAS_DOCUMENT_VERSION = 2;
/** Defaults applied when migrating nodes that predate a field. */
export const NODE_DEFAULTS = {
    locked: false,
    visible: true,
    opacity: 1,
    flipX: false,
    flipY: false,
};
