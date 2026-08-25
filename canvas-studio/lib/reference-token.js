/**
 * @ref 引用标记工具（Host/Client 共用，纯函数，无副作用）。
 *
 * 画布参考托盘里的图片节点用 `@ref[显示名]` 作为对话内引用句柄：用户在节点
 * 详情面板 / 参考托盘点「引用到对话」会把该标记复制到剪贴板，粘贴进聊天框后，
 * Host 侧生成工具（image_generate / video_generate / style_transfer / video_composite）
 * 会自动把 `@ref[显示名]` 解析成对应的 Drama Backend 文件名，免去手动 upload_image。
 *
 * 这与 Midjourney 的 `--cref` / `--sref` token、Runway 的参考区思路一致：
 * 一个稳定的引用句柄，跨「画布 ↔ 聊天」复用素材。
 */
/** 把节点显示名格式化为对话内引用标记。 */
export function formatRefToken(title) {
    return `@ref[${title}]`;
}
/**
 * 从一段文本里抽取所有 `@ref[显示名]` 标记，返回显示名数组（去重保持首次出现顺序）。
 * 用于 Host 侧在工具参数里识别 `@ref[...]` 并解析成 Drama 文件名。
 */
export function parseRefTokens(text) {
    const out = [];
    const seen = new Set();
    const re = /@ref\[([^\]]+)\]/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        const name = m[1];
        if (!seen.has(name)) {
            seen.add(name);
            out.push(name);
        }
    }
    return out;
}
