import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listWorkspaces, createWorkspace, deleteWorkspace, type Workspace } from '../api/workspaces'

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadWorkspaces()
  }, [])

  async function loadWorkspaces() {
    try {
      const data = await listWorkspaces()
      const results = Array.isArray(data) ? data : data.results || []
      setWorkspaces(results)
    } catch {
      setWorkspaces([])
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    const ws = await createWorkspace(newName.trim())
    setNewName('')
    setShowCreate(false)
    setWorkspaces((prev) => [ws, ...prev])
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    await deleteWorkspace(id)
    setWorkspaces((prev) => prev.filter((w) => w.id !== id))
    setDeleting(null)
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-8 animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Workspaces</h1>
          <p className="text-text-secondary mt-1">Manage your collaborative spaces</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Workspace
          </span>
        </button>
      </div>

      {workspaces.length === 0 ? (
        <div className="card p-16 text-center animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-surface-2 flex items-center justify-center">
            <svg className="w-10 h-10 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75" />
            </svg>
          </div>
          <p className="text-text-secondary text-lg font-medium mb-1">No workspaces yet</p>
          <p className="text-text-muted text-sm mb-6">Create your first workspace to start collaborating</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            Create Workspace
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {workspaces.map((ws, i) => (
            <div
              key={ws.id}
              className="card glass-hover p-6 animate-fade-in-up group"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-accent/20 to-cyan/20 flex items-center justify-center border border-accent/20">
                    <span className="text-accent font-bold text-sm">{ws.name[0]?.toUpperCase()}</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors truncate max-w-[140px]">
                      {ws.name}
                    </h3>
                    <span className="badge badge-cyan text-[10px]">{ws.owner_name || 'Owner'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-5 text-xs text-text-muted">
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-3.262-3.262 9.337 9.337 0 00-4.121.952 9.375 9.375 0 00-2.518 1.93M15 19.128v.003M15 19.128a48.007 48.007 0 01-6.364-1.146M15 19.128a48.007 48.007 0 01-1.146-6.364M15 19.128V15m0 4.128v.003M12 15.75a48.007 48.007 0 016.364-1.146M12 15.75a48.007 48.007 0 01-1.146-6.364M12 15.75V12m0 3.75v.003M12 15.75a48.007 48.007 0 01-6.364 1.146M12 15.75a48.007 48.007 0 01-1.146 6.364M12 15.75V12m0 3.75v.003" />
                  </svg>
                  {ws.member_count} members
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  {formatDate(ws.created_at)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/workspaces/${ws.id}/projects`)}
                  className="btn-primary flex-1 text-xs py-2"
                >
                  Open
                </button>
                <button
                  onClick={() => navigate(`/workspaces/${ws.id}/members`)}
                  className="btn-specular flex-1 text-xs py-2"
                >
                  Members
                </button>
                <button
                  onClick={() => navigate(`/workspaces/${ws.id}/projects`)}
                  className="btn-specular flex-1 text-xs py-2"
                >
                  Projects
                </button>
                <button
                  onClick={() => handleDelete(ws.id)}
                  disabled={deleting === ws.id}
                  className="p-2 rounded-xl border border-border hover:border-crimson hover:text-crimson transition-colors disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.061-.94-1.75-1.975-1.75H12.25c-1.035 0-1.975.69-1.975 1.75v.916" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative glass rounded-2xl p-6 w-full max-w-md animate-scale-in border border-border-specular">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Create Workspace</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Workspace name..."
                className="input"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
