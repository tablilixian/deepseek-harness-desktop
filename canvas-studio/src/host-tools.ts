/**
 * Canvas Studio P3 媒体生成工具（Host 侧）。
 *
 * `ctx.tools` 是 Host 服务，因此工具定义必须注册在 Host（浏览器客户端没有
 * `tools` 服务，之前在客户端注册正是桌面闪退的根因）。每个工具的 `execute`
 * 从会话工作区解析绑定的项目（`exec.agent.session.header.cwd`，即项目拥有的
 * 目录），再调用 Host 的 `generateAsset` —— 外部 API 调用与落盘都在 Host 完成，
 * 既规避浏览器 CORS，也避免跨进程 HTTP 往返。
 */
import { sep } from 'node:path'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ProjectRegistry } from './projects.js'
import { generateAsset, type GenerateParams, type GenerateResult } from './generate.js'

/** 产物结果 schema（工具返回给模型的结构）。 */
const resultSchema = {
  type: 'object' as const,
  additionalProperties: false,
  properties: {
    url: { type: 'string' as const, description: '产物托管 URL，可在画布中直接引用' },
    width: { type: 'integer' as const, description: '宽度（像素）' },
    height: { type: 'integer' as const, description: '高度（像素）' },
    duration: { type: 'number' as const, description: '视频时长（秒）；图片无此项' },
  },
}

/** 把产物结果渲染成模型可读的文本块。 */
function renderResult(value: unknown): ContentBlock[] {
  const result = value as GenerateResult
  const duration = result.duration !== undefined ? `, ${result.duration}s` : ''
  return [{ type: 'text', text: `已生成产物: ${result.url} (${result.width}x${result.height}${duration})` }]
}

/**
 * 从会话工作区目录解析绑定的 Canvas Studio 项目 id。
 * 项目的工作区目录即 `project.dir`；精确匹配优先，否则取最长前缀匹配
 * （会话 cwd 落在项目目录内的子路径时也能命中）。
 */
async function resolveProjectId(registry: ProjectRegistry, cwd: string | undefined): Promise<string> {
  if (!cwd) {
    throw new Error('当前会话未绑定工作区，请先在左侧打开或创建一个 Canvas Studio 项目')
  }
  const projects = await registry.list()
  let match: string | null = null
  let bestLength = -1
  for (const project of projects) {
    const dir = project.dir
    if (dir === cwd || cwd.startsWith(dir + sep)) {
      if (dir.length > bestLength) {
        bestLength = dir.length
        match = project.id
      }
    }
  }
  if (match === null) {
    throw new Error('当前会话工作区未绑定任何 Canvas Studio 项目，请先在左侧打开或创建一个项目')
  }
  return match
}

/** 解析项目后调用 Host 的 generateAsset 执行一次生成。 */
function runGeneration(
  registry: ProjectRegistry,
  tool: string,
  params: GenerateParams,
  signal: AbortSignal,
  cwd: string | undefined,
): Promise<GenerateResult> {
  return resolveProjectId(registry, cwd).then((projectId) =>
    generateAsset(registry, tool, projectId, params, signal))
}

/**
 * 创建 P3 媒体生成工具集（供 Host 的 `ctx.tools.register` 逐条注册）。
 * @param registry - 项目注册表。
 * @returns 三个 `defineTool` 定义。
 */
export function createStudioTools(registry: ProjectRegistry) {
  return [
    defineTool({
      name: 'image_generate',
      description:
        '根据提示词生成一张图片。可传入 imageUrl 作为参考图进行图生图。返回图片的托管 URL 与尺寸。',
      parameters: {
        prompt: { type: 'string' as const, required: true, description: '生成提示词' },
        aspectRatio: { type: 'string' as const, enum: ['16:9', '9:16', '1:1'], description: '宽高比，默认 16:9' },
        imageUrl: { type: 'string' as const, description: '可选参考图 URL（图生图）' },
        negativePrompt: { type: 'string' as const, description: '反向提示词' },
      },
      output: { schema: resultSchema, render: renderResult },
      async execute(args, exec) {
        const a = args as { prompt: string; aspectRatio?: string; imageUrl?: string; negativePrompt?: string }
        return runGeneration(registry, 'image_generate', {
          prompt: a.prompt,
          ...(a.aspectRatio !== undefined ? { aspectRatio: a.aspectRatio } : {}),
          ...(a.imageUrl !== undefined ? { imageUrl: a.imageUrl } : {}),
          ...(a.negativePrompt !== undefined ? { negativePrompt: a.negativePrompt } : {}),
        }, exec.signal, exec.agent?.session.header.cwd)
      },
    }),
    defineTool({
      name: 'video_generate',
      description:
        '根据提示词与一张参考图生成视频（图生视频）。imageUrl 通常来自 image_generate 的产物 URL。返回视频的托管 URL、尺寸与时长。',
      parameters: {
        prompt: { type: 'string' as const, required: true, description: '生成提示词' },
        imageUrl: { type: 'string' as const, required: true, description: '参考图 URL（图生视频的输入帧）' },
        aspectRatio: { type: 'string' as const, enum: ['16:9', '9:16', '1:1'], description: '宽高比，默认 16:9' },
        duration: { type: 'number' as const, description: '视频时长（秒），默认 5' },
      },
      output: { schema: resultSchema, render: renderResult },
      async execute(args, exec) {
        const a = args as { prompt: string; imageUrl: string; aspectRatio?: string; duration?: number }
        return runGeneration(registry, 'video_generate', {
          prompt: a.prompt,
          imageUrl: a.imageUrl,
          ...(a.aspectRatio !== undefined ? { aspectRatio: a.aspectRatio } : {}),
          ...(a.duration !== undefined ? { duration: a.duration } : {}),
        }, exec.signal, exec.agent?.session.header.cwd)
      },
    }),
    defineTool({
      name: 'video_composite',
      description:
        '将多张参考图（imageUrls）合成一段视频，首尾帧插值。返回合成视频的托管 URL、尺寸与时长。',
      parameters: {
        prompt: { type: 'string' as const, required: true, description: '生成提示词' },
        imageUrls: { type: 'array' as const, description: '参考图 URL 数组（至少 1 张，最多 4 张）' },
        aspectRatio: { type: 'string' as const, enum: ['16:9', '9:16', '1:1'], description: '宽高比，默认 16:9' },
        duration: { type: 'number' as const, description: '视频时长（秒），默认 12' },
      },
      output: { schema: resultSchema, render: renderResult },
      async execute(args, exec) {
        const a = args as { prompt: string; imageUrls?: string[]; aspectRatio?: string; duration?: number }
        return runGeneration(registry, 'video_composite', {
          prompt: a.prompt,
          ...(a.imageUrls !== undefined ? { imageUrls: a.imageUrls } : {}),
          ...(a.aspectRatio !== undefined ? { aspectRatio: a.aspectRatio } : {}),
          ...(a.duration !== undefined ? { duration: a.duration } : {}),
        }, exec.signal, exec.agent?.session.header.cwd)
      },
    }),
  ]
}
