/**
 * Project + canvas viewing store: the registry snapshot, the current
 * selection, and the per-project canvas node list.
 *
 * Reads happen through the framework-bound `useStore`; writes go through the
 * declared actions only (async fetching lives in the apply-world inject
 * callbacks, which commit through these actions). The canvas node list is the
 * full P4+ model: every captured generation result (image/video) or manual
 * annotation (sticky/text/prompt) is a node, and bloodline edges are derived
 * from each node's `sourceIds` at render time (plan §7.3).
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import type { StudioCanvasNode, StudioCanvasNodeKind } from '../contracts/canvas.js'
import type { StudioCaptureAsset } from '../asset-capture.js'
import type { StudioProject } from '../contracts/project.js'

/** Default rendered box size per node kind (canvas-space pixels). */
const NODE_SIZE: Readonly<Record<StudioCanvasNodeKind, { width: number; height: number }>> = {
  image: { width: 260, height: 180 },
  video: { width: 260, height: 180 },
  sticky: { width: 220, height: 140 },
  text: { width: 220, height: 120 },
  prompt: { width: 240, height: 120 },
}

/** Auto-layout grid for freshly captured nodes. */
const LAYOUT = { origin: 40, stepX: 300, stepY: 240, columns: 4 }

/** Mint a node id in the browser (secure context over loopback). */
function newNodeId(): string {
  const cryptoObj = globalThis.crypto
  if (cryptoObj !== undefined && typeof cryptoObj.randomUUID === 'function') return cryptoObj.randomUUID()
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Project-list + canvas store state. */
export interface ProjectStoreState {
  projects: readonly StudioProject[]
  selectedProjectId: string | null
  selectedNodeId: string | null
  phase: 'idle' | 'loading' | 'error'
  error: string | null
  creating: boolean
  /** 每个项目的画布节点（按生成时间追加）。 */
  nodes: Readonly<Record<string, readonly StudioCanvasNode[]>>
}

/** Annotation twin of the actions literal below. */
export type ProjectStoreActions = {
  setPhase: (draft: ProjectStoreState, phase: ProjectStoreState['phase']) => void
  setLoaded: (draft: ProjectStoreState, projects: readonly StudioProject[]) => void
  setFailed: (draft: ProjectStoreState, error: string) => void
  select: (draft: ProjectStoreState, projectId: string | null) => void
  setCreating: (draft: ProjectStoreState, creating: boolean) => void
  /** 打开项目时载入持久化节点。 */
  setNodes: (draft: ProjectStoreState, projectId: string, nodes: readonly StudioCanvasNode[]) => void
  /** 捕获一条 agent 资产 → 自动布局 + 血缘链接后写入节点列表。 */
  addAsset: (draft: ProjectStoreState, projectId: string, asset: StudioCaptureAsset) => void
  /** 拖拽 / 手动移动节点。 */
  moveNode: (draft: ProjectStoreState, projectId: string, id: string, x: number, y: number) => void
  /** 选中节点（null 取消选中）。 */
  selectNode: (draft: ProjectStoreState, id: string | null) => void
  /** 删除节点并清理指向它的血缘。 */
  removeNode: (draft: ProjectStoreState, projectId: string, id: string) => void
  /** 清空某项目的画布（清掉内存态；持久化由调用方负责）。 */
  clearProject: (draft: ProjectStoreState, projectId: string) => void
}

/** 取某项目的全部节点（未绑定或空时返回空数组）。 */
export function nodesOf(state: ProjectStoreState, projectId: string | null): readonly StudioCanvasNode[] {
  if (projectId === null) return []
  return state.nodes[projectId] ?? []
}

/** 取某项目最新的画布节点（用于回看 / 默认聚焦）；缺失时返回 null。 */
export function lastNodeOf(state: ProjectStoreState, projectId: string | null): StudioCanvasNode | null {
  const list = nodesOf(state, projectId)
  return list.length === 0 ? null : list[list.length - 1]!
}

/** 取当前选中的节点。 */
export function selectedNodeOf(state: ProjectStoreState): StudioCanvasNode | null {
  if (state.selectedNodeId === null || state.selectedProjectId === null) return null
  return nodesOf(state, state.selectedProjectId).find(node => node.id === state.selectedNodeId) ?? null
}

/**
 * Create the project + canvas store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createProjectStore(): EngineStoreHandle<ProjectStoreState, ProjectStoreActions> {
  return defineStore({
    init: (): ProjectStoreState => ({
      projects: [],
      selectedProjectId: null,
      selectedNodeId: null,
      phase: 'idle',
      error: null,
      creating: false,
      nodes: {},
    }),
    actions: {
      setPhase: (draft, phase) => { draft.phase = phase },
      setLoaded: (draft, projects) => {
        draft.projects = projects
        draft.phase = 'idle'
        draft.error = null
        if (draft.selectedProjectId !== null && !projects.some(project => project.id === draft.selectedProjectId)) {
          draft.selectedProjectId = null
          draft.selectedNodeId = null
        }
      },
      setFailed: (draft, error) => {
        draft.phase = 'error'
        draft.error = error
      },
      select: (draft, projectId) => {
        draft.selectedProjectId = projectId
        draft.selectedNodeId = null
      },
      setCreating: (draft, creating) => { draft.creating = creating },
      setNodes: (draft, projectId, nodes) => {
        draft.nodes = { ...draft.nodes, [projectId]: [...nodes] }
      },
      addAsset: (draft, projectId, asset) => {
        const existing = draft.nodes[projectId] ?? []
        // 同一 URL 不重复追加（compaction 重放可能再次触发捕获）。
        if (existing.some(candidate => candidate.url === asset.url)) return
        // 血缘：参考图 URL 命中已有节点 → 链接 sourceIds。
        const sourceIds: string[] = []
        if (asset.sourceUrl !== undefined) {
          const source = existing.find(candidate => candidate.url === asset.sourceUrl)
          if (source !== undefined) sourceIds.push(source.id)
        }
        const index = existing.length
        const size = NODE_SIZE[asset.kind]
        const node: StudioCanvasNode = {
          id: newNodeId(),
          kind: asset.kind,
          url: asset.url,
          x: LAYOUT.origin + (index % LAYOUT.columns) * LAYOUT.stepX,
          y: LAYOUT.origin + Math.floor(index / LAYOUT.columns) * LAYOUT.stepY,
          width: size.width,
          height: size.height,
          createdAt: asset.createdAt,
          toolName: asset.toolName,
          runId: asset.runId,
          origin: 'agent',
          sourceIds,
        }
        draft.nodes = { ...draft.nodes, [projectId]: [...existing, node] }
      },
      moveNode: (draft, projectId, id, x, y) => {
        const existing = draft.nodes[projectId]
        if (existing === undefined) return
        draft.nodes = {
          ...draft.nodes,
          [projectId]: existing.map(node => (node.id === id ? { ...node, x, y } : node)),
        }
      },
      selectNode: (draft, id) => { draft.selectedNodeId = id },
      removeNode: (draft, projectId, id) => {
        const existing = draft.nodes[projectId]
        if (existing === undefined) return
        draft.nodes = {
          ...draft.nodes,
          [projectId]: existing
            .filter(node => node.id !== id)
            .map(node => (node.sourceIds.includes(id)
              ? { ...node, sourceIds: node.sourceIds.filter(sourceId => sourceId !== id) }
              : node)),
        }
        if (draft.selectedNodeId === id) draft.selectedNodeId = null
      },
      clearProject: (draft, projectId) => {
        draft.nodes = { ...draft.nodes, [projectId]: [] }
        if (draft.selectedNodeId !== null) draft.selectedNodeId = null
      },
    },
  })
}
