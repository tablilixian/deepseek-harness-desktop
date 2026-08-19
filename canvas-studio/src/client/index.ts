import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { StudioLayoutController } from './layout-controller.js'
import { installStudioStyles } from './styles.js'
import { StudioFrame } from './StudioFrame.js'

/** Services required before the studio frame can mount. */
export const inject = ['slots']

/**
 * Client plugin body: provide the standard ctx.layout contract (owned by the
 * disabled ui-layout row) and register the studio frame into the runtime's
 * built-in root slot, declaring the standard child seats so the upstream
 * sidebar/conversation/details plugins keep their registration paths.
 * @param ctx - active browser Cordis context.
 */
export function apply(ctx: ClientContext): void {
  // The desktop advanced shell owns the root slot with its own children
  // declarations; the studio frame is a compatibility-mode surface, so the
  // desktop's advanced frame keeps the desktop presentation unchanged.
  const params = new URLSearchParams(window.location.search)
  if (params.get('dsh-desktop-mode') === 'advanced') {
    ctx.logger.warn(
      'canvas-studio: advanced desktop mode keeps the desktop frame; switch the desktop profile to compatibility mode to use the studio layout',
    )
    return
  }
  const layout = new StudioLayoutController()
  ctx.effect(() => installStudioStyles(), 'canvas-studio: studio styles')
  ctx.effect(() => {
    const disposeService = ctx.reflect.provide('layout', layout)
    const disposeRegistration = ctx.slots.register({
      name: 'root',
      children: {
        'sidebar': { kind: 'single', scope: 'root' },
        'conversation': { kind: 'single', scope: 'session-maybe' },
        'details': { kind: 'single', scope: 'session' },
        'shell.overlay': { kind: 'list', scope: 'root' },
      },
      inject: () => ({ layout }),
    }, StudioFrame)
    return () => {
      disposeRegistration()
      void disposeService()
    }
  }, 'canvas-studio: layout service + studio root frame')
}