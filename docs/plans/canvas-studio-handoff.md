# Canvas Studio 交接文档(2026-08-20,S1–S7 参考集成完成)

> 用途:新开对话继续开发前的完整上下文。本文件 + [`docs/plans/canvas-studio.md`](./canvas-studio.md)(完整计划)+ [`docs/plans/canvas-studio-reference-integration.md`](./canvas-studio-reference-integration.md)(S1–S7 集成契约)是当前权威。本文件记录"当前状态、已验证机制、环境事实、下一步"。

## 1. 当前状态

**P1–P4+ 全部完成,参考画布 S1–S7 集成完成并已提交推送。**

- 仓库根新增 `canvas-studio/` 独立包(已入根 workspaces,一行),桌面 profile 已集成(`corepack yarn dev` 可见三栏工作台)。
- P1(骨架 + 三栏)、P2(项目注册表 + 会话绑定)、P3(媒体工具 + 产物托管,Host 侧注册 + 落盘 + 静态托管)、P4(捕获生成产物上画布)、P4+(持久化画布 + 重启恢复 + 血缘 + 会话级项目归属)均已完成。
- **参考画布集成(S1–S7)已完成**:把用户提供的 WL-AI-Director 风格画布参考(`reference/canvas-module-design.md` + `reference/canvas/` 92 个文件)概念级借鉴进 Canvas Studio,全部按 DSH 纪律重写,每个借鉴点带来源文件标注(见集成计划文档 §4/§5 的来源地图与许可证边界)。**已提交 `9a314b6e88` 并推送到 fork(`origin/canvas-studio`)**。
- **验证状态**:`corepack yarn workspace canvas-studio check`(build + verify:loader + typecheck)全绿,`test:smoke` **16/16 通过**。根级 `corepack yarn check` 仍被缺失的 `dsh-community-fabric` / `dsh-community-market` 包阻塞(既有仓库状态,与本次改动无关,见 §5)。
- **许可证边界**:参考源码是 CC BY-NC-SA 4.0,DSH Desktop 是 MIT —— 只做概念/算法/结构级借鉴,不逐字移植;`reference/` 目录已加入 `.gitignore`,**不进入 MIT 仓库**。

## 2. 参考画布集成(S1–S7)摘要

集成计划文档 `docs/plans/canvas-studio-reference-integration.md` 定义了 7 个阶段,每阶段独立验收/提交。执行结果:

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| S1 模型 + 迁移 | `contracts/canvas.ts` 扩为 v2(`CANVAS_DOCUMENT_VERSION = 2`):`operationType`/`generationPrompt`/`locked`/`visible`/`opacity`/`flipX|Y`/`parentId`/`zIndex`/`loading`/`error`/`progress`/`duration`;`projects.ts` `normalizeCanvasDocument` 做 v1→v2 迁移(zIndex 按文档序递增、补默认值);`generate.ts` `operationTypeOf`/`generationPromptOf` | 完成 |
| S2 连线渲染 | `CanvasEdges.tsx` 重写:按操作类型着色的水平贝塞尔(`|dx|*0.5`)、箭头 marker、中点中文操作胶囊、多源角色标签(首帧/中间帧/尾帧)、端点选中高亮;props 改 `selectedNodeIds` | 完成 |
| S3 状态与交互 | `project-store.ts` 全量重写(多选、undo/redo 快照历史 cap 20、剪贴板、z 序、编组/解组、对齐/分布、`autoArrange` 按血缘深度、`linkLayers`、pending 节点三件套);`canvas-math.ts`(clamp/calculateSnap 5px 六类对齐线 + 网格吸附/contentBounds/screenToWorld/worldToScreen);`CanvasNode.tsx` 重写(交互元素抑制、8 向缩放把手、内联重命名、连线手柄、锁定/加载/错误角标、flip/opacity);`CanvasSurface.tsx` 重写(中键/Shift 平移、Ctrl+滚轮绕光标缩放 0.1–5、fitToContent、窗口快捷键 Delete/Ctrl+C/V/Z/Y/A/Escape、拖拽吸附 + 引导线、resize/link 手势、缩放簇、内嵌 Minimap) | 完成 |
| S4 生成中占位 | pending 节点数据流:`asset-capture.ts` `onToolCall` 放置占位节点(loading + 进度条),`onToolError` 从 `tool/result` 的 `data.error` 标记错误(字符串/`{message}`/兜底文案);成功结果触发画布重载(单一真相源从 Host 重读) | 完成 |
| S5 面板 | 新增 `CanvasToolbar`(撤销/重做/删除/编组/对齐/分布/整理布局/新建便签·文本·提示)、`LayerPanel`(图层列表:缩略图/锁定/可见性/层级/删除 + 搜索)、`LayerDetailPanel`(标题/透明度/镜像/锁定/层级/生成参数预览/重试/修改提示词/打断/删除 + 内联 steer 输入)、`Minimap`(内容拟合 + 视口框拖拽导航);全部并入 `StudioFrame` 布局 | 完成 |
| S6 编组/对齐/布局/连线 | 已随 S3 的 store actions + CanvasSurface 手势落地(对齐/分布/编组/解组/手动连线/整理布局) | 完成 |
| S7 节点级重试/修改提示词/打断 | `generate.ts` 支持 `retryOf`(原地更新节点,保留 id/位置/血缘/编组,不产生新边;`generationPrompt` 不夹带锚点);`api.ts` 新增 `retryStudioNode`(解析 `generationPrompt` 重放原参数 + overrides);客户端注入 `'sessions'`,`cancelCurrentTurn` 经 `ctx.sessions.binding(current).session.cancel()` 打断;上下文菜单与属性面板接通重试/修改提示词/打断 | 完成 |

**关键上游事实(S7 依据,源码级核实)**:
- **无 `tool/error` 事件** —— 工具错误以 `tool/result` 的 `data.error` 呈现(参考 `packages/session/session-checkpoint-policy/tests/crash-recovery.e2e.ts` 的 error 形态)。
- 客户端 `SessionFace` 有 `prompt(content, 'queue'|'steer')` 与 `cancel()`;`ctx.sessions` 是合法 client inject(ui-conversation 同款);取会话 face:`ctx.sessions.list.getSnapshot().current` → `ctx.sessions.binding(id)?.session`。

## 3. 已建文件

```
canvas-studio/
├── package.json          # dsh.bundle.patch + dsh.client + exports["./client"] + scripts
├── cordis.patch.yml      # insert 自身行 + 禁用 ui-layout
├── tsconfig.json / tsconfig.client.json / tsdown.config.ts
├── scripts/              # clean.mjs / dev-install.mjs / verify-client-loader.mjs
├── tests/
│   ├── asset-capture.test.mjs   # [P4/P4+/S7] 16 用例(原 8 + S7 新增 8)
│   └── generate.test.mjs        # [S7 新增] 3 用例:retryOf 原地更新/缺失目标报错/普通追加
└── src/
    ├── config.ts         # [P3] 明文配置:DRAMA_API_BASE/KEY、ENDPOINTS、sizeForAspectRatio、newAssetId
    ├── contracts/
    │   ├── project.ts    # StudioProject 共享类型
    │   └── canvas.ts     # [P4+/S1] StudioCanvasNode(v2)/StudioCanvasDocument/StudioCanvasOperationType/CANVAS_DOCUMENT_VERSION/NODE_DEFAULTS
    ├── projects.ts       # Host:ProjectRegistry + readCanvas/writeCanvas/appendCanvasNode + normalizeCanvasDocument
    ├── generate.ts       # [P3/S7] generateAsset + retryOf + operationTypeOf/generationPromptOf + GenerateParams
    ├── routes.ts         # /canvas-studio/projects | /canvas-studio/canvas | POST /generate | GET /assets
    ├── host-tools.ts     # [P3 修正] Host 侧三个 defineTool + resolveProjectId(cwd 反查项目)
    ├── asset-capture.ts  # [P4/S4/S7] STUDIO_TOOL_KINDS/isStudioTool + createAssetCaptureDefinition(hooks) + StudioToolCallInfo
    ├── index.ts          # Host:inject(['webServer','tools'])/apply(注册表 + 路由 + 工具注册)
    └── client/
        ├── index.ts      # apply:advanced 跳过 + provide layout + register root;inject ['slots','workspaces','conversationEvents','sessions']
        │               # 会话级归属 + 共享 store 实例 + 捕获/占位/错误接线 + retry/steer/cancel 回调
        ├── layout-controller.ts  # ILayout 实现(P1 全 no-op)
        ├── api.ts        # list/create/deleteStudioProject + load/saveStudioCanvas + retryStudioNode
        ├── project-store.ts      # [S3/S6] createProjectStore() 工厂(defineStore):全量 actions + 选择器 + 历史/剪贴板/分组/对齐/布局
        ├── contracts.ts  # StudioProjectListInjected + StudioActions(= EngineStoreInstance actions 绑定类型)
        ├── ProjectList.tsx       # 项目列表 + 新建表单 + 行内删除
        ├── StudioFrame.tsx       # 三栏框架 + CanvasToolbar + CanvasSurface + CanvasTimeline + LayerPanel + LayerDetailPanel + CanvasContextMenu
        ├── styles.ts     # 注入 <style data-plugin="canvas-studio">;全部画布/节点/边/面板/菜单样式(--dsw-alias-* 语义 token)
        └── canvas/
            ├── canvas-math.ts    # [S3 新增] clamp/calculateSnap/contentBounds/screenToWorld/worldToScreen
            ├── CanvasEdges.tsx   # [S2] 操作类型着色边 + 角色胶囊
            ├── CanvasNode.tsx    # [S3/S4] 节点盒 + 缩放/重命名/连线/角标/占位
            ├── CanvasSurface.tsx # [S3] 无限画布(平移/缩放/拖拽/吸附/快捷键/最小图)
            ├── CanvasTimeline.tsx # [P4+] 按时间回看/定位条
            ├── Minimap.tsx       # [S5 新增] 内容拟合 + 视口框拖拽导航
            ├── CanvasToolbar.tsx # [S5 新增] 工具栏
            ├── LayerPanel.tsx    # [S5 新增] 图层列表
            ├── LayerDetailPanel.tsx # [S5 新增] 节点属性/重试/修改提示词
            └── CanvasContextMenu.tsx # [S5 新增] 节点右键菜单
```

## 4. 已验证机制(源码级核实,不要推翻)

1. **root children 声明全局唯一**:同时只有一人能声明某座位。canvas-studio 必须声明全部四个官方座位 `sidebar`/`conversation`/`details`/`shell.overlay`(ui-sidebar 与 ui-conversation 对它们是**裸 register**,未声明即整树抛错)。
2. **`ctx.layout` 服务补位**:ui-layout 被禁后 canvas-studio client 用 `ctx.reflect.provide('layout', layout)` 补位,实现 `ILayout`。
3. **桌面 advanced 模式降级**:client 检测 `window.location.search` 的 `dsh-desktop-mode=advanced` 时跳过注册;用户 profile 是兼容模式,正常生效。
4. **同 priority 重复注册抛错**:两个自建 root 的插件不能同 profile。
5. **客户端模块发现链**:host Loader 条目 name → 包 `dsh.client` 声明 → 浏览器加载 `/plugins/<name>/client.js`。改 client 代码 = 重建 bundle + 重启应用。
6. **patch 层序与语义**:profile bundles 依序 → profile 自己 cordis.patch.yml → `$DSH_HOME/cordis.patch.yml`;patch 按 id 替换整个 config(非深合并);空 patch 文件必须是显式 `[]`。
7. **in-box bundle 不进 profile pnpm**:`@deepseek-ai/dsh-base`/`dsh-web-app` 等经 `$DSH_HOME/profiles/node_modules` 愈合回退解析;pnpm 只管 out-of-tree 包。
8. **桌面 profile 的 pnpm 是 v11**(store v11):子模块 dsh CLI 转发的 pnpm 是 v10 会报 store 不匹配;桌面 profile 操作须在 profile 目录直接 `corepack pnpm@11.7.0`,再手工维护 `dsh.profile.bundles`。
9. **上游构建前提**:跑 web 冒烟(任意 profile)需先 `corepack yarn upstream:build`。
10. **canvas-studio 的 client bundle 无运行时上游依赖**:对 `@deepseek-ai/*` 全是 type-only import(被擦除),唯一运行时外部依赖是 `react/jsx-runtime`(shell 提供)。
11. **client bundle 可运行时 require runtime store 引擎**:`@deepseek-ai/dsh-client-runtime/client` 是上游 `CLIENT_EXTERNALS` 的文档化豁免(RUNTIME_STORE_EXEMPTION),loader 模块表直接应答 —— `defineStore` 从它 import。
12. **workspace.create 幂等**:Host 按路径 resolve-by-path 复用;绑定流程 `ctx.workspaces.create({ path: project.dir })` + `startSession` + `rename`(标题同步)。
13. **项目注册表权限**:目录/注册表 0700/0600;写注册表走 `writeFileAtomic`(`@deepseek-ai/dsh-atomic-write`)。
14. **webServer 路由信任模型**:GET 要求 loopback 权威(remoteAddress 回环 + host=127.0.0.1:port + sec-fetch-site 非 cross-site),POST 加同源 Origin。冒烟 curl 必须带 `-H "origin: http://127.0.0.1:3080"`。
15. **Host 是画布节点单一真相源**:`generateAsset` 落盘后直接写 `canvas.json`(含 `sourceIds` 血缘);capture 只负责触发客户端重载/占位/错误标记,不直接写节点。
16. **会话级项目归属**:`client/index.ts` 订阅 `ctx.workspaces.list`,用 `recentWorkspaceId → view.path === project.dir` 把当前 workspace 映射为画布项目,自动 select + 载入;重启恢复会话后画布不再空态。
17. **相对产物 URL**:`generate.ts` 产物 URL 为同源 `/canvas-studio/assets/<projectId>/<file>`(删 `port` 参数链路);`api.ts` 载入时把旧绝对 URL 归一化,桌面重启换端口不失效。
18. **注入面 actions 绑定**:inject face 的 `actions` 类型用 `EngineStoreInstance<State, Actions>['actions']`(运行时绑定好的、剥离 draft 的版本),不是 `ProjectStoreActions` 字面量类型。
19. **exactOptionalPropertyTypes 纪律**:canvas-studio tsconfig 开启 `exactOptionalPropertyTypes`;构建节点对象时禁止显式赋 `undefined` 给可选字段(用条件展开/解构剥离),契约字段保持 `field?: T`。

## 5. 环境事实

- 仓库:`/Users/wl/Desktop/job/learn/WL_AI_Studio/reference/deepseek-harness-desktop`,分支 `canvas-studio`,HEAD `9a314b6e88`(S1–S7 集成),已推送 fork `origin/canvas-studio`。
- 子模块 pinned `dsh-v0.1.0-rc.7`(99f6f02),**永不编辑**,上游命令走根脚本(`corepack yarn upstream:build`)。
- `$DSH_HOME` 未设置 → `~/.dsh`;profile:`desktop`(桌面在用,已集成 canvas-studio)、`studio`(web CLI 冒烟用)。
- 桌面 profile settings.yaml 有用户 LLM 配置(wlqw provider,模型 `qwopus3.6-27b-v2-mtp-nvfp4`)。
- 用户参考项目:`/Users/wl/Desktop/job/learn/WL_AI_Studio/reference/WL-AI-Director`(CC BY-NC-SA,只借鉴概念/交互/算法,不移植代码)。
- 桌面 dev 实例 webServer 端口动态;CDP 调试端口 9222;重启前须删 `~/Library/Application Support/DSH Desktop/{SingletonLock,SingletonSocket,SingletonCookie}` 与 `crash-evidence/active-run.json`;CDP 脚本在 `/var/folders/v4/sbr4hr2d6t1dzss1ssrhblxw0000gn/T/opencode/dsh-cdp/`。
- 根级 `corepack yarn check` 失败:缺 `dsh-community-fabric` / `dsh-community-market` 包(AGENTS.md 规定它们暂为私有文档脚手架,不得声明可加载入口)。**与本插件改动无关**,验证以 workspace 级 check + smoke 为准。

## 6. 命令备忘

```sh
# 构建 / 验证(canvas-studio)
corepack yarn workspace canvas-studio build
corepack yarn workspace canvas-studio typecheck
corepack yarn workspace canvas-studio check        # build + verify:loader + typecheck
corepack yarn workspace canvas-studio test:smoke   # 16 用例(asset-capture 13 + generate 3)

# 上游构建(首次或改上游后)
corepack yarn upstream:build

# web 冒烟(studio profile;桌面 profile 同理,注意别与运行中的桌面抢 3080)
cd deepseek-harness && node --import tsx/esm apps/cli/src/bin.ts --profile studio
# 浏览器开 http://127.0.0.1:3080

# 桌面启动
corepack yarn dev
# 桌面 dev 实例 webServer 端口动态;重启前清理 singleton 锁
rm -f ~/Library/Application\ Support/DSH\ Desktop/Singleton{Lock,Socket,Cookie}
rm -f ~/Library/Application\ Support/DSH\ Desktop/crash-evidence/active-run.json

# 可视化验收(兼容模式 + 种子)
# 打开桌面窗口后地址栏加 ?cs-dev-seed=1 → 新建/打开项目 → 画布应显示示例图/视频/便签

# 桌面 profile 装/卸插件(必须 corepack pnpm@11.7.0,然后手工改 bundles)
cd ~/.dsh/profiles/desktop && corepack pnpm@11.7.0 add /Users/wl/.../canvas-studio
```

## 7. Git 工作流(fork 双 remote)

```sh
git remote -v
# origin   git@github.com:tablilixian/deepseek-harness-desktop.git   ← 自己的 fork(开发分支推这里)
# upstream git@github.com:anywhere-labs/deepseek-harness-desktop.git ← 上游(只 fetch)

# 日常开发:在 canvas-studio 分支提交 + 推送
git add ... && git commit -m "feat(canvas-studio): ..."
git push                                  # 推到自己 fork 的 canvas-studio

# 同步上游(随时可做;两步):
git fetch upstream
git push origin upstream/master:master    # fork 的 master 对齐上游
git merge upstream/master                 # 在 canvas-studio 上执行
git submodule update --init --recursive   # 若上游更新了子模块 pin
```

注意:master 永远只跟踪上游;所有开发在 `canvas-studio`。提交时**只 stage `canvas-studio` 与 `docs`**,排除 `.workbuddy/` 与 `reference/`(已入 `.gitignore`);子模块保持干净(改动前先 `git -C deepseek-harness checkout -- pnpm-lock.yaml` 还原)。

## 8. 纪律提醒

- 不编辑 `deepseek-harness/` 子模块;桌面产品文件(dsh-plugin-desktop 等)不动。
- client 组件纪律:props 四份额(PropsRuntime/PropsRenderSlots/PropsStore/inject),组件不见 ctx;store 用 `createXXXStore()` 工厂(defineStore);async 业务全在 apply/inject 回调,经 store actions 提交;产品文案中文、注释英文;样式注入 `<style data-plugin>`,不引入 CSS Modules/Tailwind;颜色一律 `--dsw-alias-*` 语义 token。
- Host 侧按上游惯例:name/inject/Config/apply,`ctx.get()` 读可选服务;webServer 路由注册返回 disposer,经 `ctx.effect()` 挂载。
- 许可证纪律:参考源码(CC BY-NC-SA)不进入仓库;只借鉴概念/结构/算法,每个借鉴点带来源标注。
- 完成当前阶段后:更新交接文档 + 计划文档对应章节,再提交一次(先还原子模块,只 stage canvas-studio 与 docs)。

## 9. 已提交记录

- P1 骨架:`4155603dd` + `30c935c3`(handoff 文档/fork 工作流)
- P2 项目注册表核心:`8786414361`
- P2 收尾 + 深色主题:`a0e74865ed`
- P3(工具 + 产物托管):`16d7666130` + 闪退修复 `c3411814cb`
- P4/P4+/§18/§19(捕获上画布 + 持久化 + 会话级归属 + 相对 URL):合并提交(见计划 §16–§19)
- 修复:render 结果值、共享 store 实例:`b700b80de2` / `6ce1e0a8bb`
- **参考画布 S1–S7 集成:`9a314b6e88`(当前 HEAD,已推送)**

## 10. 下一步

1. **桌面可视化验收(建议)**:重启 `corepack yarn dev`(兼容模式)→ 打开/新建项目 → 验证:画布平移/缩放/拖拽、节点缩放/重命名/连线手柄、右键菜单(重试/修改提示词/打断)、图层列表/属性面板、工具栏(编组/对齐/整理布局)、时间线回看、`?cs-dev-seed=1` 种子画面。真实生成验收需 drama-api 可达 + 桌面启动设 `NO_PROXY=localhost,127.0.0.1`(绕过 Privoxy)。
2. **单测补强(可选)**:store 的 undo/redo/分组/对齐/吸附(需在 React 外跑,测试框架支持 import `project-store.ts` 经 tsx)——当前 smoke 已覆盖 capture 与 generate 核心路径。
3. **收尾**:`docs/plans/canvas-studio.md` 主计划的 P4+ 章节按本次 S1–S7 结果修订(§17 完整版画布、§19 会话级归属需标注"已落地")。