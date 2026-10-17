import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listWorkspaces, createWorkspace, type Workspace } from '../api/workspaces'
import { listProjects, createProject, type Project } from '../api/files'
import { listInvitations, listMyInvitations, type Invitation } from '../api/invitations'
import Lightfall from '../components/Lightfall'
import Shapes3D from '../components/Shapes3D'

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

  return (
    <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">
      {/* 3D WebGL Lightfall Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl h-52 bg-surface-1 border border-white/10 shadow-glow flex items-center justify-between px-8 animate-fade-in-up">
        {/* Lightfall background canvas */}
        <div className="absolute inset-0 z-0 opacity-80 pointer-events-none">
          <Lightfall
            colors={['#00F5A0', '#00F0FF', '#7B2CBF']}
            backgroundColor="#0B0D12"
            speed={0.8}
            streakCount={6}
            streakWidth={1}
            glow={1.1}
            zoom={2.0}
            mouseInteraction={true}
          />
        </div>

        {/* 3D Shapes floating widget in header */}
        <div className="absolute right-0 top-0 bottom-0 w-80 z-5 pointer-events-none opacity-60">
          <Shapes3D shape="multi" color="#00F5A0" accentColor="#00F0FF" speed={0.7} />
        </div>

        <div className="relative z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold uppercase tracking-wider mb-3">
            <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
            3D Interactive Environment
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Collaborative Development Workspace
          </h1>
          <p className="text-text-secondary text-sm mt-2">
            Real-time code editing, live terminal sessions, and instant deployment.
          </p>
        </div>
      </div>

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

      {/* Header */}
      <div className="flex items-end justify-between animate-fade-in-up">
        <div>
          <h2 className="text-2xl font-bold text-text-primary tracking-tight">Workspaces</h2>
          <p className="text-text-secondary text-sm mt-0.5">Manage your workspace projects and team members</p>
        </div>
      </div>

      {/* Workspace selector */}
      <div className="flex items-center gap-3 animate-fade-in-up stagger-1">
        <form onSubmit={handleCreateWorkspace} className="flex gap-2">
          <input
            type="text"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            placeholder="New workspace..."
            className="input w-48"
          />
          <button type="submit" className="btn-primary py-2 px-4">
            Create
          </button>
        </form>
        <div className="flex gap-2 flex-wrap">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => setSelectedWorkspace(ws.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                selectedWorkspace === ws.id
                  ? 'bg-accent text-white shadow-glow'
                  : 'bg-surface-2 text-text-secondary hover:text-text-primary border border-border hover:border-border-hover'
              }`}
            >
              {ws.name}
            </button>
          ))}
        </div>
      </div>

      {selectedWorkspace && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Projects */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Projects</h2>
              <form onSubmit={handleCreateProject} className="flex gap-2">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="New project..."
                  className="input w-48"
                />
                <button type="submit" className="btn-ghost py-1.5 px-3">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </form>
            </div>

            <div className="grid gap-3">
              {projects.map((project, i) => (
                <button
                  key={project.id}
                  onClick={() => openProject(project.id)}
                  className="card glass-hover w-full p-5 text-left animate-fade-in-up"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center border border-emerald-500/20">
                      <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors">
                        {project.name}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {project.file_count} files · {project.terminal_count} terminals
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-text-muted group-hover:text-text-secondary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
              {projects.length === 0 && (
                <div className="card p-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-2 flex items-center justify-center">
                    <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                    </svg>
                  </div>
                  <p className="text-text-secondary text-sm">No projects yet</p>
                  <p className="text-text-muted text-xs mt-1">Create one to start coding</p>
                </div>
              )}
            </div>
          </div>

          {/* Invite panel */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Invite Members</h2>
            <form onSubmit={handleInvite} className="card p-4 space-y-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email address..."
                className="input"
              />
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
                <button type="submit" className="btn-primary py-2 px-4">
                  Invite
                </button>
              </div>
            </form>

            {invitations.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Sent</h3>
                {invitations.map((inv) => (
                  <div key={inv.id} className="card p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-text-primary">{inv.email}</p>
                      <p className="text-[10px] text-text-muted">{inv.role}</p>
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
