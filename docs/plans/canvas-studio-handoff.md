# Canvas Studio 交接文档(2026-08-20,P4 最小版代码完成,待人工验收)

> 用途:新开对话继续开发前的完整上下文。本文件 + [`docs/plans/canvas-studio.md`](./canvas-studio.md)(完整计划)是当前权威。本文件记录"当前状态、已验证机制、环境事实、下一步"。

## 1. 当前状态

**P1(骨架 + 三栏工作台)+ P2(项目注册表)已完成**:

- 仓库根新增 `canvas-studio/` 独立包(已入根 workspaces,一行)
- 桌面 desktop profile 已集成:`corepack yarn dev` 启动后可见三栏工作台(左=项目列表、中=画布占位、右=官方对话区)
- P2:P1 后新增项目注册表(Host)+ 项目列表 UI(Client)+ 会话绑定(workspace = 项目目录)
- 开发环境已就绪:root `corepack yarn install` 完成、子模块已初始化 + `upstream:build` 完成
- P2 headless 验证全过(build/typecheck/check、studio profile web 冒烟);**桌面 GUI 已确认**:左侧项目列表可见、`+ 新建项目` 新建/切换正常、右栏会话标题与项目名已统一(通过 `ctx.workspaces.rename` 同步,详见计划 §13)
- **P3(工具 + 产物托管)已提交推送**:`build` / `typecheck` 通过,三个工具**在 Host 侧注册**(`image_generate` / `video_generate` / `video_composite`),调用走 Host 侧生成 + 落盘 + 静态托管闭环,避免浏览器 CORS。**端到端已人工验证**(2026-08-19 用户自测:agent 生成「小猫」→ 文件落盘 `assets/`,工具调用链路通)。详见计划文档 §15。
- **[已修复]桌面启动闪退(`RendererStartupFailure`)**:初版把工具 `ctx.tools.register` 错放在 client 半边(`tools` 是 Host 专属服务),导致渲染进程整体 abort、启动即退出。已改为 Host 注册(见下方 ⚠️ 标注与 §5 第 3 条),重建 `lib/` 并通过 `build`/`typecheck`;桌面 profile 经 symlink 指向本工作区,**下次 `corepack yarn dev` 启动即生效**。
- **P4 最小版(生成即上画布)代码完成**:client 经 `conversationEvents.register` 注册「副作用型」节点 definition,捕获三工具的 `tool/result` → 抽托管 URL → 写入画布 store,中间画布渲染**最新一张/帧**(image/video)。`build`/`typecheck`/`verify:loader` 全绿,`test:smoke` **8/8 通过**。**待桌面人工验收**(开项目 → 对话生成 → 画布即时显示)。详见计划文档 §16。
- **P4+ 完整版画布代码完成(未提交,2026-08-20)**:因 Drama Backend 两端不可用(本地 docker 未起 + 远程不可达)+ 环境 `http_proxy`(Privoxy) 拦截 localhost 导致 Host `fetch` 取不到产物,原 P4 桌面验收被卡。按"调整开发顺序、先把画布做到可验证 + 可持久化"决策,直接落地完整版画布:**节点模型**(取代单一最新产物,`src/contracts/canvas.ts` + store `nodes`)、**持久化**(`projects.readCanvas/writeCanvas` + `/canvas-studio/canvas` 路由 + client `load/saveStudioCanvas`,重启恢复)、**画布组件**(`CanvasSurface` 网格/平移/缩放/拖拽/选中 + `CanvasNode` + `CanvasEdges` 血缘贝塞尔 + `CanvasTimeline` 回看)、**血缘**(`addAsset` 按 `sourceUrl` 反查源节点写 `sourceIds`)、**Dev 种子**(`?cs-dev-seed=1` 注入示例图/视频/便签,后端无关可视化验收)。`check` 全绿,`test:smoke` **10/10 通过**。详见计划文档 §17。
- **[修复]产物已写盘但画布空白(2026-08-20,详见计划 §19)**:现象是 agent 说已保存、`canvas.json` 确实有节点、资源 200,但画布空态。根因是**选中态脱节**——Host 用会话 cwd 解析 projectId(与客户端无关),而画布显示只认 `selectedProjectId`(仅手动点击设置的内存态);应用重启后会话自动恢复到某 workspace,`selectedProjectId` 为 null → 空态。修复:①**会话级归属**,`client/index.ts` 订阅 `ctx.workspaces.list`,用 `recentWorkspaceId` → `view.path === project.dir` 把当前 workspace 映射为画布项目,自动 select + 载入;capture 的 `getSelectedProjectId` 同源解析;②**相对 URL**,`generate.ts` 产物 URL 改为同源 `/canvas-studio/assets/...`(删 `port` 参数链路),`api.ts` 载入时把旧绝对 URL 归一化,桌面重启换端口不失效。`check` 全绿,`test:smoke` **8/8**。**需重启 `corepack yarn dev` 生效**(运行中渲染进程是旧 bundle)。

> ⚠️ **【未解决 · 最高优先级】2026-08-20 14:15 用户反馈:重启 `corepack yarn dev` 后画布仍空白。§19 的代码级验证全绿,但运行时未生效。新窗口接手后先按下方 §7「画布空白·继续排查清单」逐项验证,不要直接改代码。**

### 最新运行时快照(2026-08-20 14:15 只读实测)
- 桌面已重启:webServer 端口 **58308 → 49816**(`lsof`:DSH Desktop 监听 `127.0.0.1:49816`)。
- **新 Host 已生效**:`测试项目`(e91d4d67)canvas.json 新增 **5 个节点,URL 为相对路径**(`/canvas-studio/assets/...`,约 13:24 生成)→ §19 的相对 URL 改动确实在运行;相对资源 `curl` **200**。
- **画布1(2c1826d9)3 个旧节点仍是写死 `http://127.0.0.1:58308/...` 的绝对 URL,而 58308 已死(`curl` 000)** → 若客户端归一化(§19 的 `loadStudioCanvas` 归一化正则)未生效,这三张图在渲染进程里会全部 404 破图。
- 路由正常:`GET /canvas-studio/canvas?projectId=<任一>` 在 49816 上返回正确节点。
- `lib/client.js`(12:53 构建)**确认包含 §19 代码**(`recentWorkspaceId`/`baselinesReady`/`syncActiveProject` 命中 6 处)。
- **矛盾点(新窗口的攻关核心)**:Host 是新的、bundle 是新的,但画布仍空白 → 要么渲染进程实际加载的不是这个 bundle(desktop 的 client 加载链路未确认),要么 §19 的会话级归属在运行时没触发/匹配失败,要么用户看到的是 `selectedProjectId=null` 的空态分支。

### 已建文件

```
canvas-studio/
├── package.json          # dsh.bundle.patch + dsh.client + exports["./client"] + scripts
│                        # + dependencies: @deepseek-ai/dsh-tools / dsh-llm (rc.7)
├── cordis.patch.yml      # insert 自身行 + 禁用 ui-layout
├── tsconfig.json         # Host(tsc 产出 lib/index.js)
├── tsconfig.client.json  # Client 声明(tsc --emitDeclarationOnly → lib/types/client)
├── tsdown.config.ts      # client bundle → lib/client.js(ModuleLoader banner)
├── scripts/
│   ├── clean.mjs
│   ├── dev-install.mjs   # 未用(桌面集成走了手工 pnpm,见 §4)
│   └── verify-client-loader.mjs  # 单模块注册验证
├── tests/
│   └── asset-capture.test.mjs    # [P4] Node 内置 test runner 冒烟测试(test:smoke, 8 用例)
└── src/
    ├── config.ts         # [P3] 明文配置:DRAMA_API_BASE/KEY、ENDPOINTS、sizeForAspectRatio、newAssetId
    ├── contracts/
    │   ├── project.ts    # StudioProject 共享类型(双半 type-only 引用,运行时不出现)
    │   └── canvas.ts     # [P4+] StudioCanvasNode / StudioCanvasDocument 共享类型
    ├── projects.ts       # Host:ProjectRegistry($DSH_HOME/canvas-studio/projects.json + projects/<id>/assets)
    ├── generate.ts       # [P3] Host 生成核心:uploadImage / callDrama / generateAsset(Host 落盘)
    ├── routes.ts         # Host:GET/POST /canvas-studio/projects + [P3] POST /generate + GET /assets(prefix,loopback+同源)
    ├── host-tools.ts     # [P3 修正] Host 侧工具:createStudioTools(registry,port) 三个 defineTool + resolveProjectId(cwd 反查项目)
    ├── asset-capture.ts  # [P4] 顶层纯逻辑:STUDIO_TOOL_KINDS/isStudioTool/extractAssetUrl + createAssetCaptureDefinition(hooks)
    │                    #      仅 type-only dsh-llm 导入(Host tsc 产出 lib/asset-capture.js 供测试直连)
    ├── index.ts          # Host:name/inject(['webServer','tools'])/apply(注册表 + 路由 + ctx.tools.register 三工具)
    └── client/
        ├── index.ts      # apply:advanced 跳过 + provide layout + register root(store + inject);[P3] 不再注册工具
        │               # [P4] inject 加 'conversationEvents' + 共享 store 实例(store:()=>storeHandle) + 注册捕获节点
        │               # [P4+] openProject 载入画布 + 捕获即时持久化 + ?cs-dev-seed 种子注入
        ├── layout-controller.ts  # ILayout 实现(P1 全 no-op)
        ├── api.ts        # listStudioProjects / createStudioProject;[P4+] loadStudioCanvas / saveStudioCanvas
        ├── project-store.ts      # createProjectStore() 工厂(defineStore);[P4+] nodes 模型 + setNodes/addAsset/moveNode/selectNode/removeNode + 派生
        ├── contracts.ts  # StudioProjectListInjected(注入面类型)
        ├── ProjectList.tsx       # 项目列表 + 新建表单(纯展示组件)
        ├── StudioFrame.tsx       # 三栏框架;[P4+] 中间 CanvasSurface + CanvasTimeline + 删除工具条
        ├── styles.ts     # 注入 <style data-plugin="canvas-studio">;[P4+] 画布/节点/边/时间线样式
        └── canvas/
            ├── CanvasSurface.tsx  # [P4+] 无限画布:网格 + 平移/缩放/拖拽/选中 + 居中跳转
            ├── CanvasNode.tsx     # [P4+] 节点盒(image/video/sticky/text/prompt)
            ├── CanvasEdges.tsx    # [P4+] 血缘贝塞尔边(由 sourceIds 推导)
            └── CanvasTimeline.tsx # [P4+] 按时间回看/定位条
```
> ⚠️ **[P3 修正 · 桌面闪退根因]** 初版把三个工具的 `ctx.tools.register` 放在 **client** 半边,但 `tools` 是 **Host 专属服务**,客户端 `apply` 抛错 → 渲染进程整体 abort → 启动时 `RendererStartupFailure(3 plugins)` 闪退。已改为 **Host 注册**(`src/host-tools.ts` + `src/index.ts` 的 `inject:['webServer','tools']`),删除 `src/client/tools.ts`,client `inject` 还原为 `['slots','workspaces']`。桌面 profile 的 `node_modules/canvas-studio` 是指向本工作区的 symlink,**重建 `lib/` 后下次启动即生效,无需重新打包 app**。详见计划文档 §15「架构修正」。

根级改动:`package.json` workspaces 加 `canvas-studio`(lockfile 已更新)。

### 已提交

- P1 骨架:`4155603dd`(skeleton)+ `30c935c3`(handoff 文档/fork 工作流)
- P2 项目注册表核心:`8786414361`
- **P2 收尾 + 深色主题:`a0e74865ed`** —— 包含:可见性修复(`currentColor`/`--dsw-fg` → 官方 `--dsw-alias-*` 语义 token,自动跟随 light/dark)、会话标题同步 `workspaces.rename`、防御性 ErrorBoundary、`docs/plans` 更新。**已推送到 fork**(`origin/canvas-studio` = `a0e74865ed`,fast-forward `30c935c3..a0e74865ed`)。
- **P3(工具 + 产物托管):`16d7666130`** + **闪退修复:`c3411814cb`** —— 均已提交并推送到 fork(`a0e74865ed..c3411814cb`)。P3 改动 = `src/{config,generate,routes,host-tools}.ts` + `src/index.ts`(`inject` 加 `tools` + Host 注册工具)+ `src/client/index.ts`(`inject` 还原 + 删工具注册)+ 删 `src/client/tools.ts` + `api.ts` 删死代码 + 重建 `lib/` + 文档。闪退修复提交 = Host 工具注册 + client 清理 + 文档(commit message 内记录根因)。提交时已排除 `deepseek-harness` 子模块(先 `git -C deepseek-harness checkout -- pnpm-lock.yaml` 还原再提交)。
- **P4 最小版(生成即上画布):代码完成,`build`/`typecheck`/`test:smoke` 全绿,尚未提交**(见 §5)。工作树改动 = `src/asset-capture.ts`(新增)+ `src/client/{project-store,index,StudioFrame,styles}.{ts,tsx}` + `tests/asset-capture.test.mjs`(新增)+ `package.json`(`test:smoke`)+ 重建 `lib/` + 文档。提交时同样先还原子模块、只 stage canvas-studio 与 docs。

## 7. Git 工作流(fork 双 remote)

```sh
# remote 布局(已配置)
git remote -v
# origin   git@github.com:tablilixian/deepseek-harness-desktop.git   ← 自己的 fork(开发分支推这里)
# upstream git@github.com:anywhere-labs/deepseek-harness-desktop.git ← 上游(只 fetch)

# 日常开发:在 canvas-studio 分支提交 + 推送
git checkout canvas-studio
git add ... && git commit -m "feat(canvas-studio): ..."
git push                                  # 推到自己 fork 的 canvas-studio

# 同步上游(随时可做;两步):
git fetch upstream                        # 拉取上游最新
git push origin upstream/master:master    # fork 的 master 对齐上游(快进合并)
# 把上游合进开发分支:
git merge upstream/master                 # 在 canvas-studio 上执行;插件在仓库根,冲突概率低
# 若上游更新了子模块 pin,再跑:
git submodule update --init --recursive
```

注意:master 永远只跟踪上游(本地 `git pull` 拉上游);所有开发在 `canvas-studio`。上游 AGENTS.md 的仓库规则(不编辑子模块、根 Yarn 工作流)照常适用。

## 8. 新对话提示词(直接粘贴)

## 2. 已验证机制(源码级核实,不要推翻)

1. **root children 声明全局唯一**:同时只有一人能声明某座位。canvas-studio 必须声明全部四个官方座位 `sidebar`/`conversation`/`details`/`shell.overlay`(ui-sidebar 与 ui-conversation 对它们是**裸 register**,未声明即整树抛错)。已验证:ui-layout 禁用后 ui-sidebar/ui-conversation 正常注册。
2. **`ctx.layout` 服务补位**:ui-layout 被禁后其提供的 `layout` 服务消失(ui-sidebar 注入 `layout`),canvas-studio client 用 `ctx.reflect.provide('layout', layout)` 补位,实现 `ILayout`(`@deepseek-ai/dsh-client-ui-layout/client` 类型)。
3. **桌面 advanced 模式降级**:desktop advanced shell 独占 root。canvas-studio client 检测 `window.location.search` 的 `dsh-desktop-mode=advanced` 时跳过注册(logger.warn 说明),保持桌面帧不变。用户 profile 是兼容模式(settings.yaml 无 `dsh-desktop` 段),正常生效。
4. **同 priority 重复注册抛错**:两个自建 root 的插件不能同 profile(用户旧的 middle-panel 实验已被移除)。
5. **客户端模块发现链**:host Loader 条目 name → 包 `dsh.client`(platform: web)声明 → 浏览器加载 `/plugins/<name>/client.js`。**改 client 代码 = 重建 bundle + 重启应用**(web-app patch 禁用 HMR,rev 只在启动时重算)。
6. **patch 层序与语义**:profile bundles 依序 → profile 自己 cordis.patch.yml → `$DSH_HOME/cordis.patch.yml` → `--patch` 覆盖。patch 按 id 替换整个 config(非深合并)。空 patch 文件必须是显式 `[]`(注释-only 解析为 null 会报错)。
7. **in-box bundle 不进 profile pnpm**:`@deepseek-ai/dsh-base`/`dsh-web-app` 等经 `$DSH_HOME/profiles/node_modules` 愈合回退解析,profile manifest 列名即可;pnpm 只管 out-of-tree 包。
8. **桌面 profile 的 pnpm 是 v11**(store v11):子模块 dsh CLI 转发的 pnpm 是 v10 会报 store 不匹配。桌面 profile 操作须在 profile 目录直接 `corepack pnpm@11.7.0 <verb> <spec>`,再手工维护 `dsh.profile.bundles`(dsh 的 reconcile 不经过时跳过)。
9. **上游构建前提**:跑 web 冒烟(任意 profile)需先 `corepack yarn upstream:build`。
10. **canvas-studio 的 client bundle 无运行时上游依赖**:对 `@deepseek-ai/*` 全是 type-only import(被擦除),唯一运行时外部依赖是 `react/jsx-runtime`(shell 提供)。external 列表照抄 market。
11. **client bundle 可运行时 require runtime store 引擎**:`@deepseek-ai/dsh-client-runtime/client` 是上游 `CLIENT_EXTERNALS` 的文档化豁免(RUNTIME_STORE_EXEMPTION),loader 模块表直接应答 —— P2 起 `defineStore` 从它 import(已在 external 列表)。
12. **workspace.create 幂等**:Host `ensureWorkspace` 按路径 resolve-by-path 复用,client `manager.create` 成功后 upsert 进本地列表 → create 返回即可 `startSession(workspaceId)`。绑定流程:`ctx.workspaces.create({ path: project.dir })` + `startSession(workspace.workspaceId)`。
13. **项目注册表权限**:目录/注册表 0700/0600;写注册表走 `writeFileAtomic`(`@deepseek-ai/dsh-atomic-write`,新 dependencies)。Host 半新增依赖 atomic-write/home-paths/host-webserver,canvas-studio 自带嵌套 node_modules,profile `link:` 安装无需重装。
14. **webServer 路由信任模型**:与 community-market 一致 —— GET 要求 loopback 权威(remoteAddress 回环 + host=127.0.0.1:port + sec-fetch-site 非 cross-site),POST 加同源 Origin。冒烟时 curl 必须带 `-H "origin: http://127.0.0.1:3080"`。

## 3. 环境事实

- 仓库:`/Users/wl/Desktop/job/learn/WL_AI_Studio/reference/deepseek-harness-desktop`(master,落后 origin 58 提交)
- 子模块 pinned `dsh-v0.1.0-rc.7`(99f6f02),**永不编辑**,上游命令走根脚本
- `$DSH_HOME` 未设置 → `~/.dsh`;profile:`desktop`(桌面在用,已集成 canvas-studio)、`studio`(web CLI 冒烟测试用,也装了 canvas-studio)
- 桌面 profile settings.yaml 有用户的 LLM 配置(wlqw provider,模型 `qwopus3.6-27b-v2-mtp-nvfp4`)
- 用户参考项目:`/Users/wl/Desktop/job/learn/WL_AI_Studio/reference/WL-AI-Director`(CC BY-NC-SA,代码移植需授权,只借鉴模型/交互)

## 4. 命令备忘

```sh
# 构建 / 验证
corepack yarn workspace canvas-studio build
corepack yarn workspace canvas-studio typecheck
corepack yarn workspace canvas-studio check        # build + verify:loader + typecheck

# 上游构建(首次或改上游后)
corepack yarn upstream:build

# web 冒烟(studio profile;桌面 profile 同理,注意别与运行中的桌面抢 3080)
cd deepseek-harness && node --import tsx/esm apps/cli/src/bin.ts --profile studio
# 浏览器开 http://127.0.0.1:3080

# 桌面启动
corepack yarn dev
# 桌面 P2 人工确认点:左侧项目列表可见;点「+ 新建项目」输入名 → 创建 → 目录落盘
# (~/.dsh/canvas-studio/projects/<id>/assets)+ 列表出现该项并高亮、右栏会话切换(标题/工作区变化)

# web 冒烟 + 路由自测(studio profile 起来后)
curl http://127.0.0.1:3080/canvas-studio/projects
curl -X POST -H "host: 127.0.0.1:3080" -H "origin: http://127.0.0.1:3080" \
  -H 'content-type: application/json' -d '{"name":"冒烟项目"}' \
  http://127.0.0.1:3080/canvas-studio/projects
# 无 origin 的 POST 应 405;非法名(空/斜杠/缺字段)应 400

# 桌面 profile 装/卸插件(必须 corepack pnpm@11.7.0,然后手工改 bundles)
cd ~/.dsh/profiles/desktop && corepack pnpm@11.7.0 add /Users/wl/.../canvas-studio
# 或 remove;bundles 列表在 ~/.dsh/profiles/desktop/package.json 手工增删
# 注:canvas-studio 是 link: 安装,新依赖(atomic-write 等)自带嵌套 node_modules,无需重装
```

## 5. 当前进度:P4 最小版完成 → 下一步验收 + 完整版

**P3 已提交推送**(`16d7666130` + 闪退修复 `c3411814cb`,已推 fork) —— 关键决策(均已按用户"先用明文、验收后再整理"的指示处理):

1. **架构决策(关键)**:生成 + 落盘放在 **Host(Node)**,不走浏览器直连 Drama Backend(避免 CORS)。三个工具在 **Host** 注册(`src/host-tools.ts` 的 `createStudioTools(registry,port)` + `src/index.ts` 的 `inject:['webServer','tools']` + `ctx.tools.register`),`execute` 直接调 Host 的 `generateAsset`(不再经 HTTP 往返);项目解析由 `resolveProjectId(exec.agent?.session.header.cwd)` 按会话工作区匹配 `project.dir`。`POST /canvas-studio/generate` / `GET /canvas-studio/assets` 路由仍保留(Host 内部可用)。→ Host 调 Drama → 下载媒体 → 写 `assetsDir(projectId)/<uuid>.<png|mp4>` → 返回 loopback URL `http://127.0.0.1:${port}/canvas-studio/assets/<projectId>/<file>`。
2. **凭证配置**:按用户要求**明文**写在 `src/config.ts`(`DRAMA_API_BASE`/`DRAMA_API_KEY` + 环境变量覆盖),未做 Config 面/加密 —— 验收通过后整理。
3. **工具注册(已改 Host 侧)**:`src/host-tools.ts` 用 `defineTool` 注册 `image_generate`(txt2image/image2image)、`video_generate`(image2videomsr 图生视频)、`video_composite`(image2videomkr 首尾帧合成,`frame_index=-1` 取尾帧);Host `apply` 内 `ctx.tools.register` 逐条注册。原 `src/client/tools.ts` 已删除,client 不再注册工具(避免 `RendererStartupFailure` 闪退)。产物经 `output.render` → `TextBlock` 回模型。
4. **产物静态路由**:Host `routes.ts` 新增 `GET /canvas-studio/assets`(prefix,loopback + 同源检查,`nosniff`/`no-store`,防 `..` 穿越)。`POST /canvas-studio/generate`(exact,同源)串起 `generateAsset`(当前工具路径不走这条 HTTP,但路由保留)。
5. **验证(P3)**:`build`/`typecheck` 通过;client bundle ≈19 kB **不含 dsh-tools**。**端到端已人工验证**(2026-08-19 用户自测:agent 生成「小猫」→ 文件落盘,工具链路通)。

**P4 最小版(生成即上画布)已实现,代码级验证全绿,待桌面人工验收** —— 详细记录见计划文档 §16:

1. **事件接入(关键)**:client `inject` 加 `'conversationEvents'`;`ctx.conversationEvents.register(createAssetCaptureDefinition(hooks))` 注册「副作用型」节点(`kind:'canvas-studio-asset'`,`target:'chat'`,`buildViewNode→null`),match 三工具 `tool/call`(start)/`tool/result`(update,仅 `surfaceOp==='append'`),update 时 `extractAssetUrl` 抽 URL 写 store。对话渲染仍由内置 `tool-call` 节点负责(不重复)。
2. **store**:`project-store.ts` 加 `assets: Record<projectId, AssetItem[]>` + `pushAsset`(URL 去重)+ `lastAssetOf` 派生;`apply` 共享 root store 实例(`storeInstance = storeHandle.create()`,框架按 handle×scopeKey 缓存,与 slots 同一实例),捕获节点经 `storeInstance.actions.pushAsset` / `getSnapshot().selectedProjectId` 在 React 外读写。
3. **画布渲染**:`StudioFrame.tsx` 中间栏读 `lastAssetOf(store, selectedProjectId)`,image→`<img>`、video→`<video controls>`;`styles.ts` 加 `.csCanvasMedia`(铺满 + `object-fit:contain`)。
4. **测试**:`tests/asset-capture.test.mjs`(Node 内置 runner,`test:smoke`)8 用例全过(isStudioTool/extractAssetUrl/match 含非 append 忽略/生命周期)。
5. **坑(已记录)**:asset-capture.ts 不能引 `dsh-client-runtime` 类型(会把客户端类型图拖进 Host tsc → 上游 .d.ts `sessions: ISessions vs SessionStore` 冲突);definition `update` 的 context 参数要放宽 `{state: unknown}` 保证与 `ConversationNodeDefinition<unknown>` 逆变兼容。

**下一步**:
1. **【当前阻塞·先做】解决「画布空白」未解决问题**:按下方 §7 排查清单逐项验证(渲染进程加载的 bundle 是否含 §19 代码 → 运行时 `selectedProjectId`/`nodes` 实际值 → 会话级归属是否触发/匹配)。**先验证、加日志、再改代码**。
2. 画布空白解决并人工验收通过后**提交 P4+**(排除 dirty 子模块 → 只 stage canvas-studio 与 docs)→ 推 fork。
3. (可选)节点对齐辅助线、网格/缩略图 LOD、undo/redo。

> **2026-08-20 更新（验收阻塞修复，详见计划文档 §18 + §19）**：桌面验收发现两类问题并修复，代码级验证全绿（check + test:smoke 8/8），**尚未提交**。
> - **项目列表**：`StudioFrame` 挂载即 `refreshProjects`（免手动刷新）；`ProjectRegistry.create` 加大小写不敏感同名校验；新增删除链路（`removeProject` + `DELETE /canvas-studio/projects` + `deleteStudioProject` API + `ProjectList` 行内删除按钮带 `confirm`）。
> - **画布产物可见性（§18）**：让 Host 成为画布节点**单一真相源**——`generateAsset` 落盘后 `appendCanvasNode` 直接写 `canvas.json`（含 `sourceIds` 血缘）；capture 改为选中项目时 `reloadCanvas`（从 Host 重载），去掉脆弱的「解析事件渲染文本 URL」路径，并放宽 `surfaceOp` 限制；`writeCanvas` 改合并写保护 Host 侧节点。
> - **画布仍空白根治（§19）**：§18 保证了数据层（节点必落盘），但画布显示依赖 `selectedProjectId`（仅手动点击、内存态），与会话实际绑定的 workspace 脱节 → 重启恢复会话后产物在 `canvas.json` 里却显示空态。修复：① `client/index.ts` 订阅 `ctx.workspaces.list`，用 `recentWorkspaceId → view.path === project.dir` 做**会话级归属**，自动 select + 载入画布（capture 的 `getSelectedProjectId` 同源解析）；② `generate.ts` 产物 URL 改同源相对 `/canvas-studio/assets/...`（删 `port` 参数链路），`api.ts` 载入时归一化旧绝对 URL，桌面重启换端口不失效。
> - agent 报 "undefined" 多因后端不通（`generateAsset` 抛错）→ 后端恢复（drama-api 可达 + 桌面启动设 `NO_PROXY=localhost,127.0.0.1` 绕过 Privoxy）后，产物落盘即上画布；即便 capture 事件未触发，重开项目也会显示已生成节点。
> - **验收动作**：重启 `corepack yarn dev`（让渲染进程加载新 bundle）→ 会话自动恢复的 workspace 对应项目，画布应直接显示已有产物（含小猪）；再走真实 agent 生成验证即时上画布。
> ⚠️ 本节 §5 上半部分描述的是早期 P4 最小版的 `assets/pushAsset/lastAssetOf` 设计，已被 P4+ 的 `nodes` 模型取代，以计划文档 §17/§18 为准。

纪律:完成 P4 后同样更新两文档再提交;提交时排除 dirty 的子模块。

## 6. 纪律提醒

- 不编辑 `deepseek-harness/` 子模块;桌面产品文件(dsh-plugin-desktop 等)不动
- client 组件纪律:props 四份额(PropsRuntime/PropsRenderSlots/PropsStore/inject),组件不见 ctx;store 用 `createXXXStore()` 工厂(defineStore);async 业务全在 apply/inject 回调,经 store actions 提交;产品文案中文、注释英文;样式注入 `<style data-plugin>`(P1 模式),不引入 CSS Modules/Tailwind
- Host 侧按上游惯例:name/inject/Config/apply,`ctx.get()` 读可选服务;webServer 路由注册返回 disposer,经 `ctx.effect()` 挂载
- 完成当前阶段后:更新本交接文档 + 计划文档对应章节,再提交一次(先还原子模块,只 stage canvas-studio 与 docs)

## 7. 新对话提示词(直接粘贴)

```
继续 Canvas Studio 插件开发(DeepSeek Harness Desktop 仓库
/Users/wl/Desktop/job/learn/WL_AI_Studio/reference/deepseek-harness-desktop)。
P1(三栏工作台)+ P2(项目注册表)+ P3(媒体工具 + 产物托管)已完成并推送到 fork
(canvas-studio 分支,最新提交 c3411814cb);P4 最小版(生成即上画布)代码已完成、
build/typecheck/test:smoke 全绿,待桌面人工验收后提交。

先读这两个文档再动手:
1. docs/plans/canvas-studio.md —— 完整计划(P1-P7 阶段、WL-AI-Director 模型映射、组合约束;§15 P3 记录,§16 P4 记录)
2. docs/plans/canvas-studio-handoff.md —— 交接状态(当前状态、已验证机制、环境事实、命令备忘、下一步)

注意:AGENTS.md 是仓库规则(不编辑 deepseek-harness/ 子模块、上游命令走根脚本、
client 包不引入运行时 dsh 依赖、提交时排除 dirty 子模块、完成阶段后先更新文档再提交)。

当前任务:先做 P4 桌面人工验收(不需要改代码):
1. corepack yarn dev 启动桌面(兼容模式),打开或新建 Canvas Studio 项目
2. 右侧对话让 agent 生成图片(如「生成一只小猫」)→ 中间画布应即时显示图片
3. 再让 agent 生成视频(image_generate 产物做参考图 → video_generate)→ 画布显示可播放视频
4. 切换项目 → 画布显示该项目最新产物;无产物项目显示空态

验收通过后:
- 提交 P4(git -C deepseek-harness checkout -- pnpm-lock.yaml 还原子模块 → 只 stage
  canvas-studio 与 docs → commit → push origin canvas-studio)
- 再评估完整版画布(P4+):网格/时间线/回看/按项目聚合、会话级项目归属
  (当前按 selectedProjectId)、重启恢复(当前内存态)。
```

---

## 7. 【未解决】画布空白·继续排查清单(2026-08-20 14:15,新窗口接手必读)

### 7.1 已钉死的事实(不要重复验证)
- 数据层正确:两个项目的 `canvas.json` 都有节点;`GET /canvas-studio/canvas` 在当前桌面(端口 **49816**)正常返回。
- **新 Host 已生效**:`测试项目`(e91d4d67)5 个新节点是**相对 URL** 且资源 200 → §19 的 Host 改动在跑。
- **新 client bundle 已构建**:`canvas-studio/lib/client.js`(12:53)含 §19 代码(`recentWorkspaceId`/`baselinesReady`/`syncActiveProject`)。
- **矛盾**:Host 新 + bundle 新,但用户重启后画布仍空白。
- **画布1 旧节点坑**:3 个旧节点 URL 写死 `http://127.0.0.1:58308/...`,该端口已死(000);只有 §19 的 `loadStudioCanvas` 归一化正则生效才会转相对路径显示,否则破图。

### 7.2 排查顺序(先验证再改码,每步都留日志)
1. **确认渲染进程加载的 bundle 是否含 §19 代码**(最高优先级,排除"改了个寂寞"):
   - 在 `client/index.ts` `apply` 开头加 `ctx.logger.info('canvas-studio client v2 loaded')` → 重建(`corepack yarn workspace canvas-studio build`)→ 重启 `corepack yarn dev` → 看日志/DevTools console 是否有该行。
   - 无 → 渲染进程加载的是旧 bundle/缓存 → 查 desktop 的 client 加载链路:`dsh-plugin-desktop` 如何解析 canvas-studio 的 client(是否读 `canvas-studio/lib/client.js` 还是打包复制品;`scripts/verify-client-loader.mjs` 可参考)。
2. **区分「手动点击」与「自动恢复」两条路径**:
   - 让用户手动点击项目行(走 `openProject`)→ 画布显示?
     - 手动能显示 → §19 的自动归属路径失败 → 调试 `resolveActiveProjectId()`:加日志打印 `baselinesReady`、`recentWorkspaceId`、`items[].path`、`projects[].dir` 与匹配结果。重点怀疑:①`recentWorkspaceId` 不是当前会话 workspace;②`view.path` 与 `project.dir` 不一致(子路径/尾部斜杠/大小写);③订阅时机(workspace baselines 就绪时 projects 列表还没加载 → 匹配失败后不再重试——`refreshProjects` 里已加一次 `syncActiveProject()`,确认执行)。
     - 手动也不显示 → 与 §19 无关的更早链路问题:检查 `loadStudioCanvas` 结果是否进 store、`CanvasSurface` 是否挂载(空态分支 `nodes.length===0` 还是 `selectedProjectId===null`)、DevTools Network 里 img 请求 URL 与状态码。
3. **验证归一化**:打开画布1 → DevTools 看 img src 是否为相对路径;若仍绝对 → 归一化未生效(和 7.2.1 同根因)。
4. **后端无关验证(可选)**:`?cs-dev-seed=1` 注入种子 → 若种子能显示而真实节点不能 → 问题在载入/归一化;若种子也不显示 → 画布渲染/挂载链路问题。

### 7.3 环境事实与命令备忘
- `$DSH_HOME=~/.dsh`;项目在 `~/.dsh/canvas-studio/projects/<id>/`(`canvas.json` + `assets/`);webServer 端口**动态**,重启即变。
- 验证命令:根目录 `corepack yarn workspace canvas-studio check`(build+verify:loader+typecheck)/ `test:smoke`;桌面 `corepack yarn dev`。
- 分支 `canvas-studio`,HEAD `c3411814cb`(P3);工作树含 P4/P4+/§18/§19 **全部未提交**;子模块保持干净(`99f6f02`,勿提交)。
- 提交纪律:先 `git -C deepseek-harness checkout -- pnpm-lock.yaml` 还原子模块 → 只 stage `canvas-studio` 与 `docs`(**排除 `.workbuddy/`**)→ commit → `push origin canvas-studio`。
- 真实生成验收另需后端:drama-api 可达 + 启动桌面设 `NO_PROXY=localhost,127.0.0.1`(绕过 Privoxy);本问题与后端无关。