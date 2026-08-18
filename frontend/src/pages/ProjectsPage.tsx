import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { listProjects, createProject, type Project } from '../api/files'
import { listBoards, type Board } from '../api/boards'
import { listTerminals } from '../api/terminals'

export default function ProjectsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [boards, setBoards] = useState<Board[]>([])
  const [terminals, setTerminals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!workspaceId) return
    loadData()
  }, [workspaceId])

  async function loadData() {
    try {
      const [p, b, t] = await Promise.all([
        listProjects(workspaceId),
        listBoards(workspaceId),
        listTerminals(),
      ])
      const projectResults = Array.isArray(p) ? p : p.results || []
      const boardResults = Array.isArray(b) ? b : b.results || []
      const terminalResults = Array.isArray(t) ? t : t.results || []
      setProjects(projectResults)
      setBoards(boardResults.filter((board: Board) => board.workspace === workspaceId))
      setTerminals(terminalResults)
    } catch {
      setProjects([])
      setBoards([])
      setTerminals([])
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newProjectName.trim() || !workspaceId) return
    setCreating(true)
    const project = await createProject(workspaceId, newProjectName.trim())
    setNewProjectName('')
    setShowCreate(false)
    setProjects((prev) => [project, ...prev])
    setCreating(false)
  }

  function getProjectTerminalCount(projectId: number) {
    return terminals.filter((t: any) => t.project === projectId).length
  }

  function getProjectBoards(projectId: number) {
    // Boards are workspace-scoped in the API, so every board returned for this
    // workspace belongs in this project's workspace view.
    return boards.filter((b: Board) => b.workspace === workspaceId)
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-8 animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Projects</h1>
          <p className="text-text-secondary mt-1">Code, boards, and terminals</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </span>
        </button>
      </div>

      <div className="flex items-center gap-3 mb-6 animate-fade-in-up stagger-1">
        <div className="relative flex-1 max-w-md">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="input pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-16 text-center animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-surface-2 flex items-center justify-center">
            <svg className="w-10 h-10 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
            </svg>
          </div>
          <p className="text-text-secondary text-lg font-medium mb-1">No projects found</p>
          <p className="text-text-muted text-sm mb-6">Create a project to start coding</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((project, i) => {
            const projectBoards = getProjectBoards(project.id)
            const terminalCount = getProjectTerminalCount(project.id)
            return (
              <div
                key={project.id}
                className="card glass-hover p-6 animate-fade-in-up group"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet/20 to-accent/20 flex items-center justify-center border border-violet/20 shrink-0">
                    <svg className="w-6 h-6 text-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors truncate">
                      {project.name}
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{project.description || 'No description'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-surface-2/50 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-text-primary">{project.file_count}</p>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider">Files</p>
                  </div>
                  <div className="bg-surface-2/50 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-text-primary">{terminalCount}</p>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider">Terminals</p>
                  </div>
                  <div className="bg-surface-2/50 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-text-primary">{projectBoards.length}</p>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider">Boards</p>
                  </div>
                </div>

                {projectBoards.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Kanban Boards</p>
                    <div className="space-y-1.5">
                      {projectBoards.map((board) => (
                          <button
                            key={board.id}
                            onClick={() => navigate(`/workspaces/${workspaceId}/projects/${project.id}/board/${board.id}`)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2/50 hover:bg-surface-3/50 border border-border hover:border-border-hover transition-all text-left"
                          >
                          <svg className="w-3.5 h-3.5 text-violet shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                          </svg>
                          <span className="text-xs text-text-primary truncate">{board.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <span className="text-[10px] text-text-muted">Updated {formatDate(project.updated_at)}</span>
                  <button
                    onClick={() => navigate(`/workspaces/${workspaceId}/projects/${project.id}/ide`)}
                    className="btn-specular text-xs py-1.5 px-3"
                  >
                    Open Project
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowCreate(false); setNewProjectName(''); }} />
          <div className="relative glass rounded-2xl p-6 w-full max-w-md animate-scale-in border border-border-specular">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Create Project</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project name..."
                className="input"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowCreate(false); setNewProjectName(''); }} className="btn-ghost">Cancel</button>
                <button type="submit" disabled={creating} className="btn-primary">
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
