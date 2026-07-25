import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listWorkspaces, createWorkspace, type Workspace } from '../api/workspaces'
import { listProjects, createProject, type Project } from '../api/files'
import { createTerminal } from '../api/terminals'
import { sendInvitation, listInvitations, listMyInvitations, type Invitation } from '../api/invitations'

export default function DashboardPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [myInvitations, setMyInvitations] = useState<Invitation[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadWorkspaces()
    loadMyInvitations()
  }, [])

  useEffect(() => {
    if (selectedWorkspace) loadWorkspaceData(selectedWorkspace)
  }, [selectedWorkspace])

  async function loadWorkspaces() {
    try {
      const data = await listWorkspaces()
      const results = Array.isArray(data) ? data : data.results || []
      setWorkspaces(results)
      if (results.length > 0) setSelectedWorkspace(results[0].id)
    } catch {
      setWorkspaces([])
    } finally {
      setLoading(false)
    }
  }

  async function loadWorkspaceData(wsId: string) {
    const [p, inv] = await Promise.all([listProjects(wsId), listInvitations(wsId)])
    setProjects(Array.isArray(p) ? p : p.results || [])
    setInvitations(Array.isArray(inv) ? inv : inv.results || [])
  }

  async function loadMyInvitations() {
    try {
      const data = await listMyInvitations()
      setMyInvitations(Array.isArray(data) ? data : [])
    } catch {
      setMyInvitations([])
    }
  }

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault()
    if (!newWorkspaceName.trim()) return
    const ws = await createWorkspace(newWorkspaceName.trim())
    setNewWorkspaceName('')
    setWorkspaces((prev) => [ws, ...prev])
    setSelectedWorkspace(ws.id)
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault()
    if (!newProjectName.trim() || !selectedWorkspace) return
    const project = await createProject(selectedWorkspace, newProjectName.trim())
    setNewProjectName('')
    setProjects((prev) => [project, ...prev])
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim() || !selectedWorkspace) return
    try {
      await sendInvitation(selectedWorkspace, inviteEmail.trim(), inviteRole)
      setInviteEmail('')
      loadWorkspaceData(selectedWorkspace)
    } catch { /* ignore */ }
  }

  async function openProject(projectId: number) {
    navigate(`/workspace/${projectId}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      {/* Pending invitations */}
      {myInvitations.length > 0 && (
        <div className="mb-6 bg-accent/10 border border-accent/20 rounded-xl p-4 animate-fade-in-down">
          <h3 className="text-sm font-semibold text-accent mb-2">Pending Invitations</h3>
          <div className="space-y-2">
            {myInvitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-white font-medium">{inv.workspace_name}</span>
                  <span className="text-xs text-zinc-500 ml-2">as {inv.role}</span>
                </div>
                <button
                  onClick={async () => {
                    const { acceptInvitation } = await import('../api/invitations')
                    await acceptInvitation(inv.token)
                    loadWorkspaces()
                    setMyInvitations((prev) => prev.filter((i) => i.id !== inv.id))
                  }}
                  className="px-3 py-1 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Accept
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white animate-fade-in-up">Workspaces</h1>
          <p className="text-zinc-500 text-sm mt-1">Your collaborative projects</p>
        </div>
      </div>

      {/* Workspace tabs */}
      <div className="flex items-center gap-3 mb-8">
        <form onSubmit={handleCreateWorkspace} className="flex gap-2">
          <input
            type="text"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            placeholder="New workspace..."
            className="px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-accent/50 w-48"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-surface-3 hover:bg-surface-4 border border-border rounded-lg text-sm text-zinc-300 hover:text-white transition-colors"
          >
            Create
          </button>
        </form>
        <div className="flex gap-2 flex-wrap">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => setSelectedWorkspace(ws.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedWorkspace === ws.id
                  ? 'bg-accent text-white'
                  : 'bg-surface-2 text-zinc-400 hover:text-white hover:bg-surface-3 border border-border'
              }`}
            >
              {ws.name}
            </button>
          ))}
        </div>
      </div>

      {selectedWorkspace && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Projects */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Projects</h2>
              <form onSubmit={handleCreateProject} className="flex gap-2">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="New project..."
                  className="px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-accent/50 w-48"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-surface-3 hover:bg-surface-4 border border-border rounded-lg text-sm text-zinc-300 hover:text-white transition-colors"
                >
                  +
                </button>
              </form>
            </div>
            <div className="space-y-2">
              {projects.map((project, i) => (
                <button
                  key={project.id}
                  onClick={() => openProject(project.id)}
                  className={`w-full flex items-center justify-between px-5 py-4 bg-surface-1 hover:bg-surface-2 border border-border rounded-xl transition-all group hover-lift animate-fade-in-up`}
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-white group-hover:text-accent transition-colors">
                        {project.name}
                      </p>
                      <p className="text-xs text-zinc-600 mt-0.5">
                        {project.file_count} files &middot; {project.terminal_count} terminals
                      </p>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
              {projects.length === 0 && (
                <div className="px-5 py-12 bg-surface-1 border border-border rounded-xl text-center">
                  <p className="text-zinc-600 text-sm">No projects yet. Create one to start coding.</p>
                </div>
              )}
            </div>
          </div>

          {/* Invite panel */}
          <section>
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Invite Members</h2>
            <form onSubmit={handleInvite} className="space-y-2 mb-4">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email address..."
                className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <div className="flex gap-2">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Invite
                </button>
              </div>
            </form>

            {invitations.length > 0 && (
              <>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Sent</h3>
                <div className="space-y-1.5">
                  {invitations.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between px-3 py-2 bg-surface-2 border border-border rounded-lg">
                      <div>
                        <p className="text-xs text-white">{inv.email}</p>
                        <p className="text-[10px] text-zinc-600">{inv.role}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        inv.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                        inv.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-400' :
                        'bg-zinc-500/10 text-zinc-500'
                      }`}>
                        {inv.status}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
