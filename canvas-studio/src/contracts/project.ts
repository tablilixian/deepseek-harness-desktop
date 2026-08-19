/**
 * Shared project-record wire types for the Canvas Studio host registry and
 * the browser client. Pure types only: both halves import them and erase
 * them at build time, so this file never appears in the runtime bundles.
 */

/** One Canvas Studio project record. */
export interface StudioProject {
  /** Stable project id (Host-minted UUID). */
  id: string
  /** User-facing project name. */
  name: string
  /** Creation timestamp (ISO 8601). */
  createdAt: string
  /** Last change timestamp (ISO 8601). */
  updatedAt: string
  /** Absolute path of the project directory; assets live under `assets/`. */
  dir: string
}