/**
 * P9.1 时间轴排序持久化 契约测试。
 *
 * 1. normalizeCanvasView：timeline 字段的合法往返与非法丢弃（旧文档兼容）。
 * 2. deriveTimelineOrder：持久化顺序优先、已删节点剔除、新节点按 createdAt
 *    追加、无 timeline 时整体按 createdAt 派生。
 *
 * 运行：corepack yarn workspace canvas-studio run test:smoke
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeCanvasView, deriveTimelineOrder } from '../lib/canvas-view.js'

function node(id, createdAt, extra = {}) {
  return {
    id,
    kind: 'video',
    url: `/assets/${id}.mp4`,
    x: 0,
    y: 0,
    width: 260,
    height: 180,
    createdAt,
    origin: 'agent',
    sourceIds: [],
    ...extra,
  }
}

test('normalizeCanvasView：timeline 合法数组保留，非法/缺失丢弃', () => {
  const view = normalizeCanvasView({ x: 1, y: 2, scale: 1, layersOpen: false, minimapVisible: false, timeline: ['b', 'a'] })
  assert.deepEqual(view?.timeline, ['b', 'a'])

  const mixed = normalizeCanvasView({ timeline: ['b', 3] })
  assert.equal(mixed?.timeline, undefined, '混入非字符串应整体丢弃')

  const legacy = normalizeCanvasView({})
  assert.equal(legacy?.timeline, undefined, '旧文档无该字段应保持缺失（兼容）')
})

test('deriveTimelineOrder：持久化顺序优先，剔除已删除节点', () => {
  const nodes = [node('a', 1), node('b', 2), node('c', 3)]
  const ordered = deriveTimelineOrder(nodes, ['c', 'a', 'ghost'])
  assert.deepEqual(ordered.map(n => n.id), ['c', 'a', 'b'], 'ghost 应被剔除；未入列的 b 按 createdAt 追加在后')
})

test('deriveTimelineOrder：重复 id 只保留一次；新节点追加到末尾', () => {
  const nodes = [node('a', 1), node('b', 2)]
  const ordered = deriveTimelineOrder(nodes, ['a', 'a'])
  assert.deepEqual(ordered.map(n => n.id), ['a', 'b'])

  const withNew = deriveTimelineOrder([node('a', 1), node('b', 2), node('new', 0)], ['b', 'a'])
  assert.deepEqual(withNew.map(n => n.id), ['b', 'a', 'new'], 'new 不在持久化列表，createdAt 最小也应追加在末尾')
})

test('deriveTimelineOrder：无 timeline 时整体按 createdAt 派生（旧文档兼容）', () => {
  const nodes = [node('late', 9), node('early', 1), node('mid', 5)]
  const ordered = deriveTimelineOrder(nodes, undefined)
  assert.deepEqual(ordered.map(n => n.id), ['early', 'mid', 'late'])
  // 空画布安全。
  assert.deepEqual(deriveTimelineOrder([], ['x']), [])
})
