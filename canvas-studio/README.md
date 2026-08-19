# Canvas Studio

画布式 AI 视频创作工作流插件:项目列表 + 无限画布 + 官方对话区的三栏工作台,agent 在对话中编排分镜、角色定妆、场景概念、视频片段与合成,节点实时落在画布上,可打断、改提示、单节点重试。

本插件对 `deepseek-harness/`(pinned 上游)与 `dsh-plugin-desktop/` 零修改,纯新增独立包。计划见 [`docs/plans/canvas-studio.md`](../docs/plans/canvas-studio.md)。

## 组成

- Host 半(`src/index.ts`):bundle patch 行;项目注册表与产物托管在 P2/P3 落地。
- Client 半(`src/client/`):浏览器侧插件,注册 root 座位、三栏框架、`ctx.layout` 服务。
- `cordis.patch.yml`:禁用官方 `ui-layout`(patch 按 id 覆盖),保留官方 `ui-sidebar` / `ui-conversation` / `ui-details` 的行与座位。

## 机制

- 客户端模块图由 host Loader 条目发现:包声明 `dsh.client`(platform: web)后,浏览器加载 `/plugins/canvas-studio/client.js`。
- 画布与聊天不直接通信:两者同为官方会话通道(`session/event` 帧、`session.prompt` / `cancel`)的对等消费者。
- 桌面 advanced 模式:桌面壳的 advanced shell 独占 root 座位;canvas-studio 在该模式下不注册(root 的 children 声明全局唯一),需将桌面 profile 置于兼容模式。

## 构建与安装

```sh
corepack yarn install --immutable   # 根 workspace 安装(含 canvas-studio)
corepack yarn workspace canvas-studio build
dsh plugin --profile <name> add ./canvas-studio
```

开发循环:改 client 代码 → 重建 bundle → 重启应用(web-app patch 已禁用 HMR,rev 只在启动时重算)。

## 阶段

P1 骨架(本阶段):双半构建、patch 禁用 ui-layout、三栏框架、官方对话区渲染。
P2 项目:P3 工具:P4 画布:P5 交互:P6 收尾:P7 可选内置化。

## 已知限制与后续

- P1 不渲染官方 sidebar 与 details 列(座位已声明,官方注册不受影响);设置入口经会话 Hero 或 profile 配置文件。
- 桌面 advanced 模式下不生效(见上文),兼容模式下为默认工作台。
- 插件 Config(API 凭证)与工具注册在 P3 落地。
