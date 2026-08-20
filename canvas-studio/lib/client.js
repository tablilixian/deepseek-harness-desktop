window.__ModuleLoader__.load({
	id: "canvas-studio",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/asset-capture.ts
		/** 画布媒体工具名 → 产物类型。 */
		const STUDIO_TOOL_KINDS = {
			image_generate: "image",
			video_generate: "video",
			video_composite: "video"
		};
		/** 判断工具名是否属于画布媒体工具。 */
		function isStudioTool(name) {
			return Object.prototype.hasOwnProperty.call(STUDIO_TOOL_KINDS, name);
		}
		/** 从 tool/call 的 arguments 字段解析出参考图 URL（video 工具的 imageUrl）。 */
		function sourceUrlFromArguments(value) {
			if (value === void 0 || value === null) return void 0;
			let parsed = value;
			if (typeof value === "string") try {
				parsed = JSON.parse(value);
			} catch {
				return;
			}
			if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return void 0;
			const imageUrl = parsed.imageUrl;
			return typeof imageUrl === "string" && imageUrl.length > 0 ? imageUrl : void 0;
		}
		/**
		* 创建 P4 的 conversationEvents 节点 definition。
		* @param hooks - 与画布 store 的接线（React 之外）。
		* @returns 节点 definition，供 `ctx.conversationEvents.register` 注册。
		*/
		function createAssetCaptureDefinition(hooks) {
			const match = (event) => {
				if (event.type === "tool/call") {
					const data = event.data;
					if (isStudioTool(data.name)) return {
						id: String(data.callId),
						role: "start"
					};
					return null;
				}
				if (event.type === "tool/result") {
					const source = event.data.message.source;
					return {
						id: String(source.callId),
						role: "update"
					};
				}
				return null;
			};
			return {
				kind: "canvas-studio-asset",
				target: "chat",
				match,
				start: (_context, startMatch) => {
					const data = startMatch.event.data;
					return {
						toolName: data.name,
						sourceUrl: sourceUrlFromArguments(data.arguments) ?? ""
					};
				},
				update: (context, updateMatch) => {
					const state = context.state;
					if (updateMatch.event.type === "tool/result") {
						const projectId = hooks.getSelectedProjectId();
						if (projectId !== null) hooks.reloadCanvas(projectId);
					}
					return state;
				},
				buildViewNode: () => null
			};
		}
		//#endregion
		//#region src/client/api.ts
		/** HTTP facts used to localize safe Client-facing Studio failures. */
		var StudioApiError = class extends Error {
			status;
			code;
			constructor(message, status, code) {
				super(message);
				this.status = status;
				this.code = code;
				this.name = "StudioApiError";
			}
		};
		async function readJson(response) {
			const value = await response.json();
			if (!response.ok) throw new StudioApiError(typeof value.error === "string" ? value.error : `request failed: ${response.status}`, response.status, typeof value.code === "string" ? value.code : void 0);
			return value;
		}
		/** List all registered projects. */
		async function listStudioProjects(signal) {
			return (await readJson(await fetch("/canvas-studio/projects", {
				cache: "no-store",
				...signal === void 0 ? {} : { signal }
			}))).projects;
		}
		/** Create a project and return its record. */
		async function createStudioProject(name, signal) {
			return (await readJson(await fetch("/canvas-studio/projects", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name }),
				...signal === void 0 ? {} : { signal }
			}))).project;
		}
		/** Delete a project by id (removes its directory and registry record). */
		async function deleteStudioProject(id, signal) {
			await readJson(await fetch("/canvas-studio/projects", {
				method: "DELETE",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ id }),
				...signal === void 0 ? {} : { signal }
			}));
		}
		/**
		* 把历史节点里写死的 `http://127.0.0.1:<port>/canvas-studio/...` 绝对 URL 归一化为
		* 同源相对路径。渲染进程与 webServer 同源，相对 URL 自动解析到当前端口，桌面重启
		* 换端口也不会 404（早期版本把端口写死在 URL 里，换端口后已有产物会失效）。
		*/
		function normalizeCanvasNodes(nodes) {
			return nodes.map((node) => {
				if (typeof node.url !== "string") return node;
				const rewritten = node.url.replace(/^https?:\/\/127\.0\.0\.1:\d+(\/canvas-studio\/.*)$/, "$1");
				return rewritten === node.url ? node : {
					...node,
					url: rewritten
				};
			});
		}
		/** Load a project's persisted canvas nodes (empty list when none). */
		async function loadStudioCanvas(projectId, signal) {
			return normalizeCanvasNodes((await readJson(await fetch(`/canvas-studio/canvas?projectId=${encodeURIComponent(projectId)}`, {
				cache: "no-store",
				...signal === void 0 ? {} : { signal }
			}))).nodes);
		}
		/** Persist a project's full canvas node list. */
		async function saveStudioCanvas(projectId, nodes, signal) {
			await readJson(await fetch("/canvas-studio/canvas", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					projectId,
					nodes
				}),
				...signal === void 0 ? {} : { signal }
			}));
		}
		//#endregion
		//#region src/client/layout-controller.ts
		/**
		* Studio-owned implementation of the standard panel-action face. The studio
		* frame does not render the sidebar or details columns in P1, so every
		* transition is a no-op until those columns land.
		*/
		var StudioLayoutController = class {
			/** Toggle the sidebar panel (no-op: the studio frame renders no sidebar). */
			toggleSidebar() {}
			/** Open the details panel (no-op: the studio frame renders no details column). */
			openDetails() {}
			/** Close the details panel (no-op: the studio frame renders no details column). */
			closeDetails() {}
		};
		//#endregion
		//#region src/client/project-store.ts
		/**
		* Project + canvas viewing store: the registry snapshot, the current
		* selection, and the per-project canvas node list.
		*
		* Reads happen through the framework-bound `useStore`; writes go through the
		* declared actions only (async fetching lives in the apply-world inject
		* callbacks, which commit through these actions). The canvas node list is the
		* full P4+ model: every captured generation result (image/video) or manual
		* annotation (sticky/text/prompt) is a node, and bloodline edges are derived
		* from each node's `sourceIds` at render time (plan §7.3).
		*/
		/** Default rendered box size per node kind (canvas-space pixels). */
		const NODE_SIZE = {
			image: {
				width: 260,
				height: 180
			},
			video: {
				width: 260,
				height: 180
			},
			sticky: {
				width: 220,
				height: 140
			},
			text: {
				width: 220,
				height: 120
			},
			prompt: {
				width: 240,
				height: 120
			}
		};
		/** Auto-layout grid for freshly captured nodes. */
		const LAYOUT = {
			origin: 40,
			stepX: 300,
			stepY: 240,
			columns: 4
		};
		/** Mint a node id in the browser (secure context over loopback). */
		function newNodeId() {
			const cryptoObj = globalThis.crypto;
			if (cryptoObj !== void 0 && typeof cryptoObj.randomUUID === "function") return cryptoObj.randomUUID();
			return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
		}
		/** 取某项目的全部节点（未绑定或空时返回空数组）。 */
		function nodesOf(state, projectId) {
			if (projectId === null) return [];
			return state.nodes[projectId] ?? [];
		}
		/** 取当前选中的节点。 */
		function selectedNodeOf(state) {
			if (state.selectedNodeId === null || state.selectedProjectId === null) return null;
			return nodesOf(state, state.selectedProjectId).find((node) => node.id === state.selectedNodeId) ?? null;
		}
		/**
		* Create the project + canvas store handle.
		* @returns the store handle (spec + type + identity + factory in one).
		*/
		function createProjectStore() {
			return (0, _deepseek_ai_dsh_client_runtime_client.defineStore)({
				init: () => ({
					projects: [],
					selectedProjectId: null,
					selectedNodeId: null,
					phase: "idle",
					error: null,
					creating: false,
					nodes: {}
				}),
				actions: {
					setPhase: (draft, phase) => {
						draft.phase = phase;
					},
					setLoaded: (draft, projects) => {
						draft.projects = projects;
						draft.phase = "idle";
						draft.error = null;
						if (draft.selectedProjectId !== null && !projects.some((project) => project.id === draft.selectedProjectId)) {
							draft.selectedProjectId = null;
							draft.selectedNodeId = null;
						}
					},
					setFailed: (draft, error) => {
						draft.phase = "error";
						draft.error = error;
					},
					select: (draft, projectId) => {
						draft.selectedProjectId = projectId;
						draft.selectedNodeId = null;
					},
					setCreating: (draft, creating) => {
						draft.creating = creating;
					},
					setNodes: (draft, projectId, nodes) => {
						draft.nodes = {
							...draft.nodes,
							[projectId]: [...nodes]
						};
					},
					addAsset: (draft, projectId, asset) => {
						const existing = draft.nodes[projectId] ?? [];
						if (existing.some((candidate) => candidate.url === asset.url)) return;
						const sourceIds = [];
						if (asset.sourceUrl !== void 0) {
							const source = existing.find((candidate) => candidate.url === asset.sourceUrl);
							if (source !== void 0) sourceIds.push(source.id);
						}
						const index = existing.length;
						const size = NODE_SIZE[asset.kind];
						const node = {
							id: newNodeId(),
							kind: asset.kind,
							url: asset.url,
							x: LAYOUT.origin + index % LAYOUT.columns * LAYOUT.stepX,
							y: LAYOUT.origin + Math.floor(index / LAYOUT.columns) * LAYOUT.stepY,
							width: size.width,
							height: size.height,
							createdAt: asset.createdAt,
							toolName: asset.toolName,
							runId: asset.runId,
							origin: "agent",
							sourceIds
						};
						draft.nodes = {
							...draft.nodes,
							[projectId]: [...existing, node]
						};
					},
					moveNode: (draft, projectId, id, x, y) => {
						const existing = draft.nodes[projectId];
						if (existing === void 0) return;
						draft.nodes = {
							...draft.nodes,
							[projectId]: existing.map((node) => node.id === id ? {
								...node,
								x,
								y
							} : node)
						};
					},
					selectNode: (draft, id) => {
						draft.selectedNodeId = id;
					},
					removeNode: (draft, projectId, id) => {
						const existing = draft.nodes[projectId];
						if (existing === void 0) return;
						draft.nodes = {
							...draft.nodes,
							[projectId]: existing.filter((node) => node.id !== id).map((node) => node.sourceIds.includes(id) ? {
								...node,
								sourceIds: node.sourceIds.filter((sourceId) => sourceId !== id)
							} : node)
						};
						if (draft.selectedNodeId === id) draft.selectedNodeId = null;
					},
					clearProject: (draft, projectId) => {
						draft.nodes = {
							...draft.nodes,
							[projectId]: []
						};
						if (draft.selectedNodeId !== null) draft.selectedNodeId = null;
					}
				}
			});
		}
		//#endregion
		//#region src/client/styles.ts
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
  grid-template-columns: 280px minmax(0, 1fr) 440px;
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

.csCanvasToolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  font-size: 13px;
  color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-bg-base);
}

.csCanvasToolbarDelete {
  font: inherit;
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: transparent;
  color: var(--dsw-alias-state-error-primary);
  cursor: pointer;
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
`;
		/** Inject the studio stylesheet once per browser lifetime. */
		function installStudioStyles() {
			const element = document.createElement("style");
			element.setAttribute("data-plugin", "canvas-studio");
			element.textContent = STUDIO_STYLES;
			document.head.appendChild(element);
			return () => {
				element.remove();
			};
		}
		//#endregion
		//#region src/client/ProjectList.tsx
		/** Relative-day label for the project creation date. */
		function createdLabel(project) {
			const date = new Date(project.createdAt);
			if (Number.isNaN(date.getTime())) return "-";
			return date.toLocaleDateString();
		}
		/**
		* The studio project list: an inline create form plus one row per project.
		* Clicking a row opens the project (session binding happens in the callback).
		* Each row also carries a delete affordance (confirmed before firing).
		*/
		function ProjectListInner(props) {
			const { projects: rawProjects, selectedProjectId, phase, error, creating, onRefresh, onCreate, onOpen, onDelete } = props;
			const projects = Array.isArray(rawProjects) ? rawProjects : [];
			const [formOpen, setFormOpen] = (0, react.useState)(false);
			const [draftName, setDraftName] = (0, react.useState)("");
			const submit = async () => {
				const name = draftName.trim();
				if (name.length === 0 || creating) return;
				await onCreate(name);
				setFormOpen(false);
				setDraftName("");
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "csProjectList",
				children: [
					!formOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "csProjectNew",
						disabled: creating,
						onClick: () => setFormOpen(true),
						children: "+ 新建项目"
					}),
					formOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "csProjectForm",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: "csProjectNameInput",
							value: draftName,
							placeholder: "项目名",
							autoFocus: true,
							disabled: creating,
							onChange: (event) => {
								setDraftName(event.target.value);
							},
							onKeyDown: (event) => {
								if (event.key === "Enter") submit();
								if (event.key === "Escape") setFormOpen(false);
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "csProjectFormActions",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: creating || draftName.trim().length === 0,
								onClick: () => void submit(),
								children: creating ? "创建中" : "创建"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: creating,
								onClick: () => setFormOpen(false),
								children: "取消"
							})]
						})]
					}),
					phase === "loading" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "csProjectsEmpty",
						children: "加载中…"
					}),
					phase === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "csProjectError",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: error }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: onRefresh,
							children: "重试"
						})]
					}),
					phase === "idle" && projects.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "csProjectsEmpty",
						children: "还没有项目,点击「新建项目」开始创作"
					}),
					projects.map((project) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: project.id === selectedProjectId ? "csProjectItem csProjectItemActive" : "csProjectItem",
						onClick: () => onOpen(project),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "csProjectMeta",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "csProjectName",
								children: project.name
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "csProjectDate",
								children: createdLabel(project)
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "csProjectDelete",
							title: "删除项目",
							disabled: creating,
							onClick: (event) => {
								event.stopPropagation();
								if (window.confirm(`确定删除项目「${project.name}」？该操作会同时删除其目录与画布，不可恢复。`)) onDelete(project.id);
							},
							children: "×"
						})]
					}, project.id))
				]
			});
		}
		/** Render boundary: if the list crashes, show the error instead of vanishing. */
		var ProjectListErrorBoundary = class extends react.Component {
			state = {
				crashed: false,
				crashError: null
			};
			static getDerivedStateFromError(error) {
				return {
					crashed: true,
					crashError: error instanceof Error ? error : new Error(String(error))
				};
			}
			componentDidCatch(error, errorInfo) {
				console.error("[canvas-studio] ProjectList render error:", error, errorInfo);
			}
			render() {
				if (this.state.crashed) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "csProjectError",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["项目列表渲染失败: ", this.state.crashError?.message ?? "未知错误"] })
				});
				return this.props.children;
			}
		};
		/**
		* The studio project list: an inline create form plus one row per project.
		* Wrapped in an error boundary so crashes surface in the UI instead of being
		* swallowed by the upstream slot boundary.
		*/
		function ProjectList(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectListErrorBoundary, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectListInner, { ...props }) });
		}
		//#endregion
		//#region src/client/canvas/CanvasEdges.tsx
		/**
		* Bloodline edges: every node draws a bezier from each of its `sourceIds`
		* sources. There is no separate edge table — edges are derived from the node
		* graph at render time (plan §7.3). Coordinates are canvas-space; the parent
		* layer applies the pan/zoom transform, so this SVG only needs overflow-visible.
		*/
		function CanvasEdges(props) {
			const { nodes } = props;
			const byId = new Map(nodes.map((node) => [node.id, node]));
			const paths = [];
			for (const node of nodes) for (const sourceId of node.sourceIds) {
				const source = byId.get(sourceId);
				if (source === void 0) continue;
				const sx = source.x + source.width / 2;
				const sy = source.y + source.height;
				const tx = node.x + node.width / 2;
				const ty = node.y;
				const midY = (sy + ty) / 2;
				const d = `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`;
				paths.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					className: "csEdge",
					d
				}, `${sourceId}->${node.id}`));
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				className: "csEdges",
				width: 1,
				height: 1,
				children: paths
			});
		}
		//#endregion
		//#region src/client/canvas/CanvasNode.tsx
		/** Human-readable labels for the non-media node kinds. */
		const KIND_LABEL$1 = {
			image: "图片",
			video: "视频",
			sticky: "便签",
			text: "文本",
			prompt: "提示"
		};
		/**
		* One canvas node: an image/video media box or a text annotation box, placed
		* at its canvas-space coordinates. The surface owns pan/zoom/drag; this
		* component is purely presentational and reports pointer-down so the surface
		* can begin a node drag.
		*/
		function CanvasNode(props) {
			const { node, selected, onPointerDown } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: selected ? "csNode csNodeSelected" : "csNode",
				style: {
					left: node.x,
					top: node.y,
					width: node.width,
					height: node.height
				},
				onPointerDown,
				"data-node-id": node.id,
				children: [
					node.kind === "image" && node.url ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
						className: "csNodeMedia",
						src: node.url,
						alt: node.title ?? "image",
						draggable: false
					}) : null,
					node.kind === "video" && node.url ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("video", {
						className: "csNodeMedia",
						src: node.url,
						controls: true,
						preload: "metadata"
					}) : null,
					node.kind === "sticky" || node.kind === "text" || node.kind === "prompt" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "csNodeText",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "csNodeKind",
							children: KIND_LABEL$1[node.kind]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "csNodeBody",
							children: node.text ?? node.title ?? ""
						})]
					}) : null,
					selected && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "csNodeRing" })
				]
			});
		}
		//#endregion
		//#region src/client/canvas/CanvasSurface.tsx
		/** Clamp a zoom scale to a sane range. */
		function clampScale(value) {
			return Math.min(3, Math.max(.2, value));
		}
		/**
		* The infinite canvas: a grid background that pans/zooms with content, node
		* boxes placed at their canvas-space coordinates, and the bloodline edge
		* overlay. Background pointer-down pans; node pointer-down begins a node drag;
		* wheel zooms around the cursor. Node coordinates are transformed by the layer
		* so edges and nodes share one coordinate system.
		*/
		function CanvasSurface(props) {
			const { nodes, selectedNodeId, onSelectNode, onMoveNode, onPersist, focusNodeId } = props;
			const [offset, setOffset] = (0, react.useState)({
				x: 0,
				y: 0
			});
			const [scale, setScale] = (0, react.useState)(1);
			const containerRef = (0, react.useRef)(null);
			const offsetRef = (0, react.useRef)(offset);
			const scaleRef = (0, react.useRef)(scale);
			offsetRef.current = offset;
			scaleRef.current = scale;
			const drag = (0, react.useRef)({
				mode: "pan",
				sx: 0,
				sy: 0
			});
			(0, react.useEffect)(() => {
				if (focusNodeId === void 0 || focusNodeId === null) return;
				const node = nodes.find((candidate) => candidate.id === focusNodeId);
				const el = containerRef.current;
				if (node === void 0 || el === null) return;
				const vw = el.clientWidth;
				const vh = el.clientHeight;
				const cx = node.x + node.width / 2;
				const cy = node.y + node.height / 2;
				setOffset({
					x: vw / 2 - cx * scaleRef.current,
					y: vh / 2 - cy * scaleRef.current
				});
			}, [focusNodeId, nodes]);
			(0, react.useEffect)(() => {
				const el = containerRef.current;
				if (el === null) return;
				const onWheel = (event) => {
					event.preventDefault();
					const rect = el.getBoundingClientRect();
					const px = event.clientX - rect.left;
					const py = event.clientY - rect.top;
					const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
					const newScale = clampScale(scaleRef.current * factor);
					const wx = (px - offsetRef.current.x) / scaleRef.current;
					const wy = (py - offsetRef.current.y) / scaleRef.current;
					setOffset({
						x: px - wx * newScale,
						y: py - wy * newScale
					});
					setScale(newScale);
				};
				el.addEventListener("wheel", onWheel, { passive: false });
				return () => {
					el.removeEventListener("wheel", onWheel);
				};
			}, []);
			const onSurfacePointerDown = (event) => {
				drag.current = {
					mode: "pan",
					sx: event.clientX,
					sy: event.clientY
				};
				onSelectNode(null);
			};
			const onNodePointerDown = (event, node) => {
				event.stopPropagation();
				drag.current = {
					mode: "node",
					sx: event.clientX,
					sy: event.clientY,
					nodeId: node.id,
					ox: node.x,
					oy: node.y
				};
				onSelectNode(node.id);
			};
			const onPointerMove = (event) => {
				const current = drag.current;
				if (current.mode === "pan") {
					setOffset((previous) => ({
						x: previous.x + (event.clientX - current.sx),
						y: previous.y + (event.clientY - current.sy)
					}));
					current.sx = event.clientX;
					current.sy = event.clientY;
				} else if (current.mode === "node" && current.nodeId !== void 0 && current.ox !== void 0 && current.oy !== void 0) {
					const dx = (event.clientX - current.sx) / scaleRef.current;
					const dy = (event.clientY - current.sy) / scaleRef.current;
					onMoveNode(current.nodeId, current.ox + dx, current.oy + dy);
				}
			};
			const onPointerUp = (event) => {
				if (drag.current.mode === "node") onPersist();
				drag.current = {
					mode: "pan",
					sx: 0,
					sy: 0
				};
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "csCanvasSurface",
				ref: containerRef,
				onPointerDown: onSurfacePointerDown,
				onPointerMove,
				onPointerUp,
				style: {
					backgroundPosition: `${offset.x}px ${offset.y}px`,
					backgroundSize: `${40 * scale}px ${40 * scale}px`
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "csCanvasLayer",
					style: {
						transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
						transformOrigin: "0 0"
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CanvasEdges, { nodes }), nodes.map((node) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CanvasNode, {
						node,
						selected: node.id === selectedNodeId,
						onPointerDown: (event) => {
							onNodePointerDown(event, node);
						}
					}, node.id))]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "csCanvasZoom",
					children: [Math.round(scale * 100), "%"]
				})]
			});
		}
		//#endregion
		//#region src/client/canvas/CanvasTimeline.tsx
		/** Human-readable labels for the node kinds. */
		const KIND_LABEL = {
			image: "图",
			video: "视频",
			sticky: "便签",
			text: "文本",
			prompt: "提示"
		};
		/** Short HH:MM:SS label for a node timestamp. */
		function timeLabel(createdAt) {
			const date = new Date(createdAt);
			if (Number.isNaN(date.getTime())) return "-";
			return date.toLocaleTimeString();
		}
		/**
		* The review strip: every node of the project, ordered by creation time, as a
		* thumbnail chip. Clicking a chip selects the node and (via the parent) centers
		* it on the surface — this is the "回看" entry point.
		*/
		function CanvasTimeline(props) {
			const { nodes, selectedNodeId, onSelect } = props;
			const ordered = [...nodes].sort((left, right) => left.createdAt - right.createdAt);
			if (ordered.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "csTimeline csTimelineEmpty",
				children: "尚无产物 —— 在右侧对话让 agent 生成后，按时间线回看"
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "csTimeline",
				children: ordered.map((node) => {
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: node.id === selectedNodeId ? "csTimelineItem csTimelineItemActive" : "csTimelineItem",
						onClick: () => {
							onSelect(node.id);
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "csTimelineThumb",
							children: [
								node.kind === "image" && node.url ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
									src: node.url,
									alt: node.title ?? "image",
									draggable: false
								}) : null,
								node.kind === "video" && node.url ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("video", {
									src: node.url,
									muted: true,
									preload: "metadata"
								}) : null,
								node.kind !== "image" && node.kind !== "video" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "csTimelineKind",
									children: KIND_LABEL[node.kind]
								}) : null
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "csTimelineTime",
							children: timeLabel(node.createdAt)
						})]
					}, node.id);
				})
			});
		}
		//#endregion
		//#region src/client/StudioFrame.tsx
		/**
		* Three-column studio frame: project list, canvas surface + review timeline,
		* and the official conversation seat on the right. The sidebar and details
		* seats stay declared (upstream registrants keep their paths) but are not
		* rendered. The canvas shows every captured node of the selected project
		* (image/video/sticky/text/prompt) with bloodline edges; the timeline lets the
		* user review and jump to any node.
		*/
		function StudioFrame(props) {
			const { renderSlot, useStudio, refreshProjects, createProject, openProject, deleteProject, persistCanvas, selectNode, moveNode, removeNode } = props;
			const projects = useStudio((store) => store.projects);
			const selectedProjectId = useStudio((store) => store.selectedProjectId);
			const selectedNodeId = useStudio((store) => store.selectedNodeId);
			const nodes = useStudio((store) => nodesOf(store, store.selectedProjectId));
			const selectedNode = useStudio((store) => selectedNodeOf(store));
			const phase = useStudio((store) => store.phase);
			const error = useStudio((store) => store.error);
			const creating = useStudio((store) => store.creating);
			const [focusNodeId, setFocusNodeId] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				refreshProjects();
			}, [refreshProjects]);
			const handleMove = (id, x, y) => {
				if (selectedProjectId === null) return;
				moveNode(selectedProjectId, id, x, y);
			};
			const handlePersist = () => {
				if (selectedProjectId === null) return;
				persistCanvas(selectedProjectId);
			};
			const handleDelete = () => {
				if (selectedProjectId === null || selectedNodeId === null) return;
				removeNode(selectedProjectId, selectedNodeId);
				handlePersist();
			};
			const handleTimelineSelect = (id) => {
				selectNode(id);
				setFocusNodeId(id);
			};
			const canvasBody = (() => {
				if (selectedProjectId === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "csCanvasEmpty",
					children: "打开或新建一个项目，开始创作"
				});
				if (nodes.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "csCanvasEmpty",
					children: "尚未生成画布内容 —— 在右侧对话让 agent 生成图片或视频"
				});
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CanvasSurface, {
					nodes,
					selectedNodeId,
					onSelectNode: selectNode,
					onMoveNode: handleMove,
					onPersist: handlePersist,
					focusNodeId
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CanvasTimeline, {
					nodes,
					selectedNodeId,
					onSelect: handleTimelineSelect
				})] });
			})();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "csFrame",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
						className: "csProjects",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
							className: "csProjectsHeader",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "项目" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: phase === "loading" || creating,
								onClick: () => void refreshProjects(),
								children: "刷新"
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectList, {
							projects,
							selectedProjectId,
							phase,
							error,
							creating,
							onRefresh: () => void refreshProjects(),
							onCreate: createProject,
							onOpen: openProject,
							onDelete: deleteProject
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("main", {
						className: "csCanvas",
						children: [selectedNode !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "csCanvasToolbar",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "csCanvasToolbarInfo",
								children: [
									"已选中：",
									selectedNode.kind,
									selectedNode.title ? ` · ${selectedNode.title}` : ""
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "csCanvasToolbarDelete",
								onClick: handleDelete,
								children: "删除节点"
							})]
						}), canvasBody]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
						className: "csConversation",
						children: renderSlot("conversation", {})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "csOverlay",
						"data-cs-overlay": true,
						children: renderSlot("shell.overlay", {})
					})
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/**
		* Services required before the studio frame can mount.
		*
		* 注意：`tools` 是 Host 专属服务，客户端没有该服务。媒体生成工具已在 Host
		* 侧（`src/host-tools.ts`）注册，客户端只负责 UI、项目/工作区绑定，以及
		* 通过 `conversationEvents` 捕获工具产物到画布 store（P4），并把画布节点
		* 持久化到 Host（P4+ 重启恢复）。
		*/
		const inject = [
			"slots",
			"workspaces",
			"conversationEvents"
		];
		/** Dev-only seed sample media so the canvas is verifiable without a backend. */
		const SEED_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"260\" height=\"180\"><rect width=\"100%\" height=\"100%\" fill=\"#4285f4\"/><text x=\"50%\" y=\"50%\" fill=\"white\" font-size=\"18\" text-anchor=\"middle\" dominant-baseline=\"middle\">种子示例图</text></svg>")}`;
		const SEED_VIDEO = "https://example.invalid/canvas-studio-seed/sample.mp4";
		/**
		* Build dev-seed nodes for a project: an image, a video derived from it
		* (bloodline edge), and a sticky note — enough to exercise every node kind,
		* the edge renderer, and the timeline without a live Drama Backend.
		*/
		function seedNodes() {
			const now = Date.now();
			return [
				{
					id: "seed-image",
					kind: "image",
					url: SEED_IMAGE,
					title: "示例图",
					x: 40,
					y: 40,
					width: 260,
					height: 180,
					createdAt: now,
					origin: "manual",
					sourceIds: []
				},
				{
					id: "seed-video",
					kind: "video",
					url: SEED_VIDEO,
					title: "示例视频",
					x: 340,
					y: 40,
					width: 260,
					height: 180,
					createdAt: now + 1,
					origin: "manual",
					sourceIds: ["seed-image"]
				},
				{
					id: "seed-sticky",
					kind: "sticky",
					text: "种子便签：演示文本 / 提示节点与画布交互",
					x: 40,
					y: 300,
					width: 220,
					height: 140,
					createdAt: now + 2,
					origin: "manual",
					sourceIds: []
				}
			];
		}
		/**
		* Client plugin body: provide the standard ctx.layout contract (owned by the
		* disabled ui-layout row) and register the studio frame into the runtime's
		* built-in root slot, declaring the standard child seats so the upstream
		* sidebar/conversation/details plugins keep their registration paths.
		*
		* Project switching binds the conversation to the project's workspace: each
		* project owns one workspace registered at its disk directory, and opening a
		* project connects (reusing a blank session) and navigates to it. The canvas
		* nodes for that project are loaded (and, with `?cs-dev-seed=1`, seeded) here.
		* @param ctx - active browser Cordis context.
		*/
		function apply(ctx) {
			ctx.logger.info("canvas-studio client v2 loaded");
			const params = new URLSearchParams(window.location.search);
			if (params.get("dsh-desktop-mode") === "advanced") {
				ctx.logger.warn("canvas-studio: advanced desktop mode keeps the desktop frame; switch the desktop profile to compatibility mode to use the studio layout");
				return;
			}
			const devSeed = params.get("cs-dev-seed") === "1";
			const layout = new StudioLayoutController();
			const storeInstance = createProjectStore().create();
			const resolveActiveProjectId = () => {
				const manual = storeInstance.getSnapshot().selectedProjectId;
				if (manual !== null) return manual;
				const snapshot = ctx.workspaces.list.getSnapshot();
				if (!snapshot.baselinesReady) return null;
				const recentId = snapshot.recentWorkspaceId;
				if (recentId === void 0) return null;
				const view = snapshot.items.find((item) => item.workspaceId === recentId);
				if (view === void 0 || view.path === void 0) return null;
				return storeInstance.getSnapshot().projects.find((entry) => entry.dir === view.path)?.id ?? null;
			};
			const syncActiveProject = () => {
				const id = resolveActiveProjectId();
				if (id === null) return;
				if (storeInstance.getSnapshot().selectedProjectId === id) return;
				storeInstance.actions.select(id);
				(async () => {
					try {
						storeInstance.actions.setNodes(id, await loadStudioCanvas(id));
					} catch {}
				})();
			};
			ctx.effect(() => installStudioStyles(), "canvas-studio: studio styles");
			ctx.effect(() => {
				const reloadCanvas = async (projectId) => {
					try {
						storeInstance.actions.setNodes(projectId, await loadStudioCanvas(projectId));
					} catch {}
				};
				return ctx.conversationEvents.register(createAssetCaptureDefinition({
					reloadCanvas,
					getSelectedProjectId: () => resolveActiveProjectId()
				}));
			}, "canvas-studio: reload canvas on generated assets");
			ctx.effect(() => {
				syncActiveProject();
				return ctx.workspaces.list.subscribe(syncActiveProject);
			}, "canvas-studio: sync canvas to active workspace");
			ctx.effect(() => {
				const disposeService = ctx.reflect.provide("layout", layout);
				const disposeRegistration = ctx.slots.register({
					name: "root",
					children: {
						"sidebar": {
							kind: "single",
							scope: "root"
						},
						"conversation": {
							kind: "single",
							scope: "session-maybe"
						},
						"details": {
							kind: "single",
							scope: "session"
						},
						"shell.overlay": {
							kind: "list",
							scope: "root"
						}
					},
					inject: () => {
						const refreshProjects = async () => {
							storeInstance.actions.setPhase("loading");
							try {
								storeInstance.actions.setLoaded(await listStudioProjects());
								syncActiveProject();
							} catch (cause) {
								storeInstance.actions.setFailed(cause instanceof Error ? cause.message : "项目列表加载失败");
							}
						};
						const persistCanvas = async (projectId) => {
							await saveStudioCanvas(projectId, storeInstance.getSnapshot().nodes[projectId] ?? []);
						};
						const openProject = async (project) => {
							storeInstance.actions.select(project.id);
							try {
								const workspace = await ctx.workspaces.create({ path: project.dir });
								await ctx.workspaces.rename(workspace.workspaceId, project.name);
								ctx.workspaces.startSession(workspace.workspaceId);
								const loaded = await loadStudioCanvas(project.id);
								storeInstance.actions.setNodes(project.id, loaded);
								if (devSeed && loaded.length === 0) {
									const seeded = seedNodes();
									storeInstance.actions.setNodes(project.id, seeded);
									await saveStudioCanvas(project.id, seeded);
								}
							} catch (cause) {
								storeInstance.actions.setFailed(cause instanceof Error ? cause.message : "项目会话绑定失败");
							}
						};
						const createProject = async (name) => {
							storeInstance.actions.setCreating(true);
							try {
								const project = await createStudioProject(name);
								await refreshProjects();
								await openProject(project);
							} catch (cause) {
								storeInstance.actions.setFailed(cause instanceof Error ? cause.message : "项目创建失败");
							} finally {
								storeInstance.actions.setCreating(false);
							}
						};
						const deleteProject = async (projectId) => {
							try {
								await deleteStudioProject(projectId);
								await refreshProjects();
								if (storeInstance.getSnapshot().selectedProjectId === projectId) {
									storeInstance.actions.select(null);
									storeInstance.actions.clearProject(projectId);
								}
							} catch (cause) {
								storeInstance.actions.setFailed(cause instanceof Error ? cause.message : "项目删除失败");
							}
						};
						return {
							layout,
							refreshProjects,
							createProject,
							openProject,
							deleteProject,
							persistCanvas,
							selectNode: storeInstance.actions.selectNode,
							moveNode: storeInstance.actions.moveNode,
							removeNode: storeInstance.actions.removeNode,
							hooks: { studio: storeInstance }
						};
					}
				}, StudioFrame);
				return () => {
					disposeRegistration();
					disposeService();
				};
			}, "canvas-studio: layout service + studio root frame");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map