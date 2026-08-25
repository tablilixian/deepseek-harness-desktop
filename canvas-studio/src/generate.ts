/**
 * Canvas Studio P3 媒体生成（Host 侧）。
 *
 * 调用 Drama Backend（参考 WL 适配器），下载产物并落盘到项目 `assets/`，
 * 返回 webServer 托管的 URL。浏览器侧工具经 `/canvas-studio/generate` 路由
 * 调用本模块，规避渲染进程的 CORS 限制。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  DRAMA_API_BASE,
  DRAMA_ENDPOINTS,
  newAssetId,
  sizeForAspectRatio,
} from './config.js'
import type { ProjectRegistry } from './projects.js'
import type { StudioCanvasNode, StudioCanvasOperationType } from './contracts/canvas.js'

/** 一次生成的请求参数（来自客户端工具）。 */
export interface GenerateParams {
  prompt: string
  aspectRatio?: string
  /** 已上传到 Drama Backend 的服务器文件名（image_generate 图生图 / video_generate / style_transfer / image2vl / deduction / storyboard_generate 用）。 */
  filename?: string
  /** 已上传的 Drama Backend 文件名数组（video_composite 用）。 */
  filenames?: string[]
  /** 风格迁移的参考风格图文件名（style_transfer 用，已上传到 Drama Backend）。 */
  styleFilename?: string
  negativePrompt?: string
  duration?: number
  /** 分镜格子数量（storyboard_generate 用，默认 4）。 */
  gridnum?: number
  /** 是否增强风格迁移效果（style_transfer 用）。 */
  enhance?: boolean
  /**
   * 节点级重试锚点：设置时把结果写回该已有节点（保留 id/位置/血缘），
   * 而不是追加新节点 —— 重试不产生新边（plan §7.8 标准 2）。
   */
  retryOf?: string
  /**
   * 输入参考图对应的画布产物 URL（工具结果里的 url 字段）。落盘时按 URL
   * 反查画布节点并写入 sourceIds —— 血缘边（流程箭头）的唯一来源；缺省
   * 时新节点没有边（历史行为）。
   */
  sourceUrls?: string[]
}

/** 一次生成的产物描述（返回给模型）。 */
export interface GenerateResult {
  url: string
  width: number
  height: number
  duration?: number
}

/**
 * 视频时长上限（秒）：后端长视频生成经常失败，单段必须 ≤15s（建议 ~10s）。
 * 更长的成片由 P9 本地拼接多段完成，而不是拉长单段。
 */
export const MAX_VIDEO_SECONDS = 15

/** 钳制视频时长：1–15s 取整；未提供时用各工具的默认值。 */
export function clampDuration(value: number | undefined, fallback: number): number {
  return Math.min(MAX_VIDEO_SECONDS, Math.max(1, Math.round(value ?? fallback)))
}

/** Drama Backend 调用超时（毫秒）：视频生成最慢，文本类最快。 */
const DRAMA_TIMEOUT_MS = { image: 360_000, video: 600_000, text: 60_000 }

/** 带超时与一次性自动重试的 Drama POST（网络错误 / 502/503/504 时重试）。 */
async function dramaPost(
  endpoint: string,
  init: RequestInit,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Response> {
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const timeout = AbortSignal.timeout(timeoutMs)
    const composed = signal ? AbortSignal.any([signal, timeout]) : timeout
    try {
      const response = await fetch(`${DRAMA_API_BASE}${endpoint}`, { ...init, signal: composed })
      if ((response.status === 502 || response.status === 503 || response.status === 504) && attempt === 0) {
        lastError = new Error(`Drama Backend 暂时不可用（HTTP ${response.status}），已自动重试一次`)
        continue
      }
      return response
    } catch (cause) {
      // 用户主动打断不重试、不改写错误。
      if (signal?.aborted) throw cause
      lastError = cause
      if (attempt === 0) continue
      throw new Error(
        `Drama Backend 连接失败（已重试一次）：${cause instanceof Error ? cause.message : String(cause)}。请检查服务是否可达。`,
      )
    }
  }
  throw lastError instanceof Error ? lastError : new Error('生成失败')
}

/**
 * 将相对 URL 解析为 loopback 绝对 URL（Host 端 fetch 用）。
 * 浏览器端 <img src> 能自动解析同源相对路径，但 Node 原生 fetch 不支持，
 * 而 image_generate 返回的产物 URL 是相对路径（/canvas-studio/assets/...），
 * 后续 video_generate / video_composite 作为参考图传入时必须先补全。
 */
function resolveImageUrl(url: string, port: number): string {
  return url.startsWith('/') ? `http://127.0.0.1:${port}${url}` : url
}

/** 上传一张图（本地/远程 URL）到 Drama Backend，返回服务器 filename。 */
async function uploadImage(sourceUrl: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(sourceUrl, { signal: signal ?? null })
  if (!response.ok) throw new Error(`参考图下载失败: ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  const form = new FormData()
  // 每次上传用唯一且只含 [A-Za-z0-9._-] 的表单文件名：写死同名会触发后端
  // 去重后缀（如 "reference (463).png"），带空格括号的文件名传回 ComfyUI
  // 工作流会导致生成 500。
  form.append('file', new Blob([bytes]), `ref-${newAssetId().slice(0, 8)}.png`)
  const upload = await fetch(`${DRAMA_API_BASE}${DRAMA_ENDPOINTS.uploadimage}`, {
    method: 'POST',
    body: form,
    signal: signal ?? null,
  })
  if (!upload.ok) throw new Error(`参考图上传失败: ${upload.status}`)
  const data = await upload.json() as Record<string, unknown>
  // 兼容多种响应格式：{ filename } / { name } / { data: { filename } } / { data: { url } }
  const filename = (data.filename
    ?? data.name
    ?? (data.data as Record<string, unknown> | undefined)?.filename
    ?? (data.data as Record<string, unknown> | undefined)?.url
  ) as string | undefined
  if (!filename) throw new Error(`参考图上传成功但未返回 filename（响应: ${JSON.stringify(data)}）`)
  return filename
}

/** 统一解析失败响应：优先结构化字段，否则带出响应体片段（便于定位 500 真因）。 */
async function describeError(response: Response): Promise<string> {
  let message = `HTTP ${response.status}`
  try {
    const text = await response.text()
    if (text.length > 0) {
      try {
        const data = JSON.parse(text) as { error?: { message?: string }; msg?: string; detail?: string }
        message = data.error?.message || data.msg || data.detail || message
      } catch {
        message = text.slice(0, 200)
      }
    }
  } catch {
    /* keep default */
  }
  return message
}

/** 调用 Drama Backend 生成接口，取回产物 URL。 */
async function callDrama(
  endpoint: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
  kind: keyof typeof DRAMA_TIMEOUT_MS = 'image',
): Promise<string> {
  const response = await dramaPost(
    endpoint,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
    DRAMA_TIMEOUT_MS[kind],
    signal,
  )
  if (!response.ok) {
    throw new Error(`生成失败: ${await describeError(response)}`)
  }
  const data = await response.json() as { full_url?: string; data?: Array<{ url?: string }> }
  if (data.full_url) return data.full_url
  const imageUrl = data.data?.[0]?.url
  if (imageUrl) return imageUrl
  throw new Error('生成响应中未找到产物 URL')
}

/** 生成工具名 → 画布操作类型（边颜色/标签的语义来源）。 */
export function operationTypeOf(tool: string, params: GenerateParams): StudioCanvasOperationType {
  if (tool === 'image_generate') return params.filename !== undefined ? 'image-to-image' : 'text-to-image'
  if (tool === 'video_generate') return 'image-to-video'
  if (tool === 'video_composite') return 'mkr-video'
  if (tool === 'style_transfer') return 'style-transfer'
  if (tool === 'storyboard_generate') return 'storyboard'
  return 'import'
}

/** 把生成参数序列化为 generationPrompt（节点重试时原样重放；retryOf 不入档）。 */
export function generationPromptOf(params: GenerateParams): string {
  const { retryOf: _retryOf, ...rest } = params
  return JSON.stringify(rest)
}

/**
 * 按画布产物 URL 反查节点 id（血缘 sourceIds 的来源）。URL 兼容两种形态：
 * 工具结果里的同源相对路径（/canvas-studio/assets/...）与早期版本写死的
 * http://127.0.0.1:<port> 绝对路径 —— 都归一化到相对路径后精确匹配。
 */
export function resolveSourceIds(nodes: readonly StudioCanvasNode[], urls: readonly string[] | undefined): string[] {
  if (urls === undefined || urls.length === 0) return []
  const relative = (value: string): string => value.replace(/^https?:\/\/127\.0\.0\.1:\d+(\/canvas-studio\/.*)$/, '$1')
  const byUrl = new Map(nodes.map((node) => [node.url !== undefined ? relative(node.url) : '', node.id]))
  const ids: string[] = []
  for (const url of urls) {
    if (typeof url !== 'string' || url.length === 0) continue
    const id = byUrl.get(relative(url))
    if (id !== undefined && !ids.includes(id)) ids.push(id)
  }
  return ids
}

/** 提示词增强：调用 Drama Backend 的 image2promptenhance 接口。 */
export async function enhancePrompt(
  prompt: string,
  signal?: AbortSignal,
): Promise<string> {
  const data = await callDramaRaw(DRAMA_ENDPOINTS.promptEnhance, { prompt }, signal)
  return (data.output ?? data.msg ?? data) as string
}

/** 图像分析（VLM）：调用 Drama Backend 的 image2vl 接口，使用已上传的文件名。 */
export async function analyzeImage(
  filename: string,
  prompt: string,
  systemPrompt: string,
  signal?: AbortSignal,
): Promise<string> {
  const data = await callDramaRaw(DRAMA_ENDPOINTS.image2vl, {
    image: filename,
    prompt,
    system_prompt: systemPrompt,
  }, signal)
  return (data.output ?? data.msg ?? JSON.stringify(data)) as string
}

/** 剧情推演：分析当前帧画面，推演下一帧构图，使用已上传的文件名。 */
export async function deduction(
  filename: string,
  analysisPrompt?: string,
  deductionPrompt?: string,
  analysisSystemPrompt?: string,
  deductionSystemPrompt?: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = { image: filename }
  if (analysisPrompt !== undefined) body.analysis_prompt = analysisPrompt
  if (deductionPrompt !== undefined) body.deduction_prompt = deductionPrompt
  if (analysisSystemPrompt !== undefined) body.analysis_system_prompt = analysisSystemPrompt
  if (deductionSystemPrompt !== undefined) body.deduction_system_prompt = deductionSystemPrompt
  return callDramaRaw(DRAMA_ENDPOINTS.deduction, body, signal)
}

/** 带 raw 响应解析的 callDrama（文本工具用，返回完整 JSON）。 */
async function callDramaRaw(
  endpoint: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const response = await dramaPost(
    endpoint,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
    DRAMA_TIMEOUT_MS.text,
    signal,
  )
  if (!response.ok) {
    throw new Error(`生成失败: ${await describeError(response)}`)
  }
  return response.json() as Promise<Record<string, unknown>>
}

/**
 * 执行一次生成并落盘。
 * @param registry - 项目注册表（提供 assetsDir）。
 * @param tool - 工具名（image_generate / video_generate / video_composite / style_transfer / storyboard_generate）。
 * @param projectId - 目标项目 id。
 * @param params - 生成参数。
 * @param signal - 取消信号。
 */
export async function generateAsset(
  registry: ProjectRegistry,
  tool: string,
  projectId: string,
  params: GenerateParams,
  signal?: AbortSignal,
): Promise<GenerateResult> {
  const projects = await registry.list()
  const project = projects.find((entry) => entry.id === projectId)
  if (!project) throw new Error(`项目不存在: ${projectId}`)

  const size = sizeForAspectRatio(params.aspectRatio)
  const isVideo = tool === 'video_generate' || tool === 'video_composite'
  let mediaUrl: string

  if (tool === 'image_generate') {
    if (params.filename) {
      mediaUrl = await callDrama(
        DRAMA_ENDPOINTS.image2image,
        {
          prompt: params.prompt,
          width: size.width,
          height: size.height,
          image1: params.filename,
          ...(params.negativePrompt ? { negative_prompt: params.negativePrompt } : {}),
        },
        signal,
      )
    } else {
      mediaUrl = await callDrama(
        DRAMA_ENDPOINTS.txt2image,
        {
          prompt: params.prompt,
          width: size.width,
          height: size.height,
          ...(params.negativePrompt ? { negative_prompt: params.negativePrompt } : {}),
        },
        signal,
      )
    }
  } else if (tool === 'video_generate') {
    if (!params.filename) throw new Error('video_generate 需要提供 filename（来自 upload_image 工具）')
    mediaUrl = await callDrama(
      DRAMA_ENDPOINTS.videoMsr,
      {
        prompt: params.prompt,
        width: size.width,
        height: size.height,
        // 时长钳制 ≤15s（后端长视频易失败，建议 ~10s）。
        duration: clampDuration(params.duration, 5),
        fps: 30,
        background: params.filename,
      },
      signal,
      'video',
    )
  } else if (tool === 'video_composite') {
    const filenames = params.filenames ?? []
    if (filenames.length < 1) throw new Error('video_composite 需要提供 filenames（来自 upload_image 工具）')
    if (filenames.length === 2) {
      // 首尾帧插值优先（image2videofl2va）：两图场景下比 MKR 关键帧插值更稳。
      // 该接口用 aspect + megapixels 而非 width/height，且只支持 16:9 / 9:16
      // （1:1 就近落到 16:9）。
      const aspect = params.aspectRatio === '9:16' ? '9:16' : '16:9'
      mediaUrl = await callDrama(
        DRAMA_ENDPOINTS.videoFl2va,
        {
          prompt: params.prompt,
          aspect,
          megapixels: 0.4,
          duration: clampDuration(params.duration, 10),
          image1: filenames[0],
          image2: filenames[1],
        },
        signal,
        'video',
      )
    } else {
      // 多关键帧 MKR：frame_index 按时间轴均分（duration × fps 的帧位置，
      // 不是数组下标）；最后一张图用 -1 标记结束。时长同样钳制 ≤15s。
      const duration = clampDuration(params.duration, 10)
      const totalFrames = duration * 30
      const images = filenames.map((image, index) => ({
        image,
        frame_index: index === filenames.length - 1
          ? -1
          : Math.round((index / (filenames.length - 1)) * totalFrames),
      }))
      mediaUrl = await callDrama(
        DRAMA_ENDPOINTS.videoMkr,
        {
          prompt: params.prompt,
          width: size.width,
          height: size.height,
          duration,
          fps: 30,
          images,
        },
        signal,
        'video',
      )
    }
  } else if (tool === 'style_transfer') {
    if (!params.filename || !params.styleFilename) {
      throw new Error('style_transfer 需要提供 filename（目标图）和 styleFilename（风格参考图）')
    }
    mediaUrl = await callDrama(
      DRAMA_ENDPOINTS.styleTransfer,
      {
        image1: params.filename,
        image2: params.styleFilename,
        ...(params.prompt ? { prompt: params.prompt } : {}),
        ...(params.enhance !== undefined ? { enhance: params.enhance } : {}),
      },
      signal,
    )
  } else if (tool === 'storyboard_generate') {
    mediaUrl = await callDrama(
      DRAMA_ENDPOINTS.storyboard,
      {
        prompt: params.prompt,
        gridnum: params.gridnum ?? 4,
        width: size.width,
        ...(params.filename ? { image: params.filename } : {}),
      },
      signal,
    )
  } else {
    throw new Error(`未知的生成工具: ${tool}`)
  }

  const download = await fetch(mediaUrl, { signal: signal ?? null })
  if (!download.ok) throw new Error(`产物下载失败: ${download.status}`)
  const bytes = Buffer.from(await download.arrayBuffer())

  const assetId = newAssetId()
  const extension = isVideo ? 'mp4' : 'png'
  const filename = `${assetId}.${extension}`
  const directory = registry.assetsDir(projectId)
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, filename), bytes)

  // 同源相对路径：渲染进程与 webServer 同源，相对 URL 自动解析到当前端口，
  // 桌面重启换端口也不失效（此前写死 127.0.0.1:<port> 在端口变化后会 404）。
  const url = `/canvas-studio/assets/${projectId}/${filename}`

  // Persist a canvas node the moment the asset lands on disk (Host is the
  // source of truth). The client reloads the canvas document on tool/result,
  // so a successful generation shows on the canvas even if the conversation
  // event's rendered text carries no usable URL.
  // 血缘：按 params.sourceUrls 反查输入参考图对应的画布节点（流程箭头）。
  const sourceIds = resolveSourceIds((await registry.readCanvas(projectId)).nodes, params.sourceUrls)

  // 节点级重试（params.retryOf）：原地更新已有节点，保留 id/位置/血缘/编组，
  // 边不增加（plan §7.8 标准 2）。普通生成则追加新节点。
  if (params.retryOf !== undefined) {
    const existing = (await registry.readCanvas(projectId)).nodes
    const target = existing.find((node) => node.id === params.retryOf)
    if (target === undefined) {
      throw new Error(`重试目标节点不存在: ${params.retryOf}`)
    }
    const { error: _staleError, ...targetRest } = target
    const updated: StudioCanvasNode = {
      ...targetRest,
      url,
      width: size.width,
      height: size.height,
      operationType: operationTypeOf(tool, params),
      toolName: tool,
      generationPrompt: generationPromptOf(params),
      ...(isVideo ? { duration: clampDuration(params.duration, tool === 'video_composite' ? 10 : 5) } : {}),
    }
    await registry.writeCanvas(projectId, existing.map((node) => (node.id === target.id ? updated : node)))
  } else {
    const node: StudioCanvasNode = {
      id: assetId,
      kind: isVideo ? 'video' : 'image',
      url,
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
      createdAt: Date.now(),
      toolName: tool,
      runId: assetId,
      origin: 'agent',
      sourceIds,
      operationType: operationTypeOf(tool, params),
      generationPrompt: generationPromptOf(params),
      ...(isVideo ? { duration: clampDuration(params.duration, tool === 'video_composite' ? 10 : 5) } : {}),
    }
    await registry.appendCanvasNode(projectId, node)
  }

  const result: GenerateResult = { url, width: size.width, height: size.height }
  if (isVideo) result.duration = clampDuration(params.duration, tool === 'video_composite' ? 10 : 5)
  return result
}

// 导出供 host-tools.ts 中 upload_image 工具使用。
export { uploadImage, resolveImageUrl }
