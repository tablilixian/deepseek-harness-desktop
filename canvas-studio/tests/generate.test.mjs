/**
 * P3 媒体生成的冒烟测试：重点覆盖节点级重试（retryOf）语义 —— 结果写回
 * 原节点（保留 id/位置/血缘），而不是追加新节点（plan §7.8 标准 2）。
 *
 * 直连 Host 侧编译产物 lib/generate.js；fetch 打桩避开真实 Drama Backend，
 * 产物下载/写盘走临时目录。运行：corepack yarn workspace canvas-studio test:smoke
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateAsset, clampDuration } from '../lib/generate.js'

/** 打桩 fetch：参考图下载 / 上传 / 生成 / 产物下载。 */
function stubFetch(mediaUrl = 'https://media.example/out.png') {
  const calls = []
  globalThis.fetch = async (url, init = {}) => {
    let body = null
    if (typeof init.body === 'string') {
      try { body = JSON.parse(init.body) } catch { body = init.body }
    }
    calls.push({ url: String(url), method: init.method ?? 'GET', body })
    const text = String(url)
    if (init.method === 'POST') {
      if (text.includes('/upload')) {
        return { ok: true, json: async () => ({ filename: 'ref.png' }) }
      }
      return { ok: true, json: async () => ({ full_url: mediaUrl }) }
    }
    if (text === mediaUrl) {
      return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]) }
    }
    if (text === 'https://ref.example/a.png') {
      return { ok: true, arrayBuffer: async () => new Uint8Array([9, 9]) }
    }
    return { ok: false, status: 404 }
  }
  return calls
}

/** 项目注册表打桩：读到的既有文档（v3 形态）+ 记录写盘。 */
function stubRegistry(initialNodes, assetsDir) {
  const writes = []
  return {
    list: async () => [{ id: 'p1', name: 'P1', dir: assetsDir, createdAt: 1 }],
    assetsDir: () => assetsDir,
    readCanvas: async () => ({ version: 3, nodes: initialNodes }),
    writeCanvas: async (projectId, nodes) => { writes.push({ projectId, nodes: [...nodes] }) },
    appendCanvasNode: async (projectId, node) => { writes.push({ projectId, nodes: [node] }) },
    getWrites: () => writes,
  }
}

const REF_URL = 'https://ref.example/a.png'

test('retryOf：结果写回原节点，不追加新节点', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cs-generate-'))
  try {
    const prior = [{
      id: 'n1',
      kind: 'image',
      url: '/canvas-studio/assets/p1/old.png',
      title: '旧图',
      x: 40,
      y: 40,
      width: 260,
      height: 180,
      createdAt: 1000,
      origin: 'agent',
      sourceIds: ['seed-image'],
      operationType: 'image-to-image',
      generationPrompt: '{"prompt":"旧提示","filename":"ref.png"}',
      error: '生成失败: HTTP 500',
    }]
    const registry = stubRegistry(prior, dir)
    const calls = stubFetch()

    const result = await generateAsset(registry, 'image_generate', 'p1', {
      prompt: '新提示',
      filename: 'ref.png',
      retryOf: 'n1',
    })

    assert.equal(calls.length, 2) // 生成 / 产物下载（无参考图下载/上传步骤）
    const writes = registry.getWrites()
    assert.equal(writes.length, 1)
    const saved = writes[0].nodes
    assert.equal(saved.length, 1, 'retryOf 不追加新节点')
    const updated = saved[0]
    assert.equal(updated.id, 'n1', '保留原节点 id')
    assert.equal(updated.x, 40)
    assert.equal(updated.y, 40)
    assert.equal(updated.sourceIds[0], 'seed-image', '保留血缘')
    assert.equal(updated.title, '旧图', '保留标题')
    assert.equal(updated.error, undefined, '重试成功清除错误标记')
    assert.equal(updated.operationType, 'image-to-image')
    assert.equal(updated.generationPrompt, '{"prompt":"新提示","filename":"ref.png"}')
    assert.ok(updated.url.startsWith('/canvas-studio/assets/p1/'), '新产物同源相对 URL')
    assert.ok(result.url.startsWith('/canvas-studio/assets/p1/'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('retryOf：目标节点不存在时报错且不写盘', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cs-generate-'))
  try {
    const registry = stubRegistry([], dir)
    stubFetch()
    await assert.rejects(
      generateAsset(registry, 'image_generate', 'p1', { prompt: 'x', retryOf: 'ghost' }),
      /重试目标节点不存在/,
    )
    assert.equal(registry.getWrites().length, 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('普通生成：追加新节点并带 generationPrompt', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cs-generate-'))
  try {
    const registry = stubRegistry([], dir)
    stubFetch()
    await generateAsset(registry, 'image_generate', 'p1', { prompt: '一只猫' })
    const writes = registry.getWrites()
    assert.equal(writes.length, 1)
    const node = writes[0].nodes[0]
    assert.equal(node.kind, 'image')
    assert.equal(node.generationPrompt, '{"prompt":"一只猫"}')
    assert.equal(node.origin, 'agent')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
test('clampDuration：钳制到 [1,15]，默认值生效', () => {
  assert.equal(clampDuration(undefined, 5), 5)
  assert.equal(clampDuration(undefined, 10), 10)
  assert.equal(clampDuration(8, 10), 8)
  assert.equal(clampDuration(30, 10), 15)
  assert.equal(clampDuration(0.4, 10), 1)
})

test('video_composite 双图走首尾帧插值（fl2va）端点，时长被钳制', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cs-generate-'))
  try {
    const calls = stubFetch('https://media.example/out.mp4')
    const registry = stubRegistry([], dir)
    await generateAsset(registry, 'video_composite', 'p1', {
      prompt: 'x',
      aspectRatio: '16:9',
      duration: 30,
      filenames: ['a.png', 'b.png'],
    })
    const gen = calls.find((call) => call.url.includes('/generate/'))
    assert.ok(gen.url.includes('image2videofl2va'), `期望 fl2va 端点，实际 ${gen.url}`)
    const node = registry.getWrites()[0].nodes[0]
    assert.equal(node.duration, 15)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('api.md 契约：video_generate → image2videofl2va 首帧模式（image1=filename、aspect/megapixels、整数时长）', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cs-generate-'))
  try {
    const calls = stubFetch('https://media.example/out.mp4')
    await generateAsset(stubRegistry([], dir), 'video_generate', 'p1', {
      prompt: 'p', aspectRatio: '16:9', duration: 8.6, filename: 'bg.png',
    })
    const gen = calls.find((call) => call.url.includes('image2videofl2va'))
    assert.ok(gen, '缺少 image2videofl2va 调用')
    assert.equal(gen.body.prompt, 'p')
    assert.equal(gen.body.aspect, '16:9')
    assert.equal(gen.body.megapixels, 0.4)
    assert.equal(gen.body.image1, 'bg.png')
    assert.equal(gen.body.duration, 9) // clampDuration(8.6,5)→9
    assert.equal(gen.body.image2, undefined) // 未提供尾帧
    assert.equal(gen.body.background, undefined) // 不再走 msr
    assert.equal(gen.body.width, undefined)
    assert.equal(gen.body.fps, undefined)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('api.md 契约：video_generate 无 filename → image2videofl2va 文生视频（无 image1/image2）', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cs-generate-'))
  try {
    const calls = stubFetch('https://media.example/out.mp4')
    await generateAsset(stubRegistry([], dir), 'video_generate', 'p1', {
      prompt: 'p', aspectRatio: '9:16', duration: 5,
    })
    const gen = calls.find((call) => call.url.includes('image2videofl2va'))
    assert.ok(gen, '缺少 image2videofl2va 调用')
    assert.equal(gen.body.aspect, '9:16')
    assert.equal(gen.body.image1, undefined)
    assert.equal(gen.body.image2, undefined)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('api.md 契约：video_composite 双图 → image2videofl2va 请求体（aspect/megapixels/首尾帧）', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cs-generate-'))
  try {
    const calls = stubFetch('https://media.example/out.mp4')
    await generateAsset(stubRegistry([], dir), 'video_composite', 'p1', {
      prompt: 'p', aspectRatio: '9:16', duration: 6, filenames: ['a.png', 'b.png'],
    })
    const gen = calls.find((call) => call.url.includes('image2videofl2va'))
    assert.ok(gen, '缺少 image2videofl2va 调用')
    assert.equal(gen.body.aspect, '9:16')
    assert.equal(gen.body.megapixels, 0.4)
    assert.equal(gen.body.duration, 6)
    assert.equal(gen.body.image1, 'a.png')
    assert.equal(gen.body.image2, 'b.png')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('api.md 契约：video_composite 多图 → image2videoref2va（image1..imageN、aspect/megapixels）', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cs-generate-'))
  try {
    const calls = stubFetch('https://media.example/out.mp4')
    await generateAsset(stubRegistry([], dir), 'video_composite', 'p1', {
      prompt: 'p', aspectRatio: '16:9', duration: 10, filenames: ['a.png', 'b.png', 'c.png'],
    })
    const gen = calls.find((call) => call.url.includes('image2videoref2va'))
    assert.ok(gen, '缺少 image2videoref2va 调用')
    assert.equal(gen.body.aspect, '16:9')
    assert.equal(gen.body.megapixels, 0.4)
    assert.equal(gen.body.duration, 10)
    assert.equal(gen.body.image1, 'a.png')
    assert.equal(gen.body.image2, 'b.png')
    assert.equal(gen.body.image3, 'c.png')
    assert.equal(gen.body.images, undefined) // 不再走 mkr 的 images[]/frame_index
    assert.equal(gen.body.fps, undefined)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('api.md 契约：上传表单文件名唯一且不含空格括号（避免后端去重后缀破坏下游）', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cs-generate-'))
  try {
    const calls = stubFetch('https://media.example/out.png')
    await generateAsset(stubRegistry([], dir), 'image_generate', 'p1', { prompt: 'x' })
    // image_generate 无参考图不上传；直接走 uploadImage 需要参考图下载路径。
    const { uploadImage } = await import('../lib/generate.js')
    const filename = await uploadImage('https://ref.example/a.png')
    assert.match(filename, /^[\w.\-]+$/u, `文件名含不安全字符: ${filename}`)
    assert.ok(!calls.some((call) => String(call.url).includes('image2videomsr')))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('P8.1 契约：uploadLocalImage 落盘返回同源 URL + Drama filename', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cs-upload-'))
  try {
    const calls = stubFetch('https://media.example/out.png')
    const { uploadLocalImage } = await import('../lib/generate.js')
    const dataBase64 = Buffer.from([1, 2, 3, 4, 5]).toString('base64')
    const result = await uploadLocalImage(stubRegistry([], dir), 'p1', 'photo.png', dataBase64)
    // 返回结构：同源相对 URL + Drama 服务器文件名。
    assert.match(result.url, /^\/canvas-studio\/assets\/p1\/[\w.\-]+\.png$/u, `URL 非同源相对路径: ${result.url}`)
    assert.equal(result.filename, 'ref.png', `filename 应来自 Drama uploadimage: ${result.filename}`)
    // 发起了一次 Drama 上传（uploadimage），用于拿 filename。
    assert.ok(calls.some((call) => String(call.url).includes('/upload')), '未发起 Drama uploadimage 上传')
    // 本地写盘：assets 目录存在该文件。
    const { readdir } = await import('node:fs/promises')
    const files = await readdir(dir)
    assert.ok(files.some((file) => file.endsWith('.png')), `assets 未写盘: ${files.join(',')}`)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
