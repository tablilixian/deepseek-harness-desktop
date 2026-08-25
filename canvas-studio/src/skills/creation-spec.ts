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
  'Canvas Studio 画布视频创作规范：点选式需求澄清（ask_user_choice）、分镜表审批门禁、镜头参数词汇、MiniMax H3 视频提示词规范与十一个媒体工具的标准串联流程。凡涉及生成图片/视频、分镜规划、AI 短片或漫剧创作时使用。'

/** The full markdown instruction body loaded via the `skill` tool. */
export const CREATION_SKILL_CONTENT = `# Canvas Studio 创作规范

在 DSH 画布工作台（canvas-studio）中创作 AI 短视频 / 漫剧时遵循本规范。产物会实时落到画布，用户可随时打断、重试单个节点。

## 执行模式与审批门禁（必须遵守）

- 项目有两种执行模式，工作流条上可见：**逐步确认** / **放手跑**。
- **逐步确认模式（默认）**：
  1. 需求不明确时先对话澄清，不要急着生成；
  2. 输出分镜表后必须调 \`submit_storyboard_for_approval(storyboard=…)\` 提交，然后结束回合等待用户；
  3. 用户在画布上方点击「批准」并在对话中发送「继续」后，才能调用 storyboard_generate / video_generate / video_composite；
  4. 未获批准时这些工具会直接报错——收到报错不要重试，等用户批准即可（image_generate 出概念图不受限）。
- **放手跑模式**：用户已明确授权一路跑完；submit_storyboard_for_approval 会直接放行，无需等待。

## 需求澄清五要素（逐步确认模式下必须点选式提问）

开始策划前用 **ask_user_choice 工具**逐项确认五要素，规则：

1. **一次只调一次 ask_user_choice，只问一个要素**；收到工具结果（用户的选择自动回流）后再问下一个。**禁止**一次性输出完整方案让用户整体确认，也**禁止用纯文本列表提问**——用户要点按钮，不是打字。
2. options 给 2–4 个短标签候选项，推荐项末尾加「（推荐）」；例如：
   question: 「成片时长想要多少秒？」options: ["15s 快节奏", "30s 标准品牌片（推荐）", "45s+ 完整叙事"]
3. 提问顺序：① 时长 → ② 画幅 → ③ 风格 → ④ 节奏/镜头数 → ⑤ 受众与用途。开放要素（品牌名等）传 allowFreeText=true。
4. 用户回答「你定 / 随便 / 按你的建议」时，该项采用推荐项并在最终摘要里标注「默认」。
5. 五项全部确认后，输出一段简短需求摘要（含已确认的五要素），然后进入分镜规划；分镜表仍须经 submit_storyboard_for_approval 审批。
6. **放手跑模式**跳过提问：自行假设五要素并在回复开头列出假设清单。
7. ask_user_choice 会阻塞到用户点击或超时；收到超时提示时按推荐项继续并说明是默认假设。

## 核心规则（必须遵守）

- 所有需要图片输入的工具只接受 \`filename\`（已上传到 Drama Backend 的服务器文件名），**不能直接传图片 URL**。
- 图片作为下游输入前，必须先调 \`upload_image(imageUrl=产物URL)\` 得到 \`filename\`。
- 生成是同步 API：调用会阻塞到产物返回；「打断」只是本地中断 fetch，服务端任务不回收。
- 同一项目保持同一 aspectRatio（16:9 横屏 / 9:16 竖屏 / 1:1），不要混用。
- 调用 image_generate / video_generate / video_composite 时，把本次用到的参考图产物 URL（此前工具结果里的 url 字段）填进 \`sourceUrls\` 参数——画布会据此画出流程箭头（血缘边），用户靠它理解制作链路。
- \`deduction\` 工具当前后端不支持（404），不要调用；下一帧推演用 image2vl 分析代替。

## 工具链（11 个）

| 工具 | 用途 | 关键参数 |
| --- | --- | --- |
| prompt_enhance | 增强提示词 | prompt |
| ask_user_choice | 点选式提问（澄清阶段必用） | question、options[]（推荐项加「（推荐）」）、allowFreeText? |
| submit_storyboard_for_approval | 分镜表提交审批（逐步确认模式必经） | storyboard（分镜表 markdown）、summary? |
| storyboard_generate | 文本 → 格子分镜图 | prompt（每行一个场景）、gridnum、filename? |
| image_generate | 文生图 / 图生图 | prompt、aspectRatio、filename?（参考图）、negativePrompt? |
| style_transfer | 风格迁移 | filename（目标图）、styleFilename（风格图）、prompt?、enhance? |
| image2vl | 画面分析（VLM） | filename、prompt |
| video_generate | 图生视频（MSR） | prompt、filename、duration（默认 5s） |
| video_composite | 多图合成视频（MKR 首尾帧插值） | prompt、filenames[]（按时间顺序）、duration（默认 12s） |

## 视频提示词写法（MiniMax H3 官方规范，必须遵守）

生成视频（video_generate / video_composite）的 prompt 要按 H3 结构化格式重写，不要写成一句话摘要。原文见 MiniMax-AI/MiniMax-H3 仓库 \`.agents/skills/h3-prompt-writing\`。

**通用结构**（首行对齐指令 + 空行 + 三大核心字段）：

- 图生视频（video_generate，首帧参考）首行固定：
  \`For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.\`
- 首尾帧合成（video_composite 两图）首行固定：
  \`How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot N) aligns with the S.SS-second mark of the target video.\`（S.SS = 时长，两位小数；FL2VA 偏好单镜头连续插值）
- 三大字段按序：\`integrated_multimodal_description:\`（沿时间轴的画面/动作/镜头/台词/画内音）、\`overall_soundscape:\`（1–4 句环境音与动作音总结）、\`non_diegetic_music:\`（1–3 句背景音乐：乐器/速度/强弱变化，不写情绪词；无则 N/A）

**镜头与剪辑**：\`[Shot 1]\` 开头先给风格与构图（如 \`Live-action, cinematic, a medium-wide shot frames...\`）；后续镜头用递增切点时间 \`[Shot 2] At 00:03.500, the camera cuts to...\`；只有新信息才切镜头，距离/角度微调用运镜。

**运镜三要素**（类型+幅度+速度，写成句中自然英语）：Zoom In/Out、Push In/Pull Out、Pan Left/Right、Truck Left/Right、Tilt Up/Down、Pedestal Up/Down、Arc Shot、Tracking Shot、Static Shot、Shake Slightly/Strongly、POV、Roll Clockwise/Counterclockwise + \`with small/large amplitude\` + \`at slow/fast speed\`。例：\`The camera pushes in with small amplitude at slow speed toward the folded letter in her hands.\`

**台词与声音**：说话者用稳定 ID \`(S1)\` / \`(S1,S2)\`，首次出现给出音色/语速等身份信息；内容放 \`<d>[English]原话</d>\`（原话逐字保留不翻译）；旁白用 \`says in an off-screen voiceover\` 并紧跟 \`while his lips remain completely closed.\`；跨切台词用 \`<scenetrans>\`，被结尾截断用 \`<cutoff>\`。画面内文字用英文双引号逐字保留（如 \`A red neon sign reading "营业中" glows above the doorway.\`）。

**一致性**：图生视频从首帧锚点出发（风格/人物/构图保持一致 → 动作启动 → 连续发展 → 结果反应）；时长描述必须匹配请求的 duration（单段 ≤15s）。

## 标准工作流

1. **需求澄清**：逐步确认模式下按五要素**逐项提问**（一次一问，带候选项）；放手跑模式可自行假设并说明。
2. **创意策划**：用 prompt_enhance 打磨整体创意描述。
3. **分镜规划 → 审批**：输出分镜表（见下），逐步确认模式下调 submit_storyboard_for_approval 等待批准。
4. **定妆锚点**：批准后 image_generate 生成主角定妆照 / 场景概念图 —— 这是全片一致性的锚点。
5. **逐镜出图**：每个镜头调 image_generate，传定妆照 filename 作参考保持角色一致；风格不稳时用 style_transfer 统一到首图风格。
6. **上传**：对每个镜头图调 upload_image 拿 filename（可并行）。
7. **成片**：单镜动态用 video_generate（不传 filename 纯文生、传则首帧图生视频，均走 fl2va）；两张图衔接优先 video_composite（自动走首尾帧插值 fl2va）；三张及以上转场用 video_composite 多参考图模式（ref2va，filenames 按时间顺序，最多 6 张）。视频 prompt 一律按上方 H3 规范重写。

## 分镜表格式（提交审批的正文就用它）

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
