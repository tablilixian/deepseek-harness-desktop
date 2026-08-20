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
import { type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client';
import type { StudioCanvasNode } from '../contracts/canvas.js';
import type { StudioCaptureAsset } from '../asset-capture.js';
import type { StudioProject } from '../contracts/project.js';
/** Project-list + canvas store state. */
export interface ProjectStoreState {
    projects: readonly StudioProject[];
    selectedProjectId: string | null;
    selectedNodeId: string | null;
    phase: 'idle' | 'loading' | 'error';
    error: string | null;
    creating: boolean;
    /** 每个项目的画布节点（按生成时间追加）。 */
    nodes: Readonly<Record<string, readonly StudioCanvasNode[]>>;
}
/** Annotation twin of the actions literal below. */
export type ProjectStoreActions = {
    setPhase: (draft: ProjectStoreState, phase: ProjectStoreState['phase']) => void;
    setLoaded: (draft: ProjectStoreState, projects: readonly StudioProject[]) => void;
    setFailed: (draft: ProjectStoreState, error: string) => void;
    select: (draft: ProjectStoreState, projectId: string | null) => void;
    setCreating: (draft: ProjectStoreState, creating: boolean) => void;
    /** 打开项目时载入持久化节点。 */
    setNodes: (draft: ProjectStoreState, projectId: string, nodes: readonly StudioCanvasNode[]) => void;
    /** 捕获一条 agent 资产 → 自动布局 + 血缘链接后写入节点列表。 */
    addAsset: (draft: ProjectStoreState, projectId: string, asset: StudioCaptureAsset) => void;
    /** 拖拽 / 手动移动节点。 */
    moveNode: (draft: ProjectStoreState, projectId: string, id: string, x: number, y: number) => void;
    /** 选中节点（null 取消选中）。 */
    selectNode: (draft: ProjectStoreState, id: string | null) => void;
    /** 删除节点并清理指向它的血缘。 */
    removeNode: (draft: ProjectStoreState, projectId: string, id: string) => void;
    /** 清空某项目的画布（清掉内存态；持久化由调用方负责）。 */
    clearProject: (draft: ProjectStoreState, projectId: string) => void;
};
/** 取某项目的全部节点（未绑定或空时返回空数组）。 */
export declare function nodesOf(state: ProjectStoreState, projectId: string | null): readonly StudioCanvasNode[];
/** 取某项目最新的画布节点（用于回看 / 默认聚焦）；缺失时返回 null。 */
export declare function lastNodeOf(state: ProjectStoreState, projectId: string | null): StudioCanvasNode | null;
/** 取当前选中的节点。 */
export declare function selectedNodeOf(state: ProjectStoreState): StudioCanvasNode | null;
/**
 * Create the project + canvas store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export declare function createProjectStore(): EngineStoreHandle<ProjectStoreState, ProjectStoreActions>;
