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

/** The kinds of node Canvas Studio can place on the canvas. */
export type StudioCanvasNodeKind = 'image' | 'video' | 'sticky' | 'text' | 'prompt'

/** One canvas node (a generation result or a manual annotation). */
export interface StudioCanvasNode {
  /** Stable node id (Host/client-minted UUID). */
  id: string
  /** What the node represents. */
  kind: StudioCanvasNodeKind
  /** Media URL for image/video nodes (webServer-hosted asset URL). */
  url?: string
  /** Optional display title. */
  title?: string
  /** Body text for sticky/text/prompt nodes. */
  text?: string
  /** Canvas-space top-left position. */
  x: number
  y: number
  /** Rendered box size (canvas-space). */
  width: number
  height: number
  /** Creation timestamp (epoch millis). */
  createdAt: number
  /** Producing tool name (image_generate / video_generate / video_composite). */
  toolName?: string
  /** The `tool/call` event id that produced this node (retry anchor). */
  runId?: string
  /** Where the node came from: an agent tool call or a manual action. */
  origin: 'agent' | 'manual'
  /** Bloodline: ids of the nodes this node was derived from. */
  sourceIds: string[]
}

/** Canvas persistence document written to `<project>/canvas.json`. */
export interface StudioCanvasDocument {
  /** Bump with a migration when the node shape changes. */
  version: number
  /** All nodes of the project (order is not significant; sort by createdAt). */
  nodes: StudioCanvasNode[]
}

/** Current canvas document version. */
export const CANVAS_DOCUMENT_VERSION = 1
