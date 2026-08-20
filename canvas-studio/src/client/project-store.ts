/**
 * Project + canvas store: the registry snapshot, the current selection
 * (single + multi), per-project canvas node lists, snapshot history
 * (undo/redo), and the clipboard.
 *
 * Reads happen through the framework-bound `useStore`; writes go through the
 * declared actions only (async fetching lives in the apply-world inject
 * callbacks, which commit through these actions). The canvas node list is the
 * full P4+ model: every captured generation result (image/video) or manual
 * annotation (sticky/text/prompt/group) is a node, and bloodline edges are
 * derived from each node's `sourceIds` at render time (plan §7.3).
 *
 * History semantics follow the reference canvas store (snapshot the pre-mutation
 * list, cap 20): atomic actions snapshot first, while drags call `pushHistory`
 * explicitly at drag start (moveNode itself never snapshots — it fires every
 * pointer-move frame). Transient generation state (isLoading/progress/error)
 * lives on client-minted pending nodes and is stripped on reload.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import type { StudioCanvasNode, StudioCanvasNodeKind } from '../contracts/canvas.js'
import type { StudioCaptureAsset } from '../asset-capture.js'
import type { StudioProject } from '../contracts/project.js'

/** Snapshot-history cap (reference: MAX_HISTORY = 20). */
const MAX_HISTORY = 20

/** Default rendered box size per node kind (canvas-space pixels). */
const NODE_SIZE: Readonly<Record<StudioCanvasNodeKind, { width: number; height: number }>> = {
  image: { width: 260, height: 180 },
  video: { width: 260, height: 180 },
  sticky: { width: 220, height: 140 },
  text: { width: 220, height: 120 },
  prompt: { width: 240, height: 120 },
  group: { width: 320, height: 220 },
}

/** Auto-layout grid for freshly captured nodes. */
const LAYOUT = { origin: 40, stepX: 300, stepY: 240, columns: 4 }

/** Default titles for manually added annotation nodes. */
const NODE_TITLES: Readonly<Record<'sticky' | 'text' | 'prompt', string>> = {
  sticky: '便签',
  text: '文本',
  prompt: '提示',
}

/** Mint a node id in the browser (secure context over loopback). */
export function newNodeId(): string {
  const cryptoObj = globalThis.crypto
  if (cryptoObj !== undefined && typeof cryptoObj.randomUUID === 'function') return cryptoObj.randomUUID()
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** One undo/redo history entry: a full node-list snapshot of one project. */
export interface HistoryEntry {
  projectId: string
  nodes: readonly StudioCanvasNode[]
}

/** Project-list + canvas store state. */
export interface ProjectStoreState {
  projects: readonly StudioProject[]
  selectedProjectId: string | null
  selectedNodeId: string | null
  /** Multi-select roster (contains selectedNodeId when non-null). */
  selectedNodeIds: string[]
  phase: 'idle' | 'loading' | 'error'
  error: string | null
  creating: boolean
  /** 每个项目的画布节点（按生成时间追加）。 */
  nodes: Readonly<Record<string, readonly StudioCanvasNode[]>>
  /** Undo/redo snapshot history (global, entries carry their project). */
  history: HistoryEntry[]
  historyIndex: number
  /** Client-side clipboard (copy/paste). */
  clipboard: StudioCanvasNode[]
}

/** Annotation twin of the actions literal below. */
export type ProjectStoreActions = {
  setPhase: (draft: ProjectStoreState, phase: ProjectStoreState['phase']) => void
  setLoaded: (draft: ProjectStoreState, projects: readonly StudioProject[]) => void
  setFailed: (draft: ProjectStoreState, error: string) => void
  select: (draft: ProjectStoreState, projectId: string | null) => void
  setCreating: (draft: ProjectStoreState, creating: boolean) => void
  /** 打开项目时载入持久化节点（剥离瞬态状态）。 */
  setNodes: (draft: ProjectStoreState, projectId: string, nodes: readonly StudioCanvasNode[]) => void
  /** 捕获一条 agent 资产 → 自动布局 + 血缘链接后写入节点列表。 */
  addAsset: (draft: ProjectStoreState, projectId: string, asset: StudioCaptureAsset) => void
  /** 选中节点（ctrl/cmd 追加多选；null 清空）。 */
  selectNode: (draft: ProjectStoreState, id: string | null, multi?: boolean) => void
  /** 全选当前项目节点。 */
  selectAllNodes: (draft: ProjectStoreState) => void
  /** 移动节点（拖拽逐帧调用；不写历史）。group 节点联动子图层。 */
  moveNode: (draft: ProjectStoreState, projectId: string, id: string, x: number, y: number) => void
  /** 增量更新节点字段（拖拽 resize 逐帧；不写历史）。 */
  updateNode: (draft: ProjectStoreState, projectId: string, id: string, updates: Partial<StudioCanvasNode>) => void
  /** 删除节点并清理指向它的血缘（写历史）。 */
  removeNodes: (draft: ProjectStoreState, projectId: string, ids: string[]) => void
  /** 快照当前项目节点列表进历史（拖拽/缩放开始时调用）。 */
  pushHistory: (draft: ProjectStoreState, projectId: string) => void
  undo: (draft: ProjectStoreState) => void
  redo: (draft: ProjectStoreState) => void
  /** 复制选中节点到剪贴板。 */
  copySelected: (draft: ProjectStoreState, projectId: string) => void
  /** 粘贴剪贴板节点（偏移 +20，新 id，写历史）。 */
  pasteNodes: (draft: ProjectStoreState, projectId: string) => void
  /** z 序操作（zIndex 字段语义，写历史）。 */
  reorderNode: (draft: ProjectStoreState, projectId: string, id: string, direction: 'front' | 'back' | 'forward' | 'backward') => void
  toggleLock: (draft: ProjectStoreState, projectId: string, id: string) => void
  setVisibility: (draft: ProjectStoreState, projectId: string, id: string, visible: boolean) => void
  setOpacity: (draft: ProjectStoreState, projectId: string, id: string, opacity: number) => void
  renameNode: (draft: ProjectStoreState, projectId: string, id: string, title: string) => void
  /** 手动连线：给目标节点追加 sourceIds（写历史）。 */
  linkLayers: (draft: ProjectStoreState, projectId: string, sourceIds: string[], targetId: string) => void
  /** 编组：创建 group 节点包裹选中节点（写历史）。 */
  groupSelected: (draft: ProjectStoreState, projectId: string) => void
  /** 解组：移除 group 节点并释放子节点 parentId（写历史）。 */
  ungroup: (draft: ProjectStoreState, projectId: string, groupId: string) => void
  /** 对齐（union 边界：左/中/右/上/中/下，写历史）。 */
  alignNodes: (draft: ProjectStoreState, projectId: string, ids: string[], alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void
  /** 分布（水平/垂直等距，写历史）。 */
  distributeNodes: (draft: ProjectStoreState, projectId: string, ids: string[], direction: 'horizontal' | 'vertical') => void
  /** 按血缘深度一键整理布局（写历史）。 */
  autoArrange: (draft: ProjectStoreState, projectId: string) => void
  /** 生成中的占位节点（client 侧瞬态）。 */
  setPendingNode: (draft: ProjectStoreState, projectId: string, node: StudioCanvasNode) => void
  /** 手动新增一个便签/文本/提示节点（写历史）。 */
  addNode: (draft: ProjectStoreState, projectId: string, kind: 'sticky' | 'text' | 'prompt') => void
  /** 移除 runId 匹配的占位节点（重载/完成时）。 */
  removePendingByRunId: (draft: ProjectStoreState, projectId: string, runId: string) => void
  /** 占位节点标记失败（tool/result 的 data.error）。 */
  markPendingError: (draft: ProjectStoreState, projectId: string, runId: string, error: string) => void
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

/** 取当前多选节点列表（按 zIndex+createdAt 排序）。 */
export function selectedNodesOf(state: ProjectStoreState): StudioCanvasNode[] {
  if (state.selectedProjectId === null || state.selectedNodeIds.length === 0) return []
  const byId = new Map(nodesOf(state, state.selectedProjectId).map(node => [node.id, node]))
  return state.selectedNodeIds
    .map(id => byId.get(id))
    .filter((node): node is StudioCanvasNode => node !== undefined)
    .sort(compareNodes)
}

/** 渲染序：zIndex 升序，同层按 createdAt 稳定。 */
export function compareNodes(left: StudioCanvasNode, right: StudioCanvasNode): number {
  const leftZ = left.zIndex ?? 0
  const rightZ = right.zIndex ?? 0
  if (leftZ !== rightZ) return leftZ - rightZ
  return left.createdAt - right.createdAt
}

/** 节点的直接子图层（parentId === id）。 */
export function childrenOf(nodes: readonly StudioCanvasNode[], id: string): StudioCanvasNode[] {
  return nodes.filter(node => node.parentId === id)
}

/** 从节点列表里找 union 边界（空表返回 null）。 */
export function boundsOf(nodes: readonly StudioCanvasNode[]): { x: number; y: number; width: number; height: number } | null {
  if (nodes.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of nodes) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + node.width)
    maxY = Math.max(maxY, node.y + node.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** 血缘深度（sourceIds/parentId 链长），用于自动布局分层。 */
function depthOf(byId: Map<string, StudioCanvasNode>, node: StudioCanvasNode, seen: Set<string>): number {
  if (seen.has(node.id)) return 0
  seen.add(node.id)
  const parents = [...node.sourceIds, ...(node.parentId !== undefined ? [node.parentId] : [])]
  let maxDepth = 0
  for (const parentId of parents) {
    const parent = byId.get(parentId)
    if (parent === undefined) continue
    maxDepth = Math.max(maxDepth, depthOf(byId, parent, seen) + 1)
  }
  return maxDepth
}

/** 简化版血缘自动布局：按深度分层，每层横向排布（reference autoLayout 的树语义降级版）。 */
function layoutByDepth(nodes: readonly StudioCanvasNode[]): Map<string, { x: number; y: number }> {
  const byId = new Map(nodes.map(node => [node.id, node]))
  const depths = new Map<string, number>()
  for (const node of nodes) depths.set(node.id, depthOf(byId, node, new Set()))
  const maxDepth = Math.max(0, ...depths.values())
  const column = new Map<number, number>()
  const positions = new Map<string, { x: number; y: number }>()
  for (const node of [...nodes].sort(compareNodes)) {
    const depth = depths.get(node.id) ?? 0
    const index = column.get(depth) ?? 0
    column.set(depth, index + 1)
    positions.set(node.id, {
      x: LAYOUT.origin + index * LAYOUT.stepX,
      y: LAYOUT.origin + depth * (LAYOUT.stepY + 60) + (maxDepth - depth) * 0,
    })
  }
  return positions
}

/** 快照当前节点列表进历史（内部实现：先截断 redo 尾部，再压入）。 */
function snapshotHistory(
  history: HistoryEntry[],
  historyIndex: number,
  projectId: string,
  nodes: readonly StudioCanvasNode[],
): { history: HistoryEntry[]; historyIndex: number } {
  const trimmed = history.slice(0, historyIndex + 1)
  trimmed.push({ projectId, nodes: [...nodes] })
  return {
    history: trimmed.slice(-MAX_HISTORY),
    historyIndex: Math.min(trimmed.length - 1, MAX_HISTORY - 1),
  }
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
      selectedNodeIds: [],
      phase: 'idle',
      error: null,
      creating: false,
      nodes: {},
      history: [],
      historyIndex: -1,
      clipboard: [],
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
          draft.selectedNodeIds = []
        }
      },
      setFailed: (draft, error) => {
        draft.phase = 'error'
        draft.error = error
      },
      select: (draft, projectId) => {
        draft.selectedProjectId = projectId
        draft.selectedNodeId = null
        draft.selectedNodeIds = []
      },
      setCreating: (draft, creating) => { draft.creating = creating },
      setNodes: (draft, projectId, nodes) => {
        // 剥离瞬态生成态：持久化节点不带 isLoading/progress/error。
        const clean = nodes.map(node => {
          const { isLoading: _isLoading, progress: _progress, error: _error, ...rest } = node
          return rest as StudioCanvasNode
        })
        draft.nodes = { ...draft.nodes, [projectId]: clean }
      },
      addAsset: (draft, projectId, asset) => {
        const existing = draft.nodes[projectId] ?? []
        if (existing.some(candidate => candidate.url === asset.url)) return
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
      selectNode: (draft, id, multi = false) => {
        if (multi && id !== null) {
          const roster = new Set(draft.selectedNodeIds)
          if (roster.has(id)) roster.delete(id)
          else roster.add(id)
          draft.selectedNodeIds = [...roster]
          draft.selectedNodeId = roster.size === 1 ? id : null
        } else {
          draft.selectedNodeIds = id === null ? [] : [id]
          draft.selectedNodeId = id
        }
      },
      selectAllNodes: (draft) => {
        if (draft.selectedProjectId === null) return
        const ids = nodesOf(draft, draft.selectedProjectId).map(node => node.id)
        draft.selectedNodeIds = ids
        draft.selectedNodeId = ids.length === 1 ? ids[0]! : null
      },
      moveNode: (draft, projectId, id, x, y) => {
        const existing = draft.nodes[projectId]
        if (existing === undefined) return
        const node = existing.find(candidate => candidate.id === id)
        if (node === undefined) return
        const deltaX = x - node.x
        const deltaY = y - node.y
        draft.nodes = {
          ...draft.nodes,
          [projectId]: existing.map(candidate =>
            candidate.id === id
              ? { ...candidate, x, y }
              : candidate.parentId === id
                ? { ...candidate, x: candidate.x + deltaX, y: candidate.y + deltaY }
                : candidate,
          ),
        }
      },
      updateNode: (draft, projectId, id, updates) => {
        const existing = draft.nodes[projectId]
        if (existing === undefined) return
        draft.nodes = {
          ...draft.nodes,
          [projectId]: existing.map(node => (node.id === id ? { ...node, ...updates } : node)),
        }
      },
      removeNodes: (draft, projectId, ids) => {
        const existing = draft.nodes[projectId]
        if (existing === undefined || ids.length === 0) return
        const removed = new Set(ids)
        const history = snapshotHistory(draft.history, draft.historyIndex, projectId, existing)
        draft.history = history.history
        draft.historyIndex = history.historyIndex
        draft.nodes = {
          ...draft.nodes,
          [projectId]: existing
            .filter(node => !removed.has(node.id))
            .map(node => {
              const survivors = { ...node, sourceIds: node.sourceIds.filter(sourceId => !removed.has(sourceId)) }
              if (node.parentId !== undefined && removed.has(node.parentId)) {
                const { parentId: _staleParent, ...rest } = survivors
                return rest
              }
              return survivors
            }),
        }
        draft.selectedNodeIds = draft.selectedNodeIds.filter(id => !removed.has(id))
        if (draft.selectedNodeId !== null && removed.has(draft.selectedNodeId)) {
          draft.selectedNodeId = draft.selectedNodeIds.length === 1 ? draft.selectedNodeIds[0]! : null
        }
      },
      pushHistory: (draft, projectId) => {
        const existing = draft.nodes[projectId]
        if (existing === undefined) return
        const history = snapshotHistory(draft.history, draft.historyIndex, projectId, existing)
        draft.history = history.history
        draft.historyIndex = history.historyIndex
      },
      undo: (draft) => {
        if (draft.historyIndex < 0 || draft.historyIndex >= draft.history.length) return
        const entry = draft.history[draft.historyIndex]!
        draft.nodes = { ...draft.nodes, [entry.projectId]: [...entry.nodes] }
        draft.historyIndex -= 1
        draft.selectedNodeId = null
        draft.selectedNodeIds = []
      },
      redo: (draft) => {
        const nextIndex = draft.historyIndex + 1
        if (nextIndex >= draft.history.length) return
        const entry = draft.history[nextIndex]!
        draft.nodes = { ...draft.nodes, [entry.projectId]: [...entry.nodes] }
        draft.historyIndex = nextIndex
        draft.selectedNodeId = null
        draft.selectedNodeIds = []
      },
      copySelected: (draft, projectId) => {
        const byId = new Map(nodesOf(draft, projectId).map(node => [node.id, node]))
        draft.clipboard = draft.selectedNodeIds
          .map(id => byId.get(id))
          .filter((node): node is StudioCanvasNode => node !== undefined)
      },
      pasteNodes: (draft, projectId) => {
        const existing = draft.nodes[projectId]
        if (existing === undefined || draft.clipboard.length === 0) return
        const history = snapshotHistory(draft.history, draft.historyIndex, projectId, existing)
        draft.history = history.history
        draft.historyIndex = history.historyIndex
        const idMap = new Map<string, string>()
        const pasted: StudioCanvasNode[] = draft.clipboard.map(node => {
          const newId = newNodeId()
          idMap.set(node.id, newId)
          return { ...node, id: newId, x: node.x + 20, y: node.y + 20, createdAt: Date.now() }
        })
        draft.nodes = {
          ...draft.nodes,
          [projectId]: [
            ...existing,
            ...pasted.map(node => ({
              ...node,
              sourceIds: node.sourceIds.map(sourceId => idMap.get(sourceId) ?? sourceId),
              ...(node.parentId !== undefined ? { parentId: idMap.get(node.parentId) ?? node.parentId } : {}),
            })),
          ],
        }
        draft.selectedNodeIds = pasted.map(node => node.id)
        draft.selectedNodeId = pasted.length === 1 ? pasted[0]!.id : null
      },
      reorderNode: (draft, projectId, id, direction) => {
        const existing = draft.nodes[projectId]
        if (existing === undefined) return
        const node = existing.find(candidate => candidate.id === id)
        if (node === undefined) return
        const sorted = [...existing].sort(compareNodes)
        const index = sorted.findIndex(candidate => candidate.id === id)
        if (index === -1) return
        const history = snapshotHistory(draft.history, draft.historyIndex, projectId, existing)
        draft.history = history.history
        draft.historyIndex = history.historyIndex
        const currentZ = node.zIndex ?? 0
        let targetZ = currentZ
        if (direction === 'front') {
          const maxZ = Math.max(0, ...existing.map(candidate => candidate.zIndex ?? 0))
          targetZ = maxZ + 1
        } else if (direction === 'back') {
          const minZ = Math.min(0, ...existing.map(candidate => candidate.zIndex ?? 0))
          targetZ = minZ - 1
        } else if (direction === 'forward') {
          const next = sorted[index + 1]
          if (next !== undefined) targetZ = (next.zIndex ?? 0) + 1
        } else if (direction === 'backward') {
          const previous = sorted[index - 1]
          if (previous !== undefined) targetZ = (previous.zIndex ?? 0) - 1
        }
        draft.nodes = {
          ...draft.nodes,
          [projectId]: existing.map(candidate =>
            candidate.id === id ? { ...candidate, zIndex: targetZ } : candidate),
        }
      },
      toggleLock: (draft, projectId, id) => {
        const existing = draft.nodes[projectId]
        if (existing === undefined) return
        const history = snapshotHistory(draft.history, draft.historyIndex, projectId, existing)
        draft.history = history.history
        draft.historyIndex = history.historyIndex
        draft.nodes = {
          ...draft.nodes,
          [projectId]: existing.map(node =>
            node.id === id ? { ...node, locked: !node.locked } : node),
        }
      },
      setVisibility: (draft, projectId, id, visible) => {
        const existing = draft.nodes[projectId]
        if (existing === undefined) return
        const history = snapshotHistory(draft.history, draft.historyIndex, projectId, existing)
        draft.history = history.history
        draft.historyIndex = history.historyIndex
        draft.nodes = {
          ...draft.nodes,
          [projectId]: existing.map(node =>
            node.id === id ? { ...node, visible } : node),
        }
      },
      setOpacity: (draft, projectId, id, opacity) => {
        const existing = draft.nodes[projectId]
        if (existing === undefined) return
        const history = snapshotHistory(draft.history, draft.historyIndex, projectId, existing)
        draft.history = history.history
        draft.historyIndex = history.historyIndex
        const clamped = Math.min(1, Math.max(0, opacity))
        draft.nodes = {
          ...draft.nodes,
          [projectId]: existing.map(node =>
            node.id === id ? { ...node, opacity: clamped } : node),
        }
      },
      renameNode: (draft, projectId, id, title) => {
        const existing = draft.nodes[projectId]
        if (existing === undefined) return
        const history = snapshotHistory(draft.history, draft.historyIndex, projectId, existing)
        draft.history = history.history
        draft.historyIndex = history.historyIndex
        const nextTitle = title.trim()
        if (nextTitle.length === 0) return
        draft.nodes = {
          ...draft.nodes,
          [projectId]: existing.map(node =>
            node.id === id ? { ...node, title: nextTitle } : node),
        }
      },
      linkLayers: (draft, projectId, sourceIds, targetId) => {
        const existing = draft.nodes[projectId]
        if (existing === undefined || sourceIds.length === 0) return
        const history = snapshotHistory(draft.history, draft.historyIndex, projectId, existing)
        draft.history = history.history
        draft.historyIndex = history.historyIndex
        draft.nodes = {
          ...draft.nodes,
          [projectId]: existing.map(node => {
            if (node.id !== targetId) return node
            const merged = [...node.sourceIds]
            for (const sourceId of sourceIds) {
              if (sourceId !== targetId && !merged.includes(sourceId)) merged.push(sourceId)
            }
            return { ...node, sourceIds: merged }
          }),
        }
      },
      groupSelected: (draft, projectId) => {
        const existing = draft.nodes[projectId]
        if (existing === undefined || draft.selectedNodeIds.length < 2) return
        const history = snapshotHistory(draft.history, draft.historyIndex, projectId, existing)
        draft.history = history.history
        draft.historyIndex = history.historyIndex
        const byId = new Map(existing.map(node => [node.id, node]))
        const members = draft.selectedNodeIds
          .map(id => byId.get(id))
          .filter((node): node is StudioCanvasNode => node !== undefined)
        const bounds = boundsOf(members)
        if (bounds === null) return
        const group: StudioCanvasNode = {
          id: newNodeId(),
          kind: 'group',
          title: '分组',
          x: bounds.x - 12,
          y: bounds.y - 12,
          width: bounds.width + 24,
          height: bounds.height + 24,
          createdAt: Date.now(),
          origin: 'manual',
          sourceIds: [],
          zIndex: Math.min(...members.map(node => node.zIndex ?? 0)) - 1,
        }
        const memberIds = new Set(members.map(node => node.id))
        draft.nodes = {
          ...draft.nodes,
          [projectId]: [
            ...existing.map(node =>
              memberIds.has(node.id) ? { ...node, parentId: group.id } : node),
            group,
          ],
        }
        draft.selectedNodeIds = [group.id]
        draft.selectedNodeId = group.id
      },
      ungroup: (draft, projectId, groupId) => {
        const existing = draft.nodes[projectId]
        if (existing === undefined) return
        const history = snapshotHistory(draft.history, draft.historyIndex, projectId, existing)
        draft.history = history.history
        draft.historyIndex = history.historyIndex
        draft.nodes = {
          ...draft.nodes,
          [projectId]: existing
            .filter(node => node.id !== groupId)
            .map(node => {
              if (node.parentId !== groupId) return node
              const { parentId: _staleParent, ...rest } = node
              return rest
            }),
        }
        draft.selectedNodeIds = draft.selectedNodeIds.filter(id => id !== groupId)
        if (draft.selectedNodeId === groupId) draft.selectedNodeId = null
      },
      alignNodes: (draft, projectId, ids, alignment) => {
        const existing = draft.nodes[projectId]
        if (existing === undefined || ids.length < 2) return
        const byId = new Map(existing.map(node => [node.id, node]))
        const members = ids
          .map(id => byId.get(id))
          .filter((node): node is StudioCanvasNode => node !== undefined)
        const bounds = boundsOf(members)
        if (bounds === null) return
        const history = snapshotHistory(draft.history, draft.historyIndex, projectId, existing)
        draft.history = history.history
        draft.historyIndex = history.historyIndex
        const updates = new Map<string, { x?: number; y?: number }>()
        for (const node of members) {
          let x = node.x
          let y = node.y
          if (alignment === 'left') x = bounds.x
          else if (alignment === 'center') x = bounds.x + (bounds.width - node.width) / 2
          else if (alignment === 'right') x = bounds.x + bounds.width - node.width
          else if (alignment === 'top') y = bounds.y
          else if (alignment === 'middle') y = bounds.y + (bounds.height - node.height) / 2
          else if (alignment === 'bottom') y = bounds.y + bounds.height - node.height
          updates.set(node.id, { x, y })
        }
        draft.nodes = {
          ...draft.nodes,
          [projectId]: existing.map(node => {
            const update = updates.get(node.id)
            return update === undefined ? node : { ...node, ...update }
          }),
        }
      },
      distributeNodes: (draft, projectId, ids, direction) => {
        const existing = draft.nodes[projectId]
        if (existing === undefined || ids.length < 3) return
        const byId = new Map(existing.map(node => [node.id, node]))
        const members = ids
          .map(id => byId.get(id))
          .filter((node): node is StudioCanvasNode => node !== undefined)
        const sorted = direction === 'horizontal'
          ? [...members].sort((left, right) => left.x - right.x)
          : [...members].sort((left, right) => left.y - right.y)
        if (sorted.length < 3) return
        const first = sorted[0]!
        const last = sorted[sorted.length - 1]!
        const span = direction === 'horizontal'
          ? (last.x + last.width) - first.x
          : (last.y + last.height) - first.y
        const gap = span / (sorted.length - 1)
        const history = snapshotHistory(draft.history, draft.historyIndex, projectId, existing)
        draft.history = history.history
        draft.historyIndex = history.historyIndex
        const updates = new Map<string, { x?: number; y?: number }>()
        sorted.forEach((node, index) => {
          const offset = direction === 'horizontal'
            ? first.x + gap * index
            : first.y + gap * index
          updates.set(node.id, direction === 'horizontal' ? { x: offset } : { y: offset })
        })
        draft.nodes = {
          ...draft.nodes,
          [projectId]: existing.map(node => {
            const update = updates.get(node.id)
            return update === undefined ? node : { ...node, ...update }
          }),
        }
      },
      autoArrange: (draft, projectId) => {
        const existing = draft.nodes[projectId]
        if (existing === undefined || existing.length === 0) return
        const history = snapshotHistory(draft.history, draft.historyIndex, projectId, existing)
        draft.history = history.history
        draft.historyIndex = history.historyIndex
        const positions = layoutByDepth(existing)
        draft.nodes = {
          ...draft.nodes,
          [projectId]: existing.map(node => {
            const position = positions.get(node.id)
            return position === undefined ? node : { ...node, x: position.x, y: position.y }
          }),
        }
      },
      setPendingNode: (draft, projectId, node) => {
        const existing = draft.nodes[projectId] ?? []
        if (existing.some(candidate => candidate.runId === node.runId && candidate.isLoading)) return
        draft.nodes = { ...draft.nodes, [projectId]: [...existing, node] }
      },
      addNode: (draft, projectId, kind) => {
        const existing = draft.nodes[projectId]
        if (existing === undefined) return
        const history = snapshotHistory(draft.history, draft.historyIndex, projectId, existing)
        draft.history = history.history
        draft.historyIndex = history.historyIndex
        const index = existing.length
        const size = NODE_SIZE[kind]
        const defaults: Partial<StudioCanvasNode> = kind === 'sticky'
          ? { text: '新便签' }
          : kind === 'text'
            ? { text: '新文本' }
            : { text: '新提示' }
        const node: StudioCanvasNode = {
          id: newNodeId(),
          kind,
          title: NODE_TITLES[kind],
          x: LAYOUT.origin + (index % LAYOUT.columns) * LAYOUT.stepX,
          y: LAYOUT.origin + Math.floor(index / LAYOUT.columns) * LAYOUT.stepY,
          width: size.width,
          height: size.height,
          createdAt: Date.now(),
          origin: 'manual',
          sourceIds: [],
          ...defaults,
        }
        draft.nodes = { ...draft.nodes, [projectId]: [...existing, node] }
        draft.selectedNodeIds = [node.id]
        draft.selectedNodeId = node.id
      },
      removePendingByRunId: (draft, projectId, runId) => {
        const existing = draft.nodes[projectId]
        if (existing === undefined) return
        const pending = existing.find(node => node.runId === runId && node.isLoading)
        if (pending === undefined) return
        draft.nodes = {
          ...draft.nodes,
          [projectId]: existing.filter(node => node.id !== pending.id),
        }
      },
      markPendingError: (draft, projectId, runId, error) => {
        const existing = draft.nodes[projectId]
        if (existing === undefined) return
        draft.nodes = {
          ...draft.nodes,
          [projectId]: existing.map(node =>
            node.runId === runId && node.isLoading
              ? { ...node, isLoading: false, error }
              : node),
        }
      },
      clearProject: (draft, projectId) => {
        draft.nodes = { ...draft.nodes, [projectId]: [] }
        draft.selectedNodeId = null
        draft.selectedNodeIds = []
      },
    },
  })
}