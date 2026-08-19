/**
 * Studio frame styles, injected as one style element tagged with the plugin
 * id (the client-modules owner tagging pattern). Product copy lives in the
 * components; this file only carries presentation.
 */
const STUDIO_STYLES = `
.csFrame {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 440px;
  height: 100%;
  background: var(--dsw-bg, #ffffff);
  color: var(--dsw-fg, #1f2328);
}

.csProjects {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-right: 1px solid color-mix(in srgb, currentColor 12%, transparent);
  overflow-y: auto;
}

.csProjectsHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 600;
}

.csProjectsHeader button {
  font: inherit;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
  background: transparent;
  cursor: pointer;
}

.csProjectsHeader button:disabled {
  opacity: 0.5;
  cursor: default;
}

.csProjectsEmpty {
  color: color-mix(in srgb, currentColor 55%, transparent);
  font-size: 13px;
  padding: 24px 8px;
  text-align: center;
}

.csCanvas {
  position: relative;
  overflow: hidden;
  background: color-mix(in srgb, currentColor 3%, transparent);
}

.csCanvasEmpty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: color-mix(in srgb, currentColor 45%, transparent);
}

.csConversation {
  position: relative;
  min-width: 0;
  border-left: 1px solid color-mix(in srgb, currentColor 12%, transparent);
}

.csOverlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 40;
}

.csOverlay > * {
  pointer-events: auto;
}
`

/** Inject the studio stylesheet once per browser lifetime. */
export function installStudioStyles(): () => void {
  const element = document.createElement('style')
  element.setAttribute('data-plugin', 'canvas-studio')
  element.textContent = STUDIO_STYLES
  document.head.appendChild(element)
  return () => { element.remove() }
}