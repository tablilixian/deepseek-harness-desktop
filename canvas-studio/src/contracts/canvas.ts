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

/** The kinds of node Canvas Studio can place on the canvas. */
export type StudioCanvasNodeKind = 'image' | 'video' | 'sticky' | 'text' | 'prompt' | 'group'

/**
 * What operation produced a node. Keeps the WL generic values (their edge
 * colors/labels live in CanvasEdges) plus Canvas Studio's own tool semantics;
 * `import`/`drawing` cover manual nodes.
 */
export type StudioCanvasOperationType =
  | 'text-to-image'
  | 'image-to-image'
  | 'text-to-video'
  | 'image-to-video'
  | 'mkr-video'
  | 'style-transfer'
  | 'background-replace'
  | 'expand'
  | 'background-remove'
  | 'variant'
  | 'import'
  | 'drawing'
  | 'storyboard'
  | 'character-sheet'
  | 'scene-concept'
  | 'video-clip'
  | 'video-composite'

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
  /** The operation that produced this node (edge color/label source). */
  operationType?: StudioCanvasOperationType
  /**
   * The generation inputs that produced this node. For agent tools this is the
   * JSON-encoded parameter object, so a node-level retry can replay the exact
   * generation (reference §9.7 semantics; Host `generate.ts` retryOf).
   */
  generationPrompt?: string
  /** 256px LOD thumbnail URL (unused yet; kept for the reference model). */
  thumbnail?: string
  /** Video duration in seconds. */
  duration?: number
  /** Group this node belongs to (group nodes reference children via parentId). */
  parentId?: string
  /** Locked nodes refuse drag/resize. */
  locked?: boolean
  /** Hidden nodes are skipped by rendering, drag, and edge derivation. */
  visible?: boolean
  /** Node opacity 0-1. */
  opacity?: number
  /** Z-order (render order; ties break by createdAt). */
  zIndex?: number
  /** Mirror horizontally (media content only). */
  flipX?: boolean
  /** Mirror vertically (media content only). */
  flipY?: boolean
  /** Transient: generation in flight (never persisted as true). */
  isLoading?: boolean
  /** Transient: generation progress 0-100 (indeterminate bar when absent). */
  progress?: number
  /** Transient: last failure message (never persisted). */
  error?: string
}

/** Canvas persistence document written to `<project>/canvas.json`. */
export interface StudioCanvasDocument {
  /** Bump with a migration when the node shape changes. */
  version: number
  /** All nodes of the project (order is not significant; sort by createdAt). */
  nodes: StudioCanvasNode[]
  /**
   * Persisted viewport + panel state (v3). Absent in older documents; the
   * client falls back to defaults and fits the content instead.
   */
  view?: StudioCanvasView
}

/**
 * Per-project canvas viewport and panel toggles. `x`/`y` are the surface
 * translate (screen space), `scale` the zoom factor (clamped 0.1–5).
 */
export interface StudioCanvasView {
  x: number
  y: number
  scale: number
  layersOpen: boolean
  minimapVisible: boolean
}

/** Current canvas document version (3: persisted viewport/panel state). */
export const CANVAS_DOCUMENT_VERSION = 3

/** Viewport defaults used when a document predates v3 or a field is invalid. */
export const VIEW_DEFAULTS: StudioCanvasView = {
  x: 0,
  y: 0,
  scale: 1,
  layersOpen: true,
  minimapVisible: true,
}

/** Defaults applied when migrating nodes that predate a field. */
export const NODE_DEFAULTS: Readonly<{
  locked: boolean
  visible: boolean
  opacity: number
  flipX: boolean
  flipY: boolean
}> = {
  locked: false,
  visible: true,
  opacity: 1,
  flipX: false,
  flipY: false,
}
