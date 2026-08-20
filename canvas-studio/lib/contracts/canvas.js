/**
 * Shared canvas-node wire types for the Canvas Studio host persistence and the
 * browser client. Pure types only: both halves import them and erase them at
 * build time, so this file never appears in the runtime bundles.
 *
 * The shape mirrors the WL-AI-Director `LayerData` model (see plan §7.2) but is
 * trimmed to the fields Canvas Studio actually renders: a node is one captured
 * generation result (image/video) or a manual annotation (sticky/text/prompt).
 * Bloodline is derived from `sourceIds` at render time — there is no separate
 * edge table (plan §7.3: bloodline IS the edge).
 */
/** Current canvas document version. */
export const CANVAS_DOCUMENT_VERSION = 1;
