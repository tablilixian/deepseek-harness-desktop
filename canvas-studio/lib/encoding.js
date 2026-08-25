/**
 * 通用编码工具（纯函数，不依赖 DOM / Node 专属 API）。
 *
 * 客户端与 Host 端共享：放在 src/ 顶层，不在 src/client/** 内，确保
 * `tsc -p tsconfig.json`（host）会 emit `lib/encoding.js`，便于测试 import。
 * 客户端通过 `client/api.ts` 重新 export 给 React 组件使用。
 */
/**
 * 把 `Uint8Array` 编码为标准 base64。
 *
 * 不能用 `File.text() + btoa(unescape(encodeURIComponent(text)))` 这条捷径：
 * `File.text()` 会按 UTF-8 解码二进制，把 0x80–0xFF 的字节替换成 U+FFFD，
 * 导致 PNG/JPEG 头部字节被破坏，落地后再被 `<img>` 加载会触发 `onerror`。
 *
 * 直接走字节，按 32KB 分块避免向 V8 一次性推过多参数。
 */
export function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}
