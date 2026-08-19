window.__ModuleLoader__.load({
	id: "canvas-studio",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_tools = require("@deepseek-ai/dsh-tools");
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
		/**
		* Ask the Host to generate a media asset for a project and return its
		* webServer-hosted URL. The Host owns the external API call and disk write.
		*/
		async function generateAsset(projectId, tool, params, signal) {
			return await readJson(await fetch("/canvas-studio/generate", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					tool,
					projectId,
					params
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
		* Project-list viewing store: the registry snapshot plus the current
		* selection. Reads happen through the framework-bound `useStore`; writes
		* through the declared actions only (async fetching lives in the apply-world
		* inject callbacks, which commit through these actions).
		*/
		/**
		* Create the project-list store handle.
		* @returns the store handle (spec + type + identity + factory in one).
		*/
		function createProjectStore() {
			return (0, _deepseek_ai_dsh_client_runtime_client.defineStore)({
				init: () => ({
					projects: [],
					selectedProjectId: null,
					phase: "idle",
					error: null,
					creating: false
				}),
				actions: {
					setPhase: (draft, phase) => {
						draft.phase = phase;
					},
					setLoaded: (draft, projects) => {
						draft.projects = projects;
						draft.phase = "idle";
						draft.error = null;
						if (draft.selectedProjectId !== null && !projects.some((project) => project.id === draft.selectedProjectId)) draft.selectedProjectId = null;
					},
					setFailed: (draft, error) => {
						draft.phase = "error";
						draft.error = error;
					},
					select: (draft, projectId) => {
						draft.selectedProjectId = projectId;
					},
					setCreating: (draft, creating) => {
						draft.creating = creating;
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
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
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

.csProjectName {
  font-weight: 500;
}

.csProjectDate {
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
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
  overflow: hidden;
  background: var(--dsw-alias-bg-base);
}

.csCanvasEmpty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
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
		*/
		function ProjectListInner(props) {
			const { projects: rawProjects, selectedProjectId, phase, error, creating, onRefresh, onCreate, onOpen } = props;
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
					projects.map((project) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: project.id === selectedProjectId ? "csProjectItem csProjectItemActive" : "csProjectItem",
						onClick: () => onOpen(project),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "csProjectName",
							children: project.name
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "csProjectDate",
							children: createdLabel(project)
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
		//#region src/client/StudioFrame.tsx
		/**
		* Three-column studio frame: project list, canvas surface, and the official
		* conversation seat on the right. The sidebar and details seats stay
		* declared (upstream registrants keep their paths) but are not rendered.
		*/
		function StudioFrame(props) {
			const { renderSlot, useStore, refreshProjects, createProject, openProject } = props;
			const projects = useStore((store) => store.projects);
			const selectedProjectId = useStore((store) => store.selectedProjectId);
			const phase = useStore((store) => store.phase);
			const error = useStore((store) => store.error);
			const creating = useStore((store) => store.creating);
			(0, react.useEffect)(() => {
				refreshProjects().catch((error) => {
					console.error("[canvas-studio] refreshProjects failed on mount:", error);
				});
			}, [refreshProjects]);
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
							onOpen: openProject
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("main", {
						className: "csCanvas",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "csCanvasEmpty",
							children: "画布将在后续阶段提供"
						})
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
		//#region src/client/tools.ts
		/** 产物结果 schema（工具返回给模型的结构）。 */
		const resultSchema = {
			type: "object",
			additionalProperties: false,
			properties: {
				url: {
					type: "string",
					description: "产物托管 URL，可在画布中直接引用"
				},
				width: {
					type: "integer",
					description: "宽度（像素）"
				},
				height: {
					type: "integer",
					description: "高度（像素）"
				},
				duration: {
					type: "number",
					description: "视频时长（秒）；图片无此项"
				}
			}
		};
		/** 把产物结果渲染成模型可读的文本块。 */
		function renderResult(value) {
			const result = value;
			const duration = result.duration !== void 0 ? `, ${result.duration}s` : "";
			return [{
				type: "text",
				text: `已生成产物: ${result.url} (${result.width}x${result.height}${duration})`
			}];
		}
		/**
		* 创建 P3 媒体生成工具集。
		* @param context - 提供当前激活项目 id 的读取器。
		* @returns 三个 `defineTool` 定义，供 `ctx.tools.register` 逐条注册。
		*/
		function createStudioTools(context) {
			const requireProject = () => {
				const id = context.getActiveProjectId();
				if (!id) throw new Error("请先在左侧打开或创建一个项目，再调用生成工具");
				return id;
			};
			return [
				(0, _deepseek_ai_dsh_tools.defineTool)({
					name: "image_generate",
					description: "根据提示词生成一张图片。可传入 imageUrl 作为参考图进行图生图。返回图片的托管 URL 与尺寸。",
					parameters: {
						prompt: {
							type: "string",
							required: true,
							description: "生成提示词"
						},
						aspectRatio: {
							type: "string",
							enum: [
								"16:9",
								"9:16",
								"1:1"
							],
							description: "宽高比，默认 16:9"
						},
						imageUrl: {
							type: "string",
							description: "可选参考图 URL（图生图）"
						},
						negativePrompt: {
							type: "string",
							description: "反向提示词"
						}
					},
					output: {
						schema: resultSchema,
						render: renderResult
					},
					execute(args) {
						const a = args;
						return generateAsset(requireProject(), "image_generate", {
							prompt: a.prompt,
							aspectRatio: a.aspectRatio,
							imageUrl: a.imageUrl,
							negativePrompt: a.negativePrompt
						});
					}
				}),
				(0, _deepseek_ai_dsh_tools.defineTool)({
					name: "video_generate",
					description: "根据提示词与一张参考图生成视频（图生视频）。imageUrl 通常来自 image_generate 的产物 URL。返回视频的托管 URL、尺寸与时长。",
					parameters: {
						prompt: {
							type: "string",
							required: true,
							description: "生成提示词"
						},
						imageUrl: {
							type: "string",
							required: true,
							description: "参考图 URL（图生视频的输入帧）"
						},
						aspectRatio: {
							type: "string",
							enum: [
								"16:9",
								"9:16",
								"1:1"
							],
							description: "宽高比，默认 16:9"
						},
						duration: {
							type: "number",
							description: "视频时长（秒），默认 5"
						}
					},
					output: {
						schema: resultSchema,
						render: renderResult
					},
					execute(args) {
						const a = args;
						return generateAsset(requireProject(), "video_generate", {
							prompt: a.prompt,
							imageUrl: a.imageUrl,
							aspectRatio: a.aspectRatio,
							duration: a.duration
						});
					}
				}),
				(0, _deepseek_ai_dsh_tools.defineTool)({
					name: "video_composite",
					description: "将多张参考图（imageUrls）合成一段视频，首尾帧插值。返回合成视频的托管 URL、尺寸与时长。",
					parameters: {
						prompt: {
							type: "string",
							required: true,
							description: "生成提示词"
						},
						imageUrls: {
							type: "array",
							description: "参考图 URL 数组（至少 1 张，最多 4 张）"
						},
						aspectRatio: {
							type: "string",
							enum: [
								"16:9",
								"9:16",
								"1:1"
							],
							description: "宽高比，默认 16:9"
						},
						duration: {
							type: "number",
							description: "视频时长（秒），默认 12"
						}
					},
					output: {
						schema: resultSchema,
						render: renderResult
					},
					execute(args) {
						const a = args;
						return generateAsset(requireProject(), "video_composite", {
							prompt: a.prompt,
							imageUrls: a.imageUrls,
							aspectRatio: a.aspectRatio,
							duration: a.duration
						});
					}
				})
			];
		}
		//#endregion
		//#region src/client/index.ts
		/** Services required before the studio frame can mount. */
		const inject = [
			"slots",
			"workspaces",
			"tools"
		];
		/**
		* Client plugin body: provide the standard ctx.layout contract (owned by the
		* disabled ui-layout row) and register the studio frame into the runtime's
		* built-in root slot, declaring the standard child seats so the upstream
		* sidebar/conversation/details plugins keep their registration paths.
		*
		* Project switching binds the conversation to the project's workspace: each
		* project owns one workspace registered at its disk directory, and opening a
		* project connects (reusing a blank session) and navigates to it.
		* @param ctx - active browser Cordis context.
		*/
		function apply(ctx) {
			let activeProjectId = null;
			if (new URLSearchParams(window.location.search).get("dsh-desktop-mode") === "advanced") {
				ctx.logger.warn("canvas-studio: advanced desktop mode keeps the desktop frame; switch the desktop profile to compatibility mode to use the studio layout");
				return;
			}
			const layout = new StudioLayoutController();
			ctx.effect(() => installStudioStyles(), "canvas-studio: studio styles");
			ctx.effect(() => {
				const disposers = createStudioTools({ getActiveProjectId: () => activeProjectId }).map((definition) => ctx.tools.register(definition));
				return () => {
					for (const dispose of disposers) dispose();
				};
			}, "canvas-studio: media generation tools");
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
					store: createProjectStore,
					inject: ({ select, setPhase, setLoaded, setFailed, setCreating }) => {
						const refreshProjects = async () => {
							setPhase("loading");
							try {
								setLoaded(await listStudioProjects());
							} catch (cause) {
								setFailed(cause instanceof Error ? cause.message : "项目列表加载失败");
							}
						};
						const openProject = async (project) => {
							select(project.id);
							activeProjectId = project.id;
							try {
								const workspace = await ctx.workspaces.create({ path: project.dir });
								await ctx.workspaces.rename(workspace.workspaceId, project.name);
								ctx.workspaces.startSession(workspace.workspaceId);
							} catch (cause) {
								setFailed(cause instanceof Error ? cause.message : "项目会话绑定失败");
							}
						};
						const createProject = async (name) => {
							setCreating(true);
							try {
								const project = await createStudioProject(name);
								await refreshProjects();
								await openProject(project);
							} catch (cause) {
								setFailed(cause instanceof Error ? cause.message : "项目创建失败");
							} finally {
								setCreating(false);
							}
						};
						return {
							layout,
							refreshProjects,
							createProject,
							openProject
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