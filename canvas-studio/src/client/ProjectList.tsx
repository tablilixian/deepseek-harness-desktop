import { useState } from 'react'
import type { StudioProject } from '../contracts/project.js'

/** Plain props: the store projection plus plain callbacks. */
export interface ProjectListProps {
  projects: readonly StudioProject[]
  selectedProjectId: string | null
  phase: 'idle' | 'loading' | 'error'
  error: string | null
  creating: boolean
  onRefresh(): void
  onCreate(name: string): Promise<void>
  onOpen(project: StudioProject): void
}

/** Relative-day label for the project creation date. */
function createdLabel(project: StudioProject): string {
  return new Date(project.createdAt).toLocaleDateString()
}

/**
 * The studio project list: an inline create form plus one row per project.
 * Clicking a row opens the project (session binding happens in the callback).
 */
export function ProjectList(props: ProjectListProps) {
  const { projects, selectedProjectId, phase, error, creating, onRefresh, onCreate, onOpen } = props
  const [formOpen, setFormOpen] = useState(false)
  const [draftName, setDraftName] = useState('')
  const submit = async () => {
    const name = draftName.trim()
    if (name.length === 0 || creating) return
    await onCreate(name)
    setFormOpen(false)
    setDraftName('')
  }
  return (
    <div className="csProjectList">
      {!formOpen && (
        <button
          type="button"
          className="csProjectNew"
          disabled={creating}
          onClick={() => setFormOpen(true)}
        >
          + 新建项目
        </button>
      )}
      {formOpen && (
        <div className="csProjectForm">
          <input
            className="csProjectNameInput"
            value={draftName}
            placeholder="项目名"
            autoFocus
            disabled={creating}
            onChange={(event) => { setDraftName(event.target.value) }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submit()
              if (event.key === 'Escape') setFormOpen(false)
            }}
          />
          <div className="csProjectFormActions">
            <button type="button" disabled={creating || draftName.trim().length === 0} onClick={() => void submit()}>
              {creating ? '创建中' : '创建'}
            </button>
            <button type="button" disabled={creating} onClick={() => setFormOpen(false)}>取消</button>
          </div>
        </div>
      )}
      {phase === 'loading' && <div className="csProjectsEmpty">加载中…</div>}
      {phase === 'error' && (
        <div className="csProjectError">
          <span>{error}</span>
          <button type="button" onClick={onRefresh}>重试</button>
        </div>
      )}
      {phase === 'idle' && projects.length === 0 && (
        <div className="csProjectsEmpty">
          还没有项目,点击「新建项目」开始创作
        </div>
      )}
      {projects.map(project => (
        <button
          type="button"
          key={project.id}
          className={project.id === selectedProjectId ? 'csProjectItem csProjectItemActive' : 'csProjectItem'}
          onClick={() => onOpen(project)}
        >
          <span className="csProjectName">{project.name}</span>
          <span className="csProjectDate">{createdLabel(project)}</span>
        </button>
      ))}
    </div>
  )
}