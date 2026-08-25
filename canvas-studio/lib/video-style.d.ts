import type { ProjectRegistry } from './projects.js';
/** 单帧产物：同源 URL + Drama 文件名 + 采样时间点（秒）。 */
export interface VideoFrameImport {
    url: string;
    filename: string;
    time: number;
}
/** 参考视频抽帧提风格的完整结果（返回给客户端落画布）。 */
export interface VideoStyleResult {
    /** 视频本体落盘后的同源 URL（留档；画布暂不建视频节点，见 plan §4.4）。 */
    videoUrl: string;
    /** 探测到的视频时长（秒；探测失败为 0）。 */
    duration: number;
    frames: VideoFrameImport[];
    /** 风格归纳文本（风格归纳 sticky 节点的正文）。 */
    summary: string;
}
/** 可选覆盖项（测试注入 / 高级用法）。 */
export interface VideoStyleOptions {
    /** 显式指定 ffmpeg 可执行文件路径（优先于 env 与自动探测）。 */
    ffmpegPath?: string;
    everySeconds?: number;
    maxFrames?: number;
    styleSamples?: number;
}
/**
 * 解析本机可用的 ffmpeg 可执行路径：显式参数 → FFMPEG_PATH → ffmpeg-static
 * （仅当二进制真实存在）→ PATH。全部落空抛中文可操作错误。
 */
export declare function resolveFfmpegPath(explicit?: string): string;
/**
 * 从 `ffmpeg -i` 的 stderr 里解析 `Duration: HH:MM:SS.frac` 为秒。
 * 解析失败返回 0（调用方按「未知时长只取第 0 帧」处理）。
 */
export declare function parseFfmpegDuration(stderr: string): number;
/**
 * 规划抽帧时间点（纯函数）：
 * - 时长未知/非法：只取第 0 帧；
 * - 短片（≤ every×max）：从 0 开始每 every 秒一帧；
 * - 长片（> every×max）：改为全片均匀取 max 帧（风格采样覆盖全片，仍 ≤ max）。
 * 返回保留两位小数的秒值，均严格小于时长。
 */
export declare function planFrameTimes(durationSec: number, options?: {
    everySeconds?: number;
    maxFrames?: number;
}): number[];
/**
 * 执行「上传参考视频 → 抽帧 → 上传 Drama → 风格归纳」全流程。
 * 视频与帧都写入项目 assets 目录（同源 URL 由 webServer 托管）；任何一步失败
 * 都整体抛错（客户端提示，不落半成品节点）。
 */
export declare function extractVideoStyle(registry: ProjectRegistry, projectId: string, name: string, bytes: Buffer, options?: VideoStyleOptions, signal?: AbortSignal): Promise<VideoStyleResult>;
