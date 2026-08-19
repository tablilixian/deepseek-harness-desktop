/**
 * Canvas Studio P3 媒体生成工具（客户端）。
 *
 * 三个工具把"对话"接到 Drama Backend 生成能力；实际生成与落盘发生在 Host
 * 侧（`/canvas-studio/generate` 路由）。工具通过闭包读取"当前激活项目"的 id。
 */
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { generateAsset, type GenerateResult } from './api.js'

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

export interface StudioToolsContext {
  /** 返回当前激活项目 id；无激活项目时返回 null。 */
  getActiveProjectId(): string | null
}

/**
 * 创建 P3 媒体生成工具集。
 * @param context - 提供当前激活项目 id 的读取器。
 * @returns 三个 `defineTool` 定义，供 `ctx.tools.register` 逐条注册。
 */
export function createStudioTools(context: StudioToolsContext) {
  const requireProject = (): string => {
    const id = context.getActiveProjectId()
    if (!id) throw new Error('请先在左侧打开或创建一个项目，再调用生成工具')
    return id
  }

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
      execute(args) {
        const a = args as { prompt: string; aspectRatio?: string; imageUrl?: string; negativePrompt?: string }
        return generateAsset(requireProject(), 'image_generate', {
          prompt: a.prompt,
          aspectRatio: a.aspectRatio,
          imageUrl: a.imageUrl,
          negativePrompt: a.negativePrompt,
        })
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
      execute(args) {
        const a = args as { prompt: string; imageUrl: string; aspectRatio?: string; duration?: number }
        return generateAsset(requireProject(), 'video_generate', {
          prompt: a.prompt,
          imageUrl: a.imageUrl,
          aspectRatio: a.aspectRatio,
          duration: a.duration,
        })
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
      execute(args) {
        const a = args as { prompt: string; imageUrls?: string[]; aspectRatio?: string; duration?: number }
        return generateAsset(requireProject(), 'video_composite', {
          prompt: a.prompt,
          imageUrls: a.imageUrls,
          aspectRatio: a.aspectRatio,
          duration: a.duration,
        })
      },
    }),
  ]
}
