/**
 * canvas-view 纯函数冒烟测试：视口规范化（canvas.json v3）与无重叠整理布局。
 * 直连 Host tsc 编译产物 lib/canvas-view.js。运行：corepack yarn workspace canvas-studio test:smoke
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampViewScale, computeArrangeLayout, normalizeCanvasView } from '../lib/canvas-view.js'

test('normalizeCanvasView：缺失/非法输入回退默认值', () => {
  assert.equal(normalizeCanvasView(undefined), undefined)
  assert.equal(normalizeCanvasView(null), undefined)
  assert.equal(normalizeCanvasView('nope'), undefined)
  const view = normalizeCanvasView({ x: 'bad', y: 12, scale: 999, layersOpen: 'x' })
  assert.deepEqual(view, { x: 0, y: 12, scale: 5, layersOpen: false, minimapVisible: false })
})

test('clampViewScale：限制在 0.1–5', () => {
  assert.equal(clampViewScale(0.01), 0.1)
  assert.equal(clampViewScale(1), 1)
  assert.equal(clampViewScale(50), 5)
})

/** 构造一个画布节点（其余字段对布局无关，给最小合法值）。 */
function node(id, x, y, width, height, extra = {}) {
  return {
    id,
    kind: 'image',
    url: `/assets/${id}.png`,
    x,
    y,
    width,
    height,
    createdAt: 1000,
    origin: 'agent',
    sourceIds: [],
    ...extra,
  }
}

test('computeArrangeLayout：任意尺寸都不重叠', () => {
  const nodes = [
    node('a', 0, 0, 260, 180),
    node('b', 10, 10, 800, 600),
    node('c', -500, -500, 120, 90),
    node('d', 30, 30, 220, 140),
    node('e', 60, 60, 320, 220),
    node('f', 90, 90, 150, 400),
    node('g', 120, 120, 700, 100),
  ]
  const positions = computeArrangeLayout(nodes)
  assert.equal(positions.size, nodes.length)
  const placed = nodes.map(n => ({ id: n.id, ...positions.get(n.id), width: n.width, height: n.height }))
  for (let i = 0; i < placed.length; i += 1) {
    const left = placed[i]
    assert.ok(left.x !== undefined && Number.isFinite(left.y), `${left.id} 有坐标`)
    for (let j = i + 1; j < placed.length; j += 1) {
      const right = placed[j]
      const separated = left.x + left.width <= right.x
        || right.x + right.width <= left.x
        || left.y + left.height <= right.y
        || right.y + right.height <= left.y
      assert.ok(separated, `${left.id} 与 ${right.id} 不重叠`)
    }
  }
})

test('computeArrangeLayout：组节点随行，子图层保持相对位置', () => {
  const group = node('g', 100, 100, 500, 400, { kind: 'group', title: '分组' })
  const childA = node('a', 120, 120, 200, 150, { parentId: 'g' })
  const childB = node('b', 350, 200, 180, 130, { parentId: 'g' })
  const free = node('f', 0, 0, 260, 180)
  const positions = computeArrangeLayout([group, childA, childB, free])
  // 组与自由节点都被移动；子图层跟随组的位移。
  const groupDeltaX = positions.get('g').x - group.x
  const groupDeltaY = positions.get('g').y - group.y
  assert.notEqual(groupDeltaX, 0)
  assert.equal(positions.get('a').x, childA.x + groupDeltaX)
  assert.equal(positions.get('a').y, childA.y + groupDeltaY)
  assert.equal(positions.get('b').x, childB.x + groupDeltaX)
  assert.equal(positions.get('b').y, childB.y + groupDeltaY)
  // 组盒子仍包裹子图层（相对位置不变 → 包裹性不变）。
  const g = positions.get('g')
  const a = positions.get('a')
  assert.ok(a.x >= g.x && a.y >= g.y)
})

test('computeArrangeLayout：空列表返回空映射', () => {
  assert.equal(computeArrangeLayout([]).size, 0)
})
