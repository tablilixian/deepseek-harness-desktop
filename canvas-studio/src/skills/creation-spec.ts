/**
 * Canvas Studio creation-spec skill (P6): a model-invocable instruction set
 * covering the storyboard format, camera vocabulary, consistency rules, and
 * the standard nine-tool pipeline. Registered at runtime via
 * `ctx.skills.register()` so the whole skill ships inside the Host bundle —
 * no separate assets to package. Model visibility requires the composition to
 * mount `tool-skill` (desktop agent presets do; see handoff §4.24).
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-skill'

/** Registry-valid kebab-case name (/^[a-z0-9]+(?:-[a-z0-9]+)*$/). */
export const CREATION_SKILL_NAME = 'canvas-studio-creation'

/** Catalog routing description (kept under the 500-char truncation limit). */
export const CREATION_SKILL_DESCRIPTION =
  'Canvas Studio 画布视频创作规范：分镜表格式、镜头参数词汇与九个媒体工具的标准串联流程。凡涉及生成图片/视频、分镜规划、AI 短片或漫剧创作时使用。'

/** The full markdown instruction body loaded via the `skill` tool. */
export const CREATION_SKILL_CONTENT = `# Canvas Studio 创作规范

在 DSH 画布工作台（canvas-studio）中创作 AI 短视频 / 漫剧时遵循本规范。产物会实时落到画布，用户可随时打断、重试单个节点。

## 核心规则（必须遵守）

- 所有需要图片输入的工具只接受 \`filename\`（已上传到 Drama Backend 的服务器文件名），**不能直接传图片 URL**。
- 图片作为下游输入前，必须先调 \`upload_image(imageUrl=产物URL)\` 得到 \`filename\`。
- 生成是同步 API：调用会阻塞到产物返回；「打断」只是本地中断 fetch，服务端任务不回收。
- 同一项目保持同一 aspectRatio（16:9 横屏 / 9:16 竖屏 / 1:1），不要混用。

## 工具链（9 个）

| 工具 | 用途 | 关键参数 |
| --- | --- | --- |
| prompt_enhance | 增强提示词 | prompt |
| storyboard_generate | 文本 → 格子分镜图 | prompt（每行一个场景）、gridnum、filename? |
| image_generate | 文生图 / 图生图 | prompt、aspectRatio、filename?（参考图）、negativePrompt? |
| style_transfer | 风格迁移 | filename（目标图）、styleFilename（风格图）、prompt?、enhance? |
| image2vl | 画面分析（VLM） | filename、prompt |
| deduction | 剧情推演（下一帧构图） | filename |
| video_generate | 图生视频（MSR） | prompt、filename、duration（默认 5s） |
| video_composite | 多图合成视频（MKR 首尾帧插值） | prompt、filenames[]（按时间顺序）、duration（默认 12s） |

## 标准工作流

1. **创意策划**：用 prompt_enhance 打磨整体创意描述。
2. **分镜规划**：先输出分镜表（见下）给用户确认，再调 storyboard_generate。
3. **定妆锚点**：image_generate 生成主角定妆照 / 场景概念图 —— 这是全片一致性的锚点。
4. **逐镜出图**：每个镜头调 image_generate，传定妆照 filename 作参考保持角色一致；风格不稳时用 style_transfer 统一到首图风格。
5. **上传**：对每个镜头图调 upload_image 拿 filename（可并行）。
6. **成片**：单镜动态用 video_generate；多镜衔接 / 转场用 video_composite（filenames 按时间顺序，自动均分帧位）。
7. **可选**：image2vl 分析画面、deduction 推演下一帧补充分镜。

## 分镜表格式（先给用户确认，再执行）

| 镜号 | 景别 | 镜头运动 | 时长 | 画面描述 | 声音 |
| --- | --- | --- | --- | --- | --- |
| 1 | 远景 | 缓慢推进 | 5s | 村庄全貌，晨雾未散 | 环境音、鸟鸣 |

## 镜头参数词汇

- 景别：大远景 / 远景 / 全景 / 中景 / 近景 / 特写 / 大特写。
- 运动推拉摇移跟升降+固定；写进 prompt 用自然语言（如「镜头缓慢推进」）。
- duration：video_generate 建议 5s；video_composite 按镜头数取 8–15s。

## 一致性要点

- 先出角色定妆照；后续所有含该角色的镜头都以它为 filename 参考图。
- 第一张成图确定风格后，后续镜头用它做风格参考（style_transfer 或图生图）。
- 质量差时用 negativePrompt 排除瑕疵（如「模糊，变形，多余手指」）。
- 单节点失败可在画布右键「重试」（原地更新，不产生新边）；整体方向调整直接在对话里说明（steer）。
`

/**
 * Register the creation skill into the host skill registry.
 * @param ctx - active Host context (`skills` service injected).
 * @returns the registration disposer.
 */
export function registerCreationSkill(ctx: Context): () => void {
  return ctx.skills.register({
    name: CREATION_SKILL_NAME,
    description: CREATION_SKILL_DESCRIPTION,
    source: 'runtime',
    content: CREATION_SKILL_CONTENT,
  })
}
