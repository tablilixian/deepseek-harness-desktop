# Canvas Studio 交接文档(2026-08-19,P1 完成)

> 用途:新开对话继续开发前的完整上下文。本文件 + [`docs/plans/canvas-studio.md`](./canvas-studio.md)(完整计划)是当前权威。本文件记录"当前状态、已验证机制、环境事实、下一步"。

## 1. 当前状态

**P1(骨架 + 三栏工作台)已完成,桌面 GUI 验证通过**:

- 仓库根新增 `canvas-studio/` 独立包(已入根 workspaces,一行)
- 桌面 desktop profile 已集成:`corepack yarn dev` 启动后可见三栏工作台(左=项目占位、中=画布占位、右=官方对话区)
- 开发环境已就绪:root `corepack yarn install` 完成、子模块已初始化 + `upstream:build` 完成

### 已建文件

```
canvas-studio/
├── package.json          # dsh.bundle.patch + dsh.client + exports["./client"] + scripts
├── cordis.patch.yml      # insert 自身行 + 禁用 ui-layout
├── tsconfig.json         # Host(tsc 产出 lib/index.js)
├── tsconfig.client.json  # Client 声明(tsc --emitDeclarationOnly → lib/types/client)
├── tsdown.config.ts      # client bundle → lib/client.js(ModuleLoader banner)
├── scripts/
│   ├── clean.mjs
│   ├── dev-install.mjs   # 未用(桌面集成走了手工 pnpm,见 §4)
│   └── verify-client-loader.mjs  # 单模块注册验证
└── src/
    ├── index.ts               # Host:name/inject/apply 空插件
    └── client/
        ├── index.ts           # apply:advanced 模式跳过 + provide layout + register root
        ├── layout-controller.ts  # ILayout 实现(P1 全 no-op)
        ├── StudioFrame.tsx    # 三栏框架(renderSlot conversation + shell.overlay)
        └── styles.ts          # 注入 <style data-plugin="canvas-studio">
```

根级改动:`package.json` workspaces 加 `canvas-studio`(lockfile 已更新)。

### 未提交

已提交并推送:`canvas-studio` 分支(commit `4155603d`,含 canvas-studio/、docs/plans/、根 package.json/yarn.lock)。仓库已配 fork 双 remote(见 §7)。

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

# 桌面 profile 装/卸插件(必须 corepack pnpm@11.7.0,然后手工改 bundles)
cd ~/.dsh/profiles/desktop && corepack pnpm@11.7.0 add /Users/wl/.../canvas-studio
# 或 remove;bundles 列表在 ~/.dsh/profiles/desktop/package.json 手工增删
```

## 5. 下一步:P2(项目注册表)

按计划 §6 P2 与 §11:

1. **Host 项目注册表**:`$DSH_HOME/canvas-studio/projects.json`(注册表)+ `projects/<id>/` 目录(含 `assets/` 子目录)。参考 `resolveDshHome()`(`deepseek-harness/packages/util/home-paths`)。写文件用 atomic write(参考桌面壳 replace 模式)。
2. **webServer 路由**:参照 `dsh-community-market/src/host/routes.ts`(`registerMarketRoutes` 模式),提供 `GET/POST /canvas-studio/projects` 等;client 侧参照 `dsh-community-market/src/client/api.ts`(fetch 模式,同源)。
3. **Client 项目列表**:替换 `StudioFrame.tsx` 左侧占位;"新建项目"按钮生效(输入项目名→POST→列表刷新);项目切换。
4. **会话绑定**:研究 `ctx.workspaces.startSession(workspaceId)`(先例:`deepseek-harness/packages/client/ui-sidebar/src/client/index.ts` 的 startSession 按钮)。决定项目↔workspace↔session 映射(建议:每项目一个 workspace,项目打开 = 创建/复用 workspace + startSession,后续挂 sessionId 到项目记录)。
5. **P2 验证标准**:新建项目 → 目录落盘 + 注册表更新 → 会话切换正确。

P2 待研究文件:market 的 `src/host/routes.ts`、`src/client/api.ts`、client runtime 的 workspaces service(`deepseek-harness/packages/client/runtime/src/client/workspaces/`)。

## 6. 纪律提醒

- 不编辑 `deepseek-harness/` 子模块;桌面产品文件(dsh-plugin-desktop 等)不动
- client 组件纪律:props 四份额(PropsRuntime/PropsRenderSlots/PropsStore/inject),组件不见 ctx;store 用 `createXXXStore()` 工厂;产品文案中文、注释英文;样式注入 `<style data-plugin>`(P1 模式),不引入 CSS Modules/Tailwind
- Host 侧按上游惯例:name/inject/Config/apply,`ctx.get()` 读可选服务
- 完成 P2 后:更新本交接文档 + 计划文档 §6 的 P2 行,提交一次

## 7. 新对话提示词(直接粘贴)

```
继续 Canvas Studio 插件开发(DeepSeek Harness Desktop 仓库
/Users/wl/Desktop/job/learn/WL_AI_Studio/reference/deepseek-harness-desktop)。
P1 已完成并桌面验证通过(三栏工作台正常显示)。

先读这两个文档再动手:
1. docs/plans/canvas-studio.md —— 完整计划(P1-P7 阶段、WL-AI-Director 模型映射、组合约束)
2. docs/plans/canvas-studio-handoff.md —— 交接状态(P1 完成细节、已验证机制、环境事实、命令备忘、下一步 P2)

注意:AGENTS.md 是仓库规则(不编辑 deepseek-harness/ 子模块、上游命令走根脚本)。

当前任务:P2 项目注册表。
1. Host 半:项目注册表 $DSH_HOME/canvas-studio/projects.json + projects/<id>/ 目录(assets/ 子目录),atomic write;
   参照 dsh-community-market/src/host/routes.ts 注册 webServer 路由(GET/POST /canvas-studio/projects)。
2. Client 半:替换 StudioFrame.tsx 左侧占位为项目列表(新建/切换),参照 dsh-community-market/src/client/api.ts 的 fetch 模式;
   会话绑定研究 ctx.workspaces.startSession(先例 ui-sidebar 的 New Session 按钮)。
3. 验证:build/typecheck/check 通过;studio profile web 冒烟;桌面 corepack yarn dev 人工确认。
完成 P2 后更新两份文档并提交。
```