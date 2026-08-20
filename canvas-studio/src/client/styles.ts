/**
 * Studio frame styles, injected as one style element tagged with the plugin
 * id (the client-modules owner tagging pattern). Product copy lives in the
 * components; this file only carries presentation.
 */
const STUDIO_STYLES = `
/* Presentation follows the official design system: all colors come from the
 * --dsw-alias-* semantic tokens owned by @deepseek-ai/dsh-client-ui-theme
 * (imported into the web shell base.css). Those tokens resolve to light or
 * dark values via body[data-ds-dark-theme], so this panel adapts to the app
 * theme automatically. Never hardcode colors or use currentColor here. */

.csFrame {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 380px;
  height: 100%;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
}

.csProjects {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-right: 1px solid var(--dsw-alias-border-l2);
  overflow-y: auto;
  color: var(--dsw-alias-label-primary);
  /* Rebind scrollbar to the elevated-surface tokens so it matches the theme. */
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
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
  border: 1px solid var(--dsw-alias-border-l2);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
}

.csProjectsHeader button:disabled {
  opacity: 0.5;
  cursor: default;
}

.csProjectsEmpty {
  color: var(--dsw-alias-label-tertiary);
  font-size: 13px;
  padding: 24px 8px;
  text-align: center;
}

.csProjectList {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.csProjectNew {
  font: inherit;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px dashed var(--dsw-alias-border-l2);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  text-align: left;
}

.csProjectNew:disabled {
  opacity: 0.5;
  cursor: default;
}

.csProjectForm {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 0;
}

.csProjectNameInput {
  font: inherit;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
}

.csProjectFormActions {
  display: flex;
  gap: 6px;
}

.csProjectFormActions button {
  font: inherit;
  flex: 1;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
}

.csProjectFormActions button:disabled {
  opacity: 0.5;
  cursor: default;
}

.csProjectItem {
  font: inherit;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  text-align: left;
}

.csProjectItem:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

.csProjectItemActive {
  border-color: var(--dsw-alias-border-l2);
  background: var(--dsw-alias-interactive-bg-active);
}

.csProjectMeta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}

.csProjectName {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.csProjectDate {
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
}

.csProjectDelete {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 4px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.csProjectDelete:hover:not(:disabled) {
  color: var(--dsw-alias-state-error-primary);
  background: var(--dsw-alias-interactive-bg-hover);
  border-color: var(--dsw-alias-border-l2);
}

.csProjectDelete:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.csProjectError {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  font-size: 13px;
  color: var(--dsw-alias-state-error-primary);
}

.csProjectError button {
  font: inherit;
  align-self: flex-start;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
}

.csCanvas {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background: var(--dsw-alias-bg-base);
}

.csCanvasEmpty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  text-align: center;
  color: var(--dsw-alias-label-tertiary);
}

/* Infinite canvas surface: grid background pans/zooms with the layer. */
.csCanvasSurface {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  background-color: var(--dsw-alias-bg-base);
  background-image:
    linear-gradient(to right, var(--dsw-alias-border-l2) 1px, transparent 1px),
    linear-gradient(to bottom, var(--dsw-alias-border-l2) 1px, transparent 1px);
  background-repeat: repeat;
}

.csCanvasSurface:active {
  cursor: grabbing;
}

.csCanvasLayer {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  will-change: transform;
}

.csEdges {
  position: absolute;
  top: 0;
  left: 0;
  overflow: visible;
  pointer-events: none;
}

.csEdge {
  fill: none;
  stroke: var(--dsw-alias-interactive-bg-active);
  stroke-width: 2;
  opacity: 0.8;
}

.csNode {
  position: absolute;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  overflow: hidden;
  cursor: grab;
  box-shadow: 0 1px 4px rgb(0 0 0 / 12%);
}

.csNode:active {
  cursor: grabbing;
}

.csNodeSelected {
  border-color: var(--dsw-alias-interactive-bg-active);
  box-shadow: 0 0 0 2px var(--dsw-alias-interactive-bg-active);
}

.csNodeMedia {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: var(--dsw-alias-bg-base);
  pointer-events: none;
}

.csNodeText {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.csNodeKind {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary);
}

.csNodeBody {
  margin: 0;
  font-size: 13px;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.csNodeRing {
  position: absolute;
  inset: 0;
  border-radius: 8px;
  pointer-events: none;
}

.csCanvasZoom {
  position: absolute;
  right: 10px;
  bottom: 10px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-bg-base);
  border: 1px solid var(--dsw-alias-border-l2);
  pointer-events: none;
}

.csTimeline {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--dsw-alias-border-l2);
  overflow-x: auto;
  background: var(--dsw-alias-bg-base);
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
}

.csTimelineEmpty {
  border-top: 1px solid var(--dsw-alias-border-l2);
  padding: 10px 12px;
  font-size: 13px;
  color: var(--dsw-alias-label-tertiary);
  background: var(--dsw-alias-bg-base);
}

.csTimelineItem {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 0 0 auto;
  padding: 4px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
}

.csTimelineItem:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

.csTimelineItemActive {
  border-color: var(--dsw-alias-interactive-bg-active);
  background: var(--dsw-alias-interactive-bg-active);
}

.csTimelineThumb {
  display: grid;
  place-items: center;
  width: 96px;
  height: 60px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--dsw-alias-bg-base);
  border: 1px solid var(--dsw-alias-border-l2);
}

.csTimelineThumb img,
.csTimelineThumb video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.csTimelineKind {
  font-size: 13px;
  color: var(--dsw-alias-label-secondary);
}

.csTimelineTime {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary);
}

.csConversation {
  position: relative;
  min-width: 0;
  border-left: 1px solid var(--dsw-alias-border-l2);
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

/* ---- Canvas toolbar (floating strip above the surface) ---- */
.csToolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  z-index: 5;
}

.csToolbarGroup {
  display: flex;
  align-items: center;
  gap: 2px;
  padding-right: 8px;
  margin-right: 4px;
  border-right: 1px solid var(--dsw-alias-border-l2);
}

.csToolbarGroup:last-child {
  border-right: none;
  padding-right: 0;
  margin-right: 0;
}

.csToolbarButton {
  font: inherit;
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  white-space: nowrap;
}

.csToolbarButton:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.csToolbarButton:disabled {
  opacity: 0.4;
  cursor: default;
}

/* ---- Snap alignment guides ---- */
.csGuide {
  position: absolute;
  background: var(--dsw-alias-interactive-bg-active);
  pointer-events: none;
  z-index: 3;
}

.csGuideVertical {
  top: 0;
  bottom: 0;
  width: 1px;
}

.csGuideHorizontal {
  left: 0;
  right: 0;
  height: 1px;
}

/* ---- Node visual states ---- */
.csNodeLocked {
  opacity: 0.75;
  cursor: not-allowed;
}

.csNodeError {
  border-color: var(--dsw-alias-state-error-primary);
}

.csNodeLoading {
  border-style: dashed;
  border-color: var(--dsw-alias-interactive-bg-active);
}

.csNodeMediaBox {
  width: 100%;
  height: 100%;
}

.csNodeGroup {
  display: flex;
  align-items: flex-start;
  padding: 8px;
  height: 100%;
  box-sizing: border-box;
  border: 1px dashed var(--dsw-alias-interactive-bg-active);
  border-radius: 8px;
  background: rgb(99 102 241 / 6%);
}

.csNodeResize {
  position: absolute;
  z-index: 4;
}

.csNodeResizeN {
  top: -4px;
  left: 8px;
  right: 8px;
  height: 8px;
  cursor: ns-resize;
}

.csNodeResizeS {
  bottom: -4px;
  left: 8px;
  right: 8px;
  height: 8px;
  cursor: ns-resize;
}

.csNodeResizeE {
  top: 8px;
  bottom: 8px;
  right: -4px;
  width: 8px;
  cursor: ew-resize;
}

.csNodeResizeW {
  top: 8px;
  bottom: 8px;
  left: -4px;
  width: 8px;
  cursor: ew-resize;
}

.csNodeResizeNW {
  top: -4px;
  left: -4px;
  width: 10px;
  height: 10px;
  cursor: nwse-resize;
}

.csNodeResizeNE {
  top: -4px;
  right: -4px;
  width: 10px;
  height: 10px;
  cursor: nesw-resize;
}

.csNodeResizeSW {
  bottom: -4px;
  left: -4px;
  width: 10px;
  height: 10px;
  cursor: nesw-resize;
}

.csNodeResizeSE {
  bottom: -4px;
  right: -4px;
  width: 10px;
  height: 10px;
  cursor: nwse-resize;
}

.csNodeResizeN, .csNodeResizeS, .csNodeResizeE, .csNodeResizeW {
  opacity: 0;
}

.csNode:hover .csNodeResize,
.csNodeSelected .csNodeResize {
  opacity: 1;
}

.csNodeLinkHandle {
  position: absolute;
  right: -9px;
  top: 50%;
  transform: translateY(-50%);
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--dsw-alias-bg-base);
  background: var(--dsw-alias-interactive-bg-active);
  cursor: crosshair;
  z-index: 4;
}

.csNodeLinkHandle:hover {
  box-shadow: 0 0 0 2px var(--dsw-alias-interactive-bg-active);
}

.csNodeOverlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--dsw-alias-bg-base);
  opacity: 0.92;
}

.csNodeOverlayLabel {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
}

.csNodeProgress {
  width: 70%;
  height: 4px;
  border-radius: 2px;
  overflow: hidden;
  background: var(--dsw-alias-border-l2);
}

.csNodeProgressBar {
  display: block;
  width: 40%;
  height: 100%;
  border-radius: 2px;
  background: var(--dsw-alias-interactive-bg-active);
  animation: csProgressSlide 1.2s ease-in-out infinite;
}

@keyframes csProgressSlide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}

.csNodeBadge {
  position: absolute;
  top: -8px;
  left: -8px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  max-width: 80%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--dsw-alias-bg-base);
  border: 1px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-secondary);
}

.csNodeBadgeError {
  border-color: var(--dsw-alias-state-error-primary);
  color: var(--dsw-alias-state-error-primary);
}

.csNodeBadgeLock {
  left: auto;
  right: -8px;
}

.csNodeRename {
  position: absolute;
  top: 4px;
  left: 4px;
  right: 4px;
  z-index: 5;
  font: inherit;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--dsw-alias-interactive-bg-active);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
}

/* ---- Edge draft line + chip text ---- */
.csEdgeDraft {
  stroke-dasharray: 6 4;
  stroke: var(--dsw-alias-interactive-bg-active);
}

.csEdgeChipText {
  font-family: inherit;
  user-select: none;
}

/* ---- Zoom cluster ---- */
.csCanvasZoomCluster {
  position: absolute;
  right: 10px;
  bottom: 10px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 8px;
  background: var(--dsw-alias-bg-base);
  border: 1px solid var(--dsw-alias-border-l2);
}

.csCanvasZoom {
  padding: 2px 6px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
}

.csCanvasZoomButton {
  font: inherit;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 5px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  font-size: 13px;
}

.csCanvasZoomButton:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

/* ---- Minimap ---- */
.csMinimap {
  position: absolute;
  left: 10px;
  bottom: 10px;
  padding: 6px;
  border-radius: 8px;
  background: var(--dsw-alias-bg-base);
  border: 1px solid var(--dsw-alias-border-l2);
  cursor: grab;
  user-select: none;
}

.csMinimap:active {
  cursor: grabbing;
}

.csMinimap svg {
  display: block;
}

/* ---- Side column (layer list + conversation) ---- */
.csSide {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-left: 1px solid var(--dsw-alias-border-l2);
}

/* ---- Layer panel ---- */
.csLayerPanel {
  display: flex;
  flex-direction: column;
  max-height: 320px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-primary);
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
}

.csLayerPanelHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  font-weight: 600;
  font-size: 13px;
}

.csLayerSearch {
  font: inherit;
  font-size: 12px;
  flex: 0 0 120px;
  padding: 3px 6px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
}

.csLayerList {
  overflow-y: auto;
  padding: 0 6px 8px;
}

.csLayerRow {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}

.csLayerRow:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

.csLayerRowActive {
  background: var(--dsw-alias-interactive-bg-active);
}

.csLayerThumb {
  flex: 0 0 40px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
}

.csLayerThumb img,
.csLayerThumb video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.csLayerThumbKind {
  font-size: 10px;
  color: var(--dsw-alias-label-tertiary);
}

.csLayerTitle {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-primary);
}

.csLayerActions {
  display: flex;
  gap: 1px;
  flex: 0 0 auto;
}

.csLayerAction {
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border-radius: 4px;
  border: 1px solid transparent;
  background: transparent;
  font-size: 11px;
  line-height: 1;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
}

.csLayerAction:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.csLayerActionActive {
  color: var(--dsw-alias-label-primary);
}

.csLayerActionDanger:hover {
  color: var(--dsw-alias-state-error-primary);
}

.csLayerEmpty {
  padding: 16px 8px;
  text-align: center;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
}

/* ---- Layer detail panel (overlay) ---- */
.csDetailPanel {
  position: fixed;
  top: 64px;
  right: 12px;
  z-index: 30;
  width: 320px;
  max-height: calc(100% - 80px);
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  box-shadow: 0 8px 28px rgb(0 0 0 / 18%);
  overflow: hidden;
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
}

.csDetailPanelHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
}

.csDetailPanelClose {
  font: inherit;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 5px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.csDetailPanelClose:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.csDetailPanelBody {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  overflow-y: auto;
  font-size: 12px;
}

.csDetailRow {
  display: flex;
  align-items: center;
  gap: 8px;
}

.csDetailLabel {
  flex: 0 0 72px;
  color: var(--dsw-alias-label-tertiary);
}

.csDetailValue {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-primary);
}

.csDetailValueClickable {
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}

.csDetailInput {
  font: inherit;
  font-size: 12px;
  flex: 1 1 auto;
  min-width: 0;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
}

.csDetailRange {
  flex: 1 1 auto;
  accent-color: var(--dsw-alias-interactive-bg-active);
}

.csDetailButton {
  font: inherit;
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}

.csDetailButton:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.csDetailButtonActive {
  border-color: var(--dsw-alias-interactive-bg-active);
  color: var(--dsw-alias-label-primary);
}

.csDetailButtonDanger {
  border-color: transparent;
  color: var(--dsw-alias-state-error-primary);
}

.csDetailPrompt {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--dsw-alias-label-secondary);
}

.csDetailError {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 11px;
  color: var(--dsw-alias-state-error-primary);
  white-space: pre-wrap;
  word-break: break-all;
}

.csDetailActions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1 1 auto;
  justify-content: flex-end;
}

.csDetailSteer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-top: 1px solid var(--dsw-alias-border-l2);
}

/* ---- Node context menu ---- */
.csContextMenu {
  position: fixed;
  z-index: 50;
  min-width: 160px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  box-shadow: 0 8px 24px rgb(0 0 0 / 16%);
}

.csMenuAction {
  font: inherit;
  font-size: 12px;
  text-align: left;
  padding: 6px 10px;
  border-radius: 5px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
}

.csMenuAction:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}

.csMenuAction:disabled {
  opacity: 0.4;
  cursor: default;
}

.csMenuActionDanger {
  color: var(--dsw-alias-state-error-primary);
}

.csMenuActionDanger:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
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