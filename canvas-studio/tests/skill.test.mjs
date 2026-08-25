/**
 * P6 创作规范 skill 的契约冒烟测试：注册输入必须通过上游 registry 校验
 * （name kebab-case、description 非空），内容须覆盖九工具与 upload 核心规则。
 * 直连 Host tsc 编译产物 lib/skills/creation-spec.js。
 * 运行：corepack yarn workspace canvas-studio test:smoke
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CREATION_SKILL_CONTENT,
  CREATION_SKILL_DESCRIPTION,
  CREATION_SKILL_NAME,
} from '../lib/skills/creation-spec.js'

test('skill 注册输入：name kebab-case 且 description 非空（registry 校验两条）', () => {
  assert.match(CREATION_SKILL_NAME, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
  assert.ok(CREATION_SKILL_DESCRIPTION.length > 0)
  // 目录注入时描述截断到 500 字符；保持在其内保证路由语义完整。
  assert.ok(CREATION_SKILL_DESCRIPTION.length <= 500)
})

test('skill 内容：覆盖十一个工具与 upload 核心规则', () => {
  for (const tool of [
    'prompt_enhance',
    'ask_user_choice',
    'submit_storyboard_for_approval',
    'image_generate',
    'upload_image',
    'image2vl',
    'style_transfer',
    'storyboard_generate',
    'deduction',
    'video_generate',
    'video_composite',
  ]) {
    assert.ok(CREATION_SKILL_CONTENT.includes(tool), `缺少工具 ${tool}`)
  }
  assert.ok(CREATION_SKILL_CONTENT.includes('filename'), '缺少 filename 核心规则')
  assert.ok(CREATION_SKILL_CONTENT.includes('upload_image'), '缺少先上传规则')
})

test('skill 内容：包含 P7 审批门禁协议、五要素点选澄清与 H3 提示词规范', () => {
  assert.ok(CREATION_SKILL_CONTENT.includes('逐步确认'), '缺少执行模式说明')
  assert.ok(CREATION_SKILL_CONTENT.includes('放手跑'), '缺少放手跑模式说明')
  assert.ok(CREATION_SKILL_CONTENT.includes('批准'), '缺少审批等待说明')
  for (const element of ['时长', '画幅', '风格', '节奏', '受众']) {
    assert.ok(CREATION_SKILL_CONTENT.includes(element), `缺少澄清要素 ${element}`)
  }
  assert.ok(CREATION_SKILL_CONTENT.includes('禁止用纯文本列表提问'), '缺少点选式提问约束')
  assert.ok(CREATION_SKILL_CONTENT.includes('integrated_multimodal_description'), '缺少 H3 三字段结构')
  assert.ok(CREATION_SKILL_CONTENT.includes('sourceUrls'), '缺少血缘箭头指引')
})

test('skill 内容：包含分镜表格式与镜头词汇', () => {
  assert.ok(CREATION_SKILL_CONTENT.includes('分镜表'), '缺少分镜表格式')
  for (const term of ['景别', '镜头运动', 'aspectRatio', 'duration']) {
    assert.ok(CREATION_SKILL_CONTENT.includes(term), `缺少镜头词汇 ${term}`)
  }
})
