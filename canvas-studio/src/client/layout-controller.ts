import type { ILayout } from '@deepseek-ai/dsh-client-ui-layout/client'

/**
 * Studio-owned implementation of the standard panel-action face. The studio
 * frame does not render the sidebar or details columns in P1, so every
 * transition is a no-op until those columns land.
 */
export class StudioLayoutController implements ILayout {
  /** Toggle the sidebar panel (no-op: the studio frame renders no sidebar). */
  toggleSidebar(): void {}

  /** Open the details panel (no-op: the studio frame renders no details column). */
  openDetails(): void {}

  /** Close the details panel (no-op: the studio frame renders no details column). */
  closeDetails(): void {}
}