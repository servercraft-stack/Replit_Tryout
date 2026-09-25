import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listWorkspaces, createWorkspace, type Workspace } from '../api/workspaces'
import { listProjects, createProject, type Project } from '../api/files'
import { listInvitations, listMyInvitations, type Invitation } from '../api/invitations'
import Lightfall from '../components/Lightfall'
import { Card3D, Shape3D } from '../components/Shape3D'

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
      const { sendInvitation } = await import('../api/invitations')
      await sendInvitation(selectedWorkspace, inviteEmail.trim(), inviteRole)
      setInviteEmail('')
      loadWorkspaceData(selectedWorkspace)
    } catch { /* ignore */ }
  }

  async function openProject(projectId: number) {
    if (selectedWorkspace) navigate(`/workspaces/${selectedWorkspace}/projects/${projectId}/ide`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const currentWorkspaceName = workspaces.find((w) => w.id === selectedWorkspace)?.name || 'Select Workspace'

  return (
    <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">
      {/* Pending invitations */}
      {myInvitations.length > 0 && (
        <div className="card p-5 animate-fade-in-down border-l-4 border-l-accent">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <h3 className="text-sm font-semibold text-accent">Pending Invitations</h3>
          </div>
          <div className="space-y-2">
            {myInvitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 bg-surface-2/50 rounded-xl">
                <div>
                  <span className="text-sm font-medium text-text-primary">{inv.workspace_name}</span>
                  <span className="text-xs text-text-muted ml-2">as {inv.role}</span>
                </div>
                <button
                  onClick={async () => {
                    const { acceptInvitation } = await import('../api/invitations')
                    await acceptInvitation(inv.token)
                    loadWorkspaces()
                    setMyInvitations((prev) => prev.filter((i) => i.id !== inv.id))
                  }}
                  className="btn-primary text-xs py-1.5 px-4"
                >
                  Accept
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3D Lightfall Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-surface-1 min-h-[220px] flex items-center p-8">
        <div className="absolute inset-0 z-0">
          <Lightfall
            colors={['#00F5A0', '#00F0FF', '#7B2CBF']}
            backgroundColor="#0B0D12"
            speed={0.7}
            streakCount={6}
            streakWidth={1.2}
            zoom={2.5}
            opacity={0.7}
          />
        </div>

        {/* Floating 3D Shapes in Banner */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-6 pointer-events-none">
          <Shape3D type="cube" size={70} color="#00F5A0" />
          <Shape3D type="gem" size={80} color="#00F0FF" />
          <Shape3D type="octahedron" size={60} color="#7B2CBF" />
        </div>

        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold uppercase tracking-wider mb-3">
            <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
            3D Stream Workspace
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-text-primary tracking-tight">
            {currentWorkspaceName}
          </h1>
          <p className="text-text-secondary text-sm md:text-base mt-2">
            Collaborative real-time development with 3D spatial acceleration & instant cloud environments.
          </p>
        </div>
      </div>

      {/* Workspace selector & Create Form */}
      <div className="flex flex-wrap items-center justify-between gap-4 animate-fade-in-up">
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs font-bold text-text-muted uppercase tracking-wider mr-2">Workspaces:</span>
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => setSelectedWorkspace(ws.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                selectedWorkspace === ws.id
                  ? 'bg-accent text-slate-950 font-bold shadow-glow scale-105'
                  : 'bg-surface-2 text-text-secondary hover:text-text-primary border border-border hover:border-border-hover'
              }`}
            >
              {ws.name}
            </button>
          ))}
        </div>

        <form onSubmit={handleCreateWorkspace} className="flex gap-2 shrink-0">
          <input
            type="text"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            placeholder="New workspace..."
            className="input w-44 text-sm"
          />
          <button type="submit" className="btn-primary py-2 px-4 text-xs">
            + Workspace
          </button>
        </form>
      </div>

      {selectedWorkspace && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Projects Column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                <span>Projects</span>
                <span className="badge badge-cyan">{projects.length}</span>
              </h2>
              <form onSubmit={handleCreateProject} className="flex gap-2">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="New project..."
                  className="input w-48 text-sm"
                />
                <button type="submit" className="btn-specular py-1.5 px-3 text-xs flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Create
                </button>
              </form>
            </div>

            <div className="grid gap-3">
              {projects.map((project, i) => (
                <Card3D key={project.id} maxTilt={6}>
                  <div
                    onClick={() => openProject(project.id)}
                    className="card glass-hover w-full p-5 text-left border-white/10 flex items-center gap-4 cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-emerald-500/30 shadow-lg shrink-0">
                      <Shape3D type="cube" size={28} color="#00F5A0" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-text-primary group-hover:text-accent transition-colors truncate">
                        {project.name}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {project.file_count} files · {project.terminal_count} terminals
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-accent text-xs font-semibold">
                      Open IDE
                      <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Card3D>
              ))}

              {projects.length === 0 && (
                <div className="card p-12 text-center border-dashed border-border">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-2 flex items-center justify-center">
                    <Shape3D type="gem" size={36} color="#00F0FF" />
                  </div>
                  <p className="text-text-secondary text-sm font-medium">No projects yet</p>
                  <p className="text-text-muted text-xs mt-1">Create one above to launch your collaborative workspace</p>
                </div>
              )}
            </div>
          </div>

          {/* Invite Member Panel */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Invite Members</h2>
            <Card3D maxTilt={4}>
              <form onSubmit={handleInvite} className="card p-5 space-y-4 bg-surface-1/90 backdrop-blur-xl border-white/10">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-muted uppercase">Email Address</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    className="input"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="input flex-1"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button type="submit" className="btn-primary py-2 px-4 text-xs">
                    Send Invite
                  </button>
                </div>
              </form>
            </Card3D>

            {invitations.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Sent Invitations</h3>
                {invitations.map((inv) => (
                  <div key={inv.id} className="card p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-text-primary font-medium">{inv.email}</p>
                      <p className="text-[10px] text-text-muted capitalize">{inv.role}</p>
                    </div>
                    <span className={`badge ${inv.status === 'pending' ? 'badge-warning' : inv.status === 'accepted' ? 'badge-success' : 'badge-info'}`}>
                      {inv.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
