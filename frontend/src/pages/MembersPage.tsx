import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { listMembers, addMember, updateMember, deleteMember, type WorkspaceMember } from '../api/workspaces'
import { sendInvitation, type Invitation } from '../api/invitations'

const ROLE_LEVEL: Record<string, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 }

function roleBadgeClass(role: string) {
  switch (role) {
    case 'owner': return 'badge-info'
    case 'admin': return 'badge-warning'
    case 'editor': return 'badge-success'
    default: return 'badge-cyan'
  }
}

export default function MembersPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.user)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')
  const [inviteLink, setInviteLink] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)

  const myRole = members.find((m) => m.user === currentUser?.id)?.role || 'viewer'

  function canManage(memberRole: string) {
    return ROLE_LEVEL[myRole] > ROLE_LEVEL[memberRole]
  }

  useEffect(() => {
    if (!workspaceId) return
    loadMembers()
  }, [workspaceId])

  async function loadMembers() {
    try {
      const data = await listMembers(workspaceId!)
      const results = Array.isArray(data) ? data : data.results || []
      setMembers(results)
    } catch {
      setMembers([])
    } finally {
      setLoading(false)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim() || !workspaceId) return
    setSendingInvite(true)
    setInviteError('')
    try {
      const inv = await sendInvitation(workspaceId, inviteEmail.trim(), inviteRole)
      // Invitations are delivered to the recipient's authenticated Inbox. Keep
      // a shareable fallback link for recipients who have not signed in yet.
      setInviteLink(`${window.location.origin}/accept-invite?token=${inv.token}`)
    } catch (error: any) {
      setInviteError(error.response?.data?.detail || 'Unable to send the invitation. Please try again.')
    } finally {
      setSendingInvite(false)
    }
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    setUpdatingId(memberId)
    await updateMember(workspaceId!, memberId, newRole)
    setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role: newRole as WorkspaceMember['role'] } : m))
    setUpdatingId(null)
  }

  async function handleRemove(memberId: string) {
    setDeletingId(memberId)
    await deleteMember(workspaceId!, memberId)
    setMembers((prev) => prev.filter((m) => m.id !== memberId))
    setDeletingId(null)
  }

  function getInitials(first: string, last: string) {
    return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase()
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
    <div className="max-w-6xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-8 animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Members</h1>
          <p className="text-text-secondary mt-1">Manage workspace access and roles</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="btn-primary">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-3 3.75h16.5a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 6v10.5a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Invite Members
          </span>
        </button>
      </div>

      <div className="card overflow-hidden animate-fade-in">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="px-6 py-4 font-medium">Member</th>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Joined</th>
                {canManage('viewer') && <th className="px-6 py-4 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((member) => {
                const isMe = member.user === currentUser?.id
                const manage = canManage(member.role)
                return (
                  <tr key={member.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent/20 to-cyan/20 flex items-center justify-center text-accent text-xs font-semibold border border-accent/20">
                          {getInitials(member.user_detail.first_name, member.user_detail.last_name)}
                        </div>
                        <span className="font-medium text-text-primary">
                          {member.user_detail.first_name} {member.user_detail.last_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">{member.user_detail.email}</td>
                    <td className="px-6 py-4">
                      <span className={`badge ${roleBadgeClass(member.role)}`}>{member.role}</span>
                    </td>
                    <td className="px-6 py-4 text-text-muted">{formatDate(member.joined_at)}</td>
                    {canManage('viewer') && (
                      <td className="px-6 py-4">
                        {isMe ? (
                          <span className="text-text-muted text-xs">You</span>
                        ) : manage ? (
                          <div className="flex items-center justify-end gap-2">
                            <select
                              value={member.role}
                              onChange={(e) => handleRoleChange(member.id, e.target.value)}
                              disabled={updatingId === member.id}
                              className="input text-xs py-1.5 w-28"
                            >
                              {ROLE_LEVEL[member.role] < ROLE_LEVEL['admin'] && ROLE_LEVEL[myRole] >= ROLE_LEVEL['admin'] && (
                                <option value="admin">Admin</option>
                              )}
                              {ROLE_LEVEL[member.role] < ROLE_LEVEL['editor'] && ROLE_LEVEL[myRole] >= ROLE_LEVEL['editor'] && (
                                <option value="editor">Editor</option>
                              )}
                              {ROLE_LEVEL[member.role] < ROLE_LEVEL['viewer'] && ROLE_LEVEL[myRole] >= ROLE_LEVEL['viewer'] && (
                                <option value="viewer">Viewer</option>
                              )}
                              <option value={member.role} disabled>
                                {member.role}
                              </option>
                            </select>
                            <button
                              onClick={() => handleRemove(member.id)}
                              disabled={deletingId === member.id}
                              className="p-1.5 rounded-lg hover:bg-crimson/10 hover:text-crimson transition-colors disabled:opacity-50"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.061-.94-1.75-1.975-1.75H12.25c-1.035 0-1.975.69-1.975 1.75v.916" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <span className="text-text-muted text-xs">No access</span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
              {members.length === 0 && (
                <tr>
                  <td colSpan={canManage('viewer') ? 5 : 4} className="px-6 py-12 text-center text-text-muted">
                    No members yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowInvite(false); setInviteLink(''); setInviteEmail(''); setInviteRole('editor'); }} />
          <div className="relative glass rounded-2xl p-6 w-full max-w-md animate-scale-in border border-border-specular">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Invite Members</h2>
            {!inviteLink ? (
              <form onSubmit={handleInvite} className="space-y-4">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="input"
                  autoFocus
                />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="input">
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
                {inviteError && <p className="text-xs text-error">{inviteError}</p>}
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => { setShowInvite(false); setInviteLink(''); setInviteEmail(''); setInviteRole('editor'); }} className="btn-ghost">Cancel</button>
                  <button type="submit" disabled={sendingInvite} className="btn-primary">{sendingInvite ? 'Sending...' : 'Send Invitation'}</button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-text-secondary">Share this secure link with the invited member:</p>
                <div className="flex items-center gap-2">
                  <input type="text" readOnly value={inviteLink} className="input text-xs" />
                  <button
                    onClick={() => navigator.clipboard.writeText(inviteLink)}
                    className="btn-specular text-xs py-2 px-3 shrink-0"
                  >
                    Copy
                  </button>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => { setShowInvite(false); setInviteLink(''); setInviteEmail(''); setInviteRole('editor'); }} className="btn-ghost">Done</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
