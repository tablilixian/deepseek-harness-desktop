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
import { generateAsset } from '../lib/generate.js'

/** 打桩 fetch：参考图下载 / 上传 / 生成 / 产物下载。 */
function stubFetch(mediaUrl = 'https://media.example/out.png') {
  const calls = []
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? 'GET' })
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

/** 项目注册表打桩：读到的既有节点 + 记录写盘。 */
function stubRegistry(initialNodes, assetsDir) {
  const writes = []
  return {
    list: async () => [{ id: 'p1', name: 'P1', dir: assetsDir, createdAt: 1 }],
    assetsDir: () => assetsDir,
    readCanvas: async () => initialNodes,
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
      generationPrompt: '{"prompt":"旧提示","imageUrl":"' + REF_URL + '"}',
      error: '生成失败: HTTP 500',
    }]
    const registry = stubRegistry(prior, dir)
    const calls = stubFetch()

    const result = await generateAsset(registry, 'image_generate', 'p1', {
      prompt: '新提示',
      imageUrl: REF_URL,
      retryOf: 'n1',
    })

    assert.equal(calls.length, 4) // 参考图下载 / 上传 / 生成 / 产物下载
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
    assert.equal(updated.generationPrompt, '{"prompt":"新提示","imageUrl":"' + REF_URL + '"}')
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