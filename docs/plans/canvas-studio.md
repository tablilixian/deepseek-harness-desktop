# Canvas Studio 插件开发计划

> DSH Desktop 项目内,基于官方插件体系开发的"画布式 AI 视频创作工作流"插件。本文档是开发契约:机制均有仓库内证据支撑,阶段划分与验证标准如下。

## 1. 目标与产品形态

用户在 DSH Desktop(及普通 `dsh web`)中创建"项目",每个项目对应一张画布;右侧为官方原版聊天区,用户在对话中描述创意(文字/参考图),agent 编排一系列步骤——设计分镜 → 角色定妆照 → 场景概念图 → 生成视频片段 → ffmpeg 合成——通过用户自部署的同步 POST API(生图/生视频)执行,全程节点实时呈现在画布上;用户可随时打断、修改提示词、单节点重试,也可让 agent 一路跑到出片。

- 三栏布局:左=项目列表(新建/切换),中=画布,右=官方聊天区
- 项目:插件在磁盘上自建目录 + Host 侧 JSON 注册表(存 `$DSH_HOME`),一个项目绑定一个 DSH session
- 生图/生视频:自定义同步 POST API,凭证先用明文配置
- 分发:本地安装自用;稳定后可提升为桌面内置功能

## 2. 方案选型(已确认)

**结论:插件是唯一能满足全部需求的方式。**

| 能力 | 插件 | Skill |
| --- | --- | --- |
| 自定义 UI 页面/布局 | ✅ root 槽替换 | ❌ 纯指令文档,无 UI 机制 |
| 调用外部 API | ✅ `ctx.tools.register()` | ❌ 无代码执行能力 |
| 画布状态机 | ✅ `session/event` 监听 | ❌ |
| 打断/重试 | ✅ `AgentHandle.cancel/steer/followup` | ❌ |

Skill 定位为补充组件:把创作流程规范(分镜格式、镜头参数)做成 skill 注入模型上下文。fork 上游被仓库规则禁止;Conversation Node 只能在对话内渲染,做不了独立页面。

**侵入性:对当前项目 0 修改,纯新增。** `deepseek-harness/`(pinned 子模块)与 `dsh-plugin-desktop/` 均不需要任何改动;安装发生在运行时的 `$DSH_HOME/profiles/`,开发工作全部在插件自身目录。

## 3. 机制地图(证据链)

| 计划依赖 | 官方机制 | 仓库内证据 |
| --- | --- | --- |
| 非上游包带 client 半 | `exports["./client"]` + `dsh.client` 声明 + tsdown 双构建 | `dsh-community-market/package.json` |
| 禁用官方 ui-layout 行 | patch 按 id 覆盖(`- id: xxx` + `disabled: true`) | `deepseek-harness/packages/bundle/web-app/cordis.patch.yml`(hmr 行) |
| root occupant + 座位契约 | 注册 `root` 单槽,children 声明 `conversation`(single/session-maybe)等座位 | `dsh-plugin-desktop/src/client/contracts.ts` + advanced shell 笔记 |
| 官方聊天区复用 | 官方 `ui-conversation` 保持启用,渲染进右栏座位 | 同上 |
| 工具注册 | `ctx.tools.register()` / `defineTool` | 上游 basic/tool 教程 / extension-cookbook |
| 画布数据流 | client `ctx.on('session/event')`(tool/call, tool/result) | extension-cookbook UI 插件模式 |
| 打断/重试 | `AgentHandle.cancel()` / `steer()` / `followup()` | core API |
| 产物托管 | Host 侧文件 + webServer 静态路由出 URL | 待 P3 验证 `dsh-host-webserver` 路由 API |
| 桌面安装 bundle | `desktopPnpm.runPlugin(['add', ...])`(打包 dsh CLI) | `dsh-plugin-desktop/docs/plugin-services.md` |

**唯一无直接先例处**:第三方 bundle patch 禁用 ui-layout(桌面 advanced shell 是 launcher overlay 做的)。patch 层语义明确(后层按 id 覆盖),且有三级降级:插件自带 patch → profile 自己的 `cordis.patch.yml` → `$DSH_HOME/cordis.patch.yml`。P1 首里程碑验证。

## 4. 插件结构

```
canvas-studio/
├── package.json          # dsh.bundle.patch + dsh.client + exports["./client"]
├── cordis.patch.yml      # 禁用 ui-layout + 插入 host/client 行
├── tsdown.config.ts      # host bundle + clientBundle 双产物
├── tsconfig.json / tsconfig.client.json
├── src/
│   ├── index.ts          # Host apply:项目注册表、产物静态路由
│   ├── tools.ts          # image_generate / video_generate / video_composite
│   ├── projects.ts       # 项目注册表(磁盘目录 + JSON)
│   ├── skills/           # 创作规范 skill(分镜格式、镜头参数)
│   └── client/
│       ├── contracts.ts  # SlotMap 座位声明(canvas / conversation)
│       ├── index.ts      # client apply:root occupant + session/event 监听
│       ├── root-frame.tsx # 三栏布局
│       ├── project-list.tsx / canvas.tsx / canvas-store.ts
│       └── canvas/
│           ├── CanvasSurface.tsx   # 无限画布(平移/缩放/选中/拖拽)
│           ├── CanvasNode.tsx      # 节点渲染(image/video/sticky/text/prompt)
│           ├── CanvasEdges.tsx     # 贝塞尔连线(血缘投影 + 操作颜色映射)
│           └── canvas-store.ts     # store 工厂(见 §7.4)
└── scripts/dev-install.sh # 构建 → 装进目标 profile
```

## 5. 开发循环与安装

- 改 client 代码:重建 bundle + 重启应用(web-app patch 已禁用 HMR,rev 只在启动时重算)
- 双面兼容:Host 半(工具)可在 CLI 的 `web` profile 快速迭代;UI 半在桌面 `desktop` profile 验证;bundle 各自安装互不影响
- 安装:`dsh plugin --profile <name> add ./canvas-studio`(走打包 dsh CLI / 桌面托盘终端)

## 6. 阶段计划与验证标准

| 阶段 | 内容 | 验证 |
| --- | --- | --- |
| **P1 骨架** | 独立包 + 双半构建 + patch 禁用 ui-layout + root occupant 三栏布局 + 官方对话区渲染 | `corepack yarn dev`;成功标准:加载无错、官方聊天区原样出现在右栏 |
| **P2 项目** | Host 项目注册表 + 磁盘建目录 + 新建/切换 + session 绑定 | 新建项目 → 会话切换正确、目录落盘 ✅ 已完成(2026-08-19,见 §13) |
| **P3 工具** | 三个工具接同步 POST API + 凭证配置 + 产物托管(先读 API 参考文档) | 对话中直接产出图片/视频 |
| **P4 画布** | canvas 组件 + 节点状态机(session/event)+ 产物渲染 + 血缘连线 | 跑通"文字 → 完整视频"全链路 |
| **P5 交互** | 节点级打断/改提示/重试(cancel/steer/followup) | 中途打断、修改、单节点重试 |
| **P6 收尾** | 本地安装脚本 + 创作规范 skill + 双面兼容验证 | 桌面 + 普通 `dsh web` 各跑一遍 |
| **P7(可选)** | 提升为桌面内置:workspace 化 → 桌面壳 patch 插行 → 打包 + closure 验证 → 模式开关设计 | 安装包分发、默认 profile 自带 |

## 7. P3/P4 细化(已确认输入)

### 7.1 同步 API 的工具设计(用户确认:API 同步返回)

- **状态机简化**:`GenerationTask` 裁剪为 `generating → completed | failed`(无 queued/polling);节点进度为不确定进度条(generating 态持续到响应返回)
- **超时**:fetch + AbortController,视频类调用设长超时(建议 5–10 分钟可配置);超时/网络错误以工具错误返回,agent 可自动重试
- **取消语义**:同步 API 下"打断"仅为本地中断 fetch;服务端任务无法回收 —— 工具文档向模型说明该边界,重试策略由 agent 层兜底
- **产物处理**:响应为二进制/URL → 写入项目目录 `assets/` → 返回 `{ url, width, height, duration? }` 给模型,画布直接渲染
- **凭证**:插件 Config 明文 `apiBaseUrl` + `apiKey`;结构参考 WL-AI-Director 适配器层(统一 `callImageApi` / `callVideoApi` 接口),只实现生图/生视频两个入口

### 7.2 画布模型:WL-AI-Director LayerData 字段映射

| WL 字段 | 决策 | 说明 |
| --- | --- | --- |
| `id` | ✅ 保留 | `crypto.randomUUID()` |
| `parentId` | ✅ 保留 | 分组(编组/合并节点) |
| `type` | 🔧 裁剪 | 首版只支持 `image` / `video` / `sticky` / `text` / `group` / `prompt`;`drawing` / `audio` / `panorama` 后续再说 |
| `x / y / width / height` | ✅ 保留 | 画布坐标系 |
| `src` | 🔧 替换语义 | WL 存 base64/blob;我们存 **webServer 托管 URL**(Host 侧文件) |
| `thumbnail` | ✅ 保留 | 256px LOD 缩略图(减少大图渲染卡顿) |
| `imageId / thumbnailId` | ❌ 裁剪 | IndexedDB 资产库引用;以磁盘路径 + URL 替代 |
| `color / text / fontSize` | ✅ 保留 | sticky/text 节点 |
| `title` | ✅ 保留 | |
| `createdAt` | ✅ 保留 | |
| `flipX / flipY` | ✅ 保留 | |
| `duration` | ✅ 保留 | 视频节点时长 |
| `isLoading / progress / error` | ✅ 保留(简化) | 同步 API 下 `progress` 固定 0/100,`isLoading` 即 generating 态 |
| `annotations` | ⏸ 暂缓 | 手绘标注(P4.5 可选) |
| `locked / visible / opacity / zIndex` | ✅ 保留 | |
| `sourceLayerId / sourceLayerIds` | ✅ 保留 | **核心血缘字段,驱动连线渲染** |
| `operationType` | 🔧 扩展 | 保留 WL 通用值(`text-to-image` / `image-to-image` / `image-to-video`),新增 DSH 语义值:`storyboard`、`character-sheet`、`scene-concept`、`video-clip`、`video-composite` |
| `gridData` | ⏸ 暂缓 | 九宫格数据(P4.5) |
| `generationPrompt` | ✅ 保留 | 与 `session/event` 中工具参数对应,节点重试时复用 |
| `linkedResourceId / linkedResourceType` | 🔧 重映射 | `character` → 定妆照节点;`scene` → 概念图节点;`keyframe` → 分镜节点 |
| `promptConfig`(PromptLayer 专属) | ✅ 保留 | `mode / enhancedPrompt / linkedLayerIds / outputLayerIds / nodeColor` |

**新增 DSH 特有字段**:

| 新字段 | 类型 | 用途 |
| --- | --- | --- |
| `runId` | string | 产生该节点的 `tool/call` 事件 id(回溯、重试锚点) |
| `origin` | `'agent' \| 'manual'` | 两条创作路径共用同一模型,画布标注来源 |
| `toolName` | string? | 产生节点的工具名(`image_generate` 等) |

### 7.3 关键设计决策:边不是一等数据

WL 的连线**没有独立 edge 数据** —— 边由 `sourceLayerIds` 在渲染时推导(贝塞尔曲线 + `operationType` 颜色映射 + 源角色标签)。Canvas Studio 沿用:**血缘即边**。好处:agent 工具写入血缘字段后连线自动出现,手动面板操作与 agent 操作零差异。P4.5 可加独立 edge 层(自定义箭头样式/备注)。

### 7.4 Store 动作清单

**保留**:`setProjectId` / `addLayer` / `addLayers` / `updateLayer` / `deleteLayer` / `duplicateLayer` / `reorderLayer` / `setOffset` / `setScale` / `selectLayer`(含多选)/ `clearSelection` / `clearCanvas` / `importLayers` / `exportLayers` / `copySelectedLayers` / `pasteLayers` + **新增** `linkLayers(sourceIds, targetId)` / `retryLayer(id)`

**暂缓**:`undo/redo/pushHistory`(P4.5,后续可接 `session/event` 回放)/ `selectAllLayers` / `selectMultipleLayers` / `suggestedPrompt` / `templatePanelOpen` / `activeTool/strokeColor/strokeWidth` / `integrityIssues` / `lastSaveError`

### 7.5 组件映射

| WL 组件 | 目标组件 | 备注 |
| --- | --- | --- |
| `InfiniteCanvas` | `CanvasSurface` | 平移/缩放/选中/拖拽/缩放把手,按 DSH client 纪律重写(zustand → store 工厂,props 四份额,组件不见 ctx) |
| `CanvasLayer` | `CanvasNode` | 节点渲染,`ResolvedImage` 的 LOD 加载逻辑可借鉴 |
| `ConnectionLines` | `CanvasEdges` | 贝塞尔曲线 + 颜色映射,纯渲染无状态,可高复用 |
| `Minimap` | 可选 | P4.5 |
| `CanvasToolbar` | 精简版 | 仅保留:选择/添加素材/手型/新建连线 |
| `LayerPanel / LayerDetailPanel` | 精简版 | 节点属性(改名/锁定/透明度/删除) |
| 各种 AI 生成面板 | ❌ 不移植 | 由 agent 工具承担(DSH 方案的增值) |

### 7.6 事件流映射(`session/event` → store)

| session/event | store 动作 |
| --- | --- |
| `tool/call`(image/video 工具) | `addLayer({ origin: 'agent', runId, operationType, isLoading: true })` + 血缘 `linkLayers`(若引用图) |
| `tool/result` | `updateLayer({ src: url, thumbnail, isLoading: false, error: undefined })` |
| `tool/error` | `updateLayer({ isLoading: false, error })` + 节点红色标记,边保留 |
| 用户打断(cancel) | `updateLayer({ isLoading: false, error: '已中断' })` |
| 手动面板(后续) | 同一组 actions,`origin: 'manual'` |

### 7.7 持久化

- `canvas.json` 存项目目录,Host 端 atomic write(`dsh-atomic-write` 语义,参考桌面壳 replace 模式)
- 资产文件落 `assets/` 子目录,webServer 静态路由出 URL
- 打开项目 → client 拉取 `canvas.json` → `importLayers` 恢复画布;节点定位按 `title` 匹配,后续接 `linkedResourceId`

### 7.8 P4 验证标准

1. 对话中跑通:创意文字 → 分镜节点 → 定妆/概念图节点 → 片段节点 → 合成视频节点,全链路边自动生成
2. 打断后节点标记中断态,重试后同节点更新不产生新边
3. 刷新/重开项目后画布完整恢复

## 8. WL-AI-Director 参考

参考项目 `/Users/wl/Desktop/job/learn/WL_AI_Studio/reference/WL-AI-Director`:AI 漫剧工场,Script → Asset → Keyframe → Video 工业化工作流(React 19 + Vite + IndexedDB,多厂商 AI 适配)。

### 可借鉴资产

- **LayerData 模型**:血缘 `sourceLayerIds[]`、`operationType`(24 种)、`generationPrompt` 回溯、`thumbnail` LOD、`progress/error` 节点状态、`parentId` 分组
- **PromptLayer**:节点=一次 AI 操作(`linkedLayerIds` 输入 → `outputLayerIds` 输出,`mode` / `enhancedPrompt` / `nodeColor`)
- **ConnectionLines**:SVG 贝塞尔曲线、操作类型→颜色映射、源角色标签
- **AI 适配器层**:chat/image/video 统一接口 + 三级 API key 兜底(仅借鉴结构)
- **MKR 多关键帧**:首帧+尾帧插值生成视频,解决一致性(建议纳入工具设计,作为后续增强)
- **九宫格分镜预览**:一键拆分 9 视角选格作首帧(后续增强)
- **FlowState**:select → analyze → deduce → storyboard → video → done(结构化编排替代方案)
- **一致性检查**:服装/发型/道具冲突检测 + 评分(进阶增强)
- **时间轴/导出**:EDL/FCPXML 导出、renderLogs 追踪(收尾增强)

### 架构关键洞察

WL 的所有操作都是**用户手动点面板触发**;DSH 方案的增值是 **agent 自主编排**。两者共用同一数据模型:agent 工具调用 → 生成与手动面板同语义的 LayerData(带 `operationType` + 血缘)→ 画布渲染层 100% 复用。"打断/重试"天然落地:**重试=在同一血缘节点上重新执行一次操作**,画布自动更新边。

### 许可证边界

WL-AI-Director 是 **CC BY-NC-SA 4.0(非商业)**,DSH Desktop 是 MIT。**代码直接移植有许可冲突风险**:模型/数据结构/交互设计层面借鉴(概念不受版权约束);代码移植需获得作者授权(联系 antskpro@qq.com)。

## 9. 与本地 dsh 共存规则

桌面与 CLI 共享 `~/.dsh`(或 `$DSH_HOME`):`profiles/`、机器级 `cordis.patch.yml`、`settings.yaml`、`storages/`。这是官方语义的正常行为,遵守三条边界即安全:

1. **同一 profile 禁止桌面与 CLI 同时运行**(无跨进程 profile 锁,会话/存储有并发写风险)
2. 不从 CLI 启动桌面的 `desktop` profile(桌面专属行在无 Electron 环境会失败)
3. 桌面启动 CLI 建的 profile 兼容模式一般可用(桌面服务按可选注入降级)

## 10. 内置化路径(P7 前瞻)

仿照 `dsh-community-market`:加根 workspaces → 声明为 `dsh-plugin-desktop` dependency → 桌面壳 `cordis.patch.yml` 插行 → 进打包清单(asarUnpack + `verify:closure` 门禁)。注意:无条件 root 替换与兼容模式哲学冲突,内置时建议做成"随包分发 + profile 组合启用"或挂模式开关。

## 11. 待确认项

- API 参考文档:P3 开始时阅读,细化三个工具的参数设计
- 插件目录位置、开发环境就绪度:P1 开工时确认

## 12. P1 验证结论(已落地)

P1 骨架已完成并通过 headless 验证(2026-08-19):

- **包与构建**:`canvas-studio/` 加入根 workspaces(仓库规则:所有自有包用根 Yarn),双半构建通过:Host `lib/index.js`(tsc)+ client `lib/client.js`(tsdown + ModuleLoader banner),`verify:loader` 验证单模块注册
- **组合验证**:装进独立 `studio` profile(base + web-app + canvas-studio),`--dump-config` 确认 `ui-layout` 被禁用、官方 `ui-sidebar`/`ui-conversation` 等行保留、`canvas-studio` 行插入
- **Loader 冒烟**:`dsh --profile studio` 整树挂载,`dsh web: http://127.0.0.1:3080` 就绪,0 错误
- **HTTP 验证**:boot manifest 含 canvas-studio 客户端行;`/plugins/canvas-studio/client.js` 返回 200 + ModuleLoader 注册
- **桌面 GUI 验证**:集成进 desktop profile 后,`corepack yarn dev` 启动,三栏工作台(左项目占位 / 中画布占位 / 右官方对话区)显示正常

### 组合约束(源码级核实)

- **root children 声明全局唯一**:第二个 root occupant 声明已存在的座位会在加载时抛错。canvas-studio 声明全部四个官方座位(sidebar/conversation/details/shell.overlay),ui-sidebar 与 ui-conversation 对 sidebar/details 是**裸 register**(非 inject),未声明即抛错 —— 所以必须完整声明
- **`ctx.layout` 服务所有权**:禁用 ui-layout 后其提供的 `layout` 服务消失,canvas-studio client 半用 `ctx.reflect.provide('layout', ...)` 补位(ui-sidebar 注入它)
- **桌面 advanced 模式不共存**:desktop advanced shell 也注册 root 并声明 children,与 canvas-studio 冲突;canvas-studio client 检测 URL 参数 `dsh-desktop-mode=advanced` 时跳过注册,保持桌面帧不变
- **同 priority 重复注册抛错**:与 middle-panel 这类"自建 root 的插件"不能同 profile 共存(需移除其一)
- **in-box bundle 不进 profile pnpm**:`@deepseek-ai/dsh-web-app` 的 frontend 未发布,profile manifest 直接列名即可(经 `$DSH_HOME/profiles/node_modules` 愈合回退解析)
- **上游构建前提**:从源码跑 web 冒烟需先 `corepack yarn upstream:build`(frontend dist + 各 client bundle)
- **桌面 profile 的 pnpm 是 v11**:profile node_modules 由桌面壳的 pnpm 11 维护(store v11);CLI 转发的 pnpm 是 v10 会报 store 不匹配 → 在 profile 目录直接用 `corepack pnpm@11.7.0 <verb> <spec>`,再手工维护 `dsh.profile.bundles` 列表

## 13. P2 验证结论(已落地)

P2 项目注册表已完成并通过 headless 验证(2026-08-19):

- **Host 注册表**:`$DSH_HOME/canvas-studio/projects.json`(`{version:1,projects[]}`)+ `projects/<id>/`(含 `assets/`);目录 0700、注册表 0600;写注册表走 `@deepseek-ai/dsh-atomic-write`(随机后缀 temp + rename)
- **路由**:`GET/POST /canvas-studio/projects` 注册进 `ctx.webServer`(kind exact);GET 要求 loopback 权威(remoteAddress 回环 + host 端口/主机名匹配 + sec-fetch-site 非 cross-site),POST 额外要求同源 Origin —— 与 community-market 同一信任模型
- **Client**:`ProjectList` 替换左侧占位(新建表单/项目列表/加载/错误态),`createProjectStore()` 工厂(defineStore,`@deepseek-ai/dsh-client-runtime/client` 是官方 RUNTIME_STORE_EXEMPTION external,可运行时 require);async fetch 全在 inject 回调,经 store actions 提交
- **会话绑定**(已定案):每项目一个 workspace,路径 = 项目磁盘目录;打开项目 = `ctx.workspaces.create({ path: project.dir })`(Host `ensureWorkspace` 按路径幂等,返回值即注册表内记录)+ `ctx.workspaces.startSession(workspaceId)`(复用/新建 blank session 并导航)。项目记录暂不持久化 sessionId(P3+ 再挂)
- **会话标题同步**(2026-08-19 补):`openProject` 在 `create` 之后立即 `await ctx.workspaces.rename(workspace.workspaceId, project.name)`,使右侧会话标题与左侧项目名统一(否则默认显示 workspace UUID)。`rename` 失败时当前实现会进入错误态并中止会话启动;若希望 rename 失败也继续启动(标题回退 UUID),可在 P3 改为"尽力改名、失败只记日志"的降级
- **冒烟**:studio profile 启动 0 错误;GET 200 空表、POST 201 建项目(目录+assets 落盘、注册表更新)、无 Origin POST 405、非法名(空/斜杠/缺字段)400;`/plugins/canvas-studio/client.js` 200(rev 更新)

### 新增源码级事实

- **client bundle 运行时依赖**:`defineStore` 从 `@deepseek-ai/dsh-client-runtime/client` require —— 该 specifier 是上游 `CLIENT_EXTERNALS` 的文档化豁免(RUNTIME_STORE_EXEMPTION),loader 模块表直接应答,canvas-studio 的 external 列表含它即可
- **workspace.create 幂等**:Host 侧 `ensureWorkspace` 先 `registry.resolveByPath` 再建,client 侧 `manager.create` 成功后 upsert 进本地列表 —— 所以 create 返回后 `startSession(workspaceId)` 一定能找到该 workspace

### 桌面 GUI 收尾修复(2026-08-19,P2 最终确认)

桌面 GUI 经人工确认:左侧项目列表可见、`+ 新建项目` 新建/切换、右栏会话标题与项目名统一。期间修了三处,均已在 `canvas-studio` 源码头提交式落地:

1. **可见性(对比度)**:原 `styles.ts` 中项目栏按钮/输入框/项目项/日期/空状态大量使用 `color-mix(in srgb, currentColor ...)`,而桌面壳未向该区域注入主题 `currentColor`,导致浅色文字与白色背景融合、功能存在但"看不见"。已改为明确的 `var(--dsw-fg, #1f2328)` 并提高边框透明度,浅色背景下可见。**深色主题仍未适配**(`.csFrame` 仍 fallback `#ffffff`/`#1f2328`),见 §14 待办。
2. **会话标题同步**:见上"会话标题同步"条,`openProject` 内 `rename`。
3. **防御性**:`ProjectList.tsx` 增加 `projects` 数组 / 无效 `createdAt` 防御,新增 `ProjectListErrorBoundary`(崩溃信息显现在 UI 而非被上游 `SlotErrorBoundary` 吞成空 div);`StudioFrame.tsx` 的 `refreshProjects()` mount 调用加 `.catch` 日志便于排查加载失败。

> 排查起点误区提示:最初怀疑是桌面 `advanced` 模式导致 `index.ts` 的 `dsh-desktop-mode=advanced` 守卫整段跳过注册 —— 实则 GUI 已挂载,排除此因。该守卫仍保留(桌面 advanced shell 与 canvas-studio 抢 root 单槽,冲突未解,属 P7 内置化议题)。

## 14. 待办与已知问题

- **深色主题适配(已完成,2026-08-19)**:调研结论 —— 官方设计系统由 `@deepseek-ai/dsh-client-ui-theme` 拥有 `--dsw-alias-*` 语义 token(编进 web shell `base.css`,全局加载,与 `ui-layout` 无关),按 `body[data-ds-dark-theme]` 区分明暗两套值;`data-ds-dark-theme` 由 `ui-theme` 的 host 引导脚本按偏好写入 body(桌面已启用深色,对话区即证)。canvas-studio 的 `styles.ts` 已全部改用 `--dsw-alias-*` token(背景 `--dsw-alias-bg-base`、文字 `--dsw-alias-label-primary`、边框 `--dsw-alias-border-l2`、hover/active `--dsw-alias-interactive-bg-*`、错误 `--dsw-alias-state-error-primary`、滚动条按官方契约重绑 `--dsw-alias-scrollbar-*`),自动跟随应用主题,不再硬编码颜色。后续 P3/P4 新增 UI 一律沿用 `--dsw-alias-*`,不得写字面色或 `currentColor`。
- **rename 失败降级**:当前 `openProject` 的 `rename` 抛错会中止会话启动;若实际遇到标题冲突等,建议改为"尽力改名、失败只日志"(见 §13 会话标题同步条)。
- **项目记录持久化 sessionId**:P2 设计上暂不持久化,打开项目每次重建 workspace;如要避免重复 workspace 堆积,可在 P3+ 把 sessionId 写回项目注册表。

## 15. P3 实现记录（2026-08-19）

P3「工具 + 产物托管」代码落地,构建与类型检查通过（`canvas-studio` 工作区）。核心思路:**生成与落盘放在 Host 侧(Node,规避渲染进程 CORS),client 工具经 webServer 路由调 Host**,Host 调 Drama Backend → 写项目 `assets/` → 返回托管 URL。配置按用户要求先用明文(环境变量优先,回退明文常量),验收后再整理。

### 新增 / 修改文件
- `src/config.ts`（新增,Host）:明文配置 `DRAMA_API_BASE` / `DRAMA_API_KEY`(环境变量 `CANVAS_STUDIO_DRAMA_API_BASE` / `CANVAS_STUDIO_DRAMA_API_KEY` 优先,回退明文常量,验收后整理);导出 `DRAMA_ENDPOINTS`、`sizeForAspectRatio`、`newAssetId`。接口形态参考 WL-AI-Director `services/adapters/imageAdapter.ts` / `videoAdapter.ts`。
- `src/generate.ts`（新增,Host）:`generateAsset(registry, port, tool, projectId, params, signal)` —— 按工具分派 Drama Backend 端点(txt2image / image2image / image2videomsr / image2videomkr)、上传参考图、下载产物、写 `assetsDir(projectId)`、返回 `{url,width,height,duration?}`。
- `src/routes.ts`（改,Host）:新增 `POST /canvas-studio/generate`(同源自 POST,校验后调 `generateAsset`)与 `GET /canvas-studio/assets`(prefix,loopback+同源校验 + 路径穿越防护,流回 png/mp4)。
- `src/client/api.ts`（改）:新增 `generateAsset(projectId, tool, params)` helper,POST `/canvas-studio/generate`。
- `src/client/tools.ts`（新增,client）:`createStudioTools(context)` 返回 `image_generate` / `video_generate` / `video_composite` 三个 `defineTool` 定义(参数 schema + output schema + render 文本块);execute 调 `generateAsset`。
- `src/client/index.ts`（改）:`inject` 加 `'tools'`;新增模块级 `activeProjectId`(openProject/createProject 时更新),`apply` 内 `ctx.tools.register` 注册三工具。

### 工具语义（首版,验收后增强）
- `image_generate(prompt, aspectRatio?, imageUrl?, negativePrompt?)`:文生图;传 `imageUrl` 走图生图。返回 `{url,width,height}`。
- `video_generate(prompt, imageUrl, aspectRatio?, duration?)`:图生视频(image2videomsr)。`imageUrl` 通常来自 `image_generate` 产物。返回 `{url,width,height,duration}`。
- `video_composite(prompt, imageUrls[], aspectRatio?, duration?)`:多图合成视频(首尾帧 image2videomkr)。返回同上。

### 验收方式
1. 启动桌面(兼容模式)并打开/新建一个项目。
2. 设置 Drama Backend 环境变量(或改 `src/config.ts` 明文常量):`CANVAS_STUDIO_DRAMA_API_BASE`、`CANVAS_STUDIO_DRAMA_API_KEY`。
3. 在对话中让 agent 调用 `image_generate` → 出现图片 URL;再 `video_generate(imageUrl=…)` → 视频 URL。
4. 产物落在 `~/.dsh/canvas-studio/projects/<id>/assets/`;浏览器经 `http://127.0.0.1:<port>/canvas-studio/assets/<id>/<file>` 访问。

### 已知简化（待 P3 收尾 / 整理）
- 配置明文,验收后改为加密 / 配置中心;API key 不应进仓库。
- `video_composite` 当前仅首尾帧插值,九宫格 / 多关键帧(MKR grid)、音频合成等后续增强。
- 工具未显式声明 `timeoutMs`(`exec.signal` 已转发到 fetch,同步 API 下取消为本地中断)。
- 产物尺寸固定按宽高比映射,未接 WL 的 `sizeConfig` 全量。
