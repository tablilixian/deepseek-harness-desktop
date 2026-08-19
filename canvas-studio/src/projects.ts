/**
 * Canvas Studio project registry: durable project records under
 * `$DSH_HOME/canvas-studio/` with one on-disk directory per project.
 * The registry file is replaced atomically (`@deepseek-ai/dsh-atomic-write`),
 * so a crash never leaves a half-written registry behind.
 */
import { randomUUID } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import type { StudioProject } from './contracts/project.js'

/** Registry file format version; bump with a migration when the shape changes. */
const REGISTRY_VERSION = 1

/** On-disk registry document. */
interface ProjectRegistryDocument {
  version: typeof REGISTRY_VERSION
  projects: StudioProject[]
}

/** Maximum project name length (characters). */
const MAX_NAME_LENGTH = 80

/**
 * Reject names that cannot round-trip through the registry or the filesystem.
 * @param name - trimmed candidate project name.
 * @throws when the name is empty, too long, or carries control/path characters.
 */
export function validateProjectName(name: string): void {
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
    throw new Error('项目名不能为空且不能超过 80 个字符')
  }
  if (/[\u0000-\u001f\u007f/\\]/u.test(name)) {
    throw new Error('项目名不能包含控制字符或路径分隔符')
  }
}

/** ISO 8601 timestamp for registry records. */
function nowIso(): string {
  return new Date().toISOString()
}

/**
 * The project registry owner. Lazily loads the registry document once per
 * process and keeps an in-memory copy so list/create never re-reads the
 * registry for every request.
 */
export class ProjectRegistry {
  private readonly projectsDir: string
  private readonly file: string
  private cached: StudioProject[] | null = null

  /**
   * @param root - registry root directory; defaults to `$DSH_HOME/canvas-studio`.
   */
  constructor(root: string = dshHomePath('canvas-studio')) {
    this.projectsDir = join(root, 'projects')
    this.file = join(root, 'projects.json')
  }

  /** The absolute path of one project's directory. */
  projectDir(projectId: string): string {
    return join(this.projectsDir, projectId)
  }

  /** The absolute path of one project's asset directory. */
  assetsDir(projectId: string): string {
    return join(this.projectDir(projectId), 'assets')
  }

  /**
   * List all registered projects in creation order.
   * @returns the durable project records.
   * @throws when the registry document exists but is unreadable or corrupt.
   */
  async list(): Promise<readonly StudioProject[]> {
    if (this.cached === null) {
      this.cached = await this.readRegistry()
    }
    return this.cached
  }

  /**
   * Create a project: mint its directory (with `assets/`), append the record
   * to the registry, and persist the registry atomically.
   * @param name - display name (trimmed and validated).
   * @returns the created project record.
   */
  async create(name: string): Promise<StudioProject> {
    const trimmed = name.trim()
    validateProjectName(trimmed)
    const projects = [...await this.list()]
    const id = randomUUID()
    const project: StudioProject = {
      id,
      name: trimmed,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      dir: this.projectDir(id),
    }
    await mkdir(this.assetsDir(id), { recursive: true, mode: 0o700 })
    projects.push(project)
    await this.writeRegistry(projects)
    this.cached = projects
    return project
  }

  private async readRegistry(): Promise<StudioProject[]> {
    let text: string
    try {
      text = await readFile(this.file, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
    let document: unknown
    try {
      document = JSON.parse(text) as unknown
    } catch {
      throw new Error(`canvas-studio: registry file is corrupt: ${this.file}`)
    }
    if (
      document === null
      || typeof document !== 'object'
      || Array.isArray(document)
      || (document as { version?: unknown }).version !== REGISTRY_VERSION
      || !Array.isArray((document as { projects?: unknown }).projects)
    ) {
      throw new Error(`canvas-studio: registry file is not a project registry: ${this.file}`)
    }
    const projects = (document as ProjectRegistryDocument).projects
    for (const entry of projects) {
      if (!isProjectRecord(entry)) {
        throw new Error(`canvas-studio: registry file contains an invalid project record: ${this.file}`)
      }
    }
    return projects
  }

  private async writeRegistry(projects: readonly StudioProject[]): Promise<void> {
    const document: ProjectRegistryDocument = { version: REGISTRY_VERSION, projects: [...projects] }
    await writeFileAtomic(this.file, `${JSON.stringify(document, null, 2)}\n`, {
      mode: 0o600,
      dirMode: 0o700,
    })
  }
}

/** Narrow check of one registry entry against the wire shape. */
function isProjectRecord(value: unknown): value is StudioProject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string'
    && record.id.length > 0
    && typeof record.name === 'string'
    && typeof record.createdAt === 'string'
    && typeof record.updatedAt === 'string'
    && typeof record.dir === 'string'
}