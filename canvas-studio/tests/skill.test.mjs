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

test('skill 内容：覆盖九个工具与 upload 核心规则', () => {
  for (const tool of [
    'prompt_enhance',
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

test('skill 内容：包含分镜表格式与镜头词汇', () => {
  assert.ok(CREATION_SKILL_CONTENT.includes('分镜表'), '缺少分镜表格式')
  for (const term of ['景别', '镜头运动', 'aspectRatio', 'duration']) {
    assert.ok(CREATION_SKILL_CONTENT.includes(term), `缺少镜头词汇 ${term}`)
  }
})
