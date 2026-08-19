window.__ModuleLoader__.load({
	id: "canvas-studio",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
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
		//#region src/client/styles.ts
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
		//#region src/client/StudioFrame.tsx
		/**
		* Three-column studio frame: project list, canvas surface, and the official
		* conversation seat on the right. The sidebar and details seats stay
		* declared (upstream registrants keep their paths) but are not rendered.
		*/
		function StudioFrame({ renderSlot }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "csFrame",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
						className: "csProjects",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
							className: "csProjectsHeader",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "项目" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: true,
								children: "新建项目"
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "csProjectsEmpty",
							children: "项目列表将在后续阶段提供"
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
		//#region src/client/index.ts
		/** Services required before the studio frame can mount. */
		const inject = ["slots"];
		/**
		* Client plugin body: provide the standard ctx.layout contract (owned by the
		* disabled ui-layout row) and register the studio frame into the runtime's
		* built-in root slot, declaring the standard child seats so the upstream
		* sidebar/conversation/details plugins keep their registration paths.
		* @param ctx - active browser Cordis context.
		*/
		function apply(ctx) {
			if (new URLSearchParams(window.location.search).get("dsh-desktop-mode") === "advanced") {
				ctx.logger.warn("canvas-studio: advanced desktop mode keeps the desktop frame; switch the desktop profile to compatibility mode to use the studio layout");
				return;
			}
			const layout = new StudioLayoutController();
			ctx.effect(() => installStudioStyles(), "canvas-studio: studio styles");
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
					inject: () => ({ layout })
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