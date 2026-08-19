import type { StudioProject } from './contracts/project.js';
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
    private readRegistry;
    private writeRegistry;
}
