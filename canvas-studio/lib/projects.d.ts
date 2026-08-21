import type { StudioProject } from './contracts/project.js';
import type { StudioCanvasDocument, StudioCanvasNode, StudioCanvasView } from './contracts/canvas.js';
/**
 * Reject names that cannot round-trip through the registry or the filesystem.
 * @param name - trimmed candidate project name.
 * @throws when the name is empty, too long, or carries control/path characters.
 */
export declare function validateProjectName(name: string): void;
/**
 * The project registry owner. Lazily loads the registry document once per
 * process and keeps an in-memory copy so list/create never re-reads the
 * registry for every request.
 */
export declare class ProjectRegistry {
    private readonly projectsDir;
    private readonly file;
    private cached;
    /**
     * @param root - registry root directory; defaults to `$DSH_HOME/canvas-studio`.
     */
    constructor(root?: string);
    /** The absolute path of one project's directory. */
    projectDir(projectId: string): string;
    /** The absolute path of one project's asset directory. */
    assetsDir(projectId: string): string;
    /** The absolute path of one project's canvas document. */
    canvasFile(projectId: string): string;
    /**
     * Read a project's canvas document (nodes + persisted viewport). Returns an
     * empty node list and no view when the document is missing or corrupt (the
     * canvas is disposable UI state, never fatal).
     * @param projectId - target project id.
     */
    readCanvas(projectId: string): Promise<StudioCanvasDocument>;
    /**
     * Persist a project's canvas nodes (and viewport when provided) atomically
     * (a crash never leaves a half-written canvas document behind).
     * @param projectId - target project id.
     * @param nodes - the full node list for the project.
     * @param view - the client viewport/panel state; omitted by Host-authored
     *   writes, which preserve the previously saved view untouched.
     */
    writeCanvas(projectId: string, nodes: readonly StudioCanvasNode[], view?: StudioCanvasView): Promise<void>;
    /**
     * Append one generated-media node to a project's canvas document. The Host
     * writes this the moment an asset lands on disk, so the canvas reflects a
     * successful generation deterministically (the client reloads the document
     * on `tool/result`), independent of how the conversation event renders the
     * tool result text.
     * @param projectId - target project id.
     * @param node - the node to append (id must be unique within the project).
     */
    appendCanvasNode(projectId: string, node: StudioCanvasNode): Promise<void>;
    /**
     * List all registered projects in creation order.
     * @returns the durable project records.
     * @throws when the registry document exists but is unreadable or corrupt.
     */
    list(): Promise<readonly StudioProject[]>;
    /**
     * Create a project: mint its directory (with `assets/`), append the record
     * to the registry, and persist the registry atomically.
     * @param name - display name (trimmed and validated).
     * @returns the created project record.
     */
    create(name: string): Promise<StudioProject>;
    /**
     * Delete a project: remove its on-disk directory (registry, assets, canvas)
     * and drop the record. Refuses when the resolved directory is not safely
     * nested under the projects directory.
     * @param projectId - target project id.
     */
    removeProject(projectId: string): Promise<void>;
    private readRegistry;
    private writeRegistry;
}
