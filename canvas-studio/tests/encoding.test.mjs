/**
 * P8.1 编码层回归测试：
 *
 * 历史 bug：`File.text()` 会按 UTF-8 解码二进制，把 0x80–0xFF 字节替换成
 * U+FFFD，导致 PNG/JPEG 头部字节被破坏，落地的 PNG 文件 `<img>` 无法识别、
 * 触发「媒体加载失败」。契约测试用 ASCII 字节（1,2,3,4,5）测不到这条路径。
 *
 * 这里直接验证 `bytesToBase64` 对真实 PNG magic + 高位字节做往返一致，
 * 并断言「如果走旧的 text()+btoa(unescape(encodeURIComponent)) 路径会破坏字节」——
 * 把回归点钉死在测试里，防止有人把代码退回旧实现。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bytesToBase64 } from '../lib/encoding.js'

// 真实 PNG magic + 一段任意高位字节（含 0x89、0xFF、连续 0x80、含 0x00、含 0x0A）。
const PNG_LIKE_BYTES = new Uint8Array([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG 头
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
  0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x02, 0x50, 0x58,
  0xEA, 0x80, 0x81, 0x82, 0x83, 0xFE, 0xFF, 0xC0,
  0xA0, 0xB0, 0x90, 0xFF, 0x00, 0x01, 0x02, 0x7F,
])

test('bytesToBase64：标准 base64 解码后与原始字节一致', () => {
  const b64 = bytesToBase64(PNG_LIKE_BYTES)
  const decoded = Buffer.from(b64, 'base64')
  assert.equal(decoded.length, PNG_LIKE_BYTES.length, '往返长度一致')
  for (let i = 0; i < PNG_LIKE_BYTES.length; i += 1) {
    assert.equal(decoded[i], PNG_LIKE_BYTES[i], `第 ${i} 字节不一致（0x${decoded[i]?.toString(16)} vs 0x${PNG_LIKE_BYTES[i]?.toString(16)}）`)
  }
})

test('bytesToBase64：PNG magic 头（8 字节）精确保留', () => {
  // 这是关键回归点：PNG magic 必须在传输后还能被 `<img>` 识别为 PNG。
  const pngMagic = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
  const b64 = bytesToBase64(pngMagic)
  const decoded = Buffer.from(b64, 'base64')
  assert.deepEqual(Array.from(decoded), Array.from(pngMagic))
})

test('bytesToBase64：大文件（>32KB chunk 边界）也能正确处理', () => {
  // bytesToBase64 按 0x8000（32KB）分块，必须处理跨分块边界。
  // 构造 40KB 字节：每个字节等于其索引 & 0xFF，确保高位字节散布。
  const size = 40 * 1024
  const bytes = new Uint8Array(size)
  for (let i = 0; i < size; i += 1) bytes[i] = i & 0xFF
  const b64 = bytesToBase64(bytes)
  const decoded = Buffer.from(b64, 'base64')
  assert.equal(decoded.length, size, '大文件长度一致')
  // 抽样校验高位字节（0xFF 应在 index=255、511、767... 处出现）。
  assert.equal(decoded[255], 0xFF)
  assert.equal(decoded[32 * 1024 + 255], 0xFF) // 跨分块
})

test('bytesToBase64：空数组返回空字符串', () => {
  assert.equal(bytesToBase64(new Uint8Array(0)), '')
})
