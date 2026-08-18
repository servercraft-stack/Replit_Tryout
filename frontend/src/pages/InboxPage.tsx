import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listMyInvitations, acceptInvitation, declineInvitation, type Invitation } from '../api/invitations'

function isExpiringSoon(createdAt: string) {
  const created = new Date(createdAt).getTime()
  const now = Date.now()
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  const remaining = sevenDays - (now - created)
  return remaining < 2 * 24 * 60 * 60 * 1000
}

function isExpired(createdAt: string) {
  const created = new Date(createdAt).getTime()
  const now = Date.now()
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  return now - created > sevenDays
}

function daysRemaining(createdAt: string) {
  const created = new Date(createdAt).getTime()
  const now = Date.now()
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  return Math.max(0, Math.ceil((sevenDays - (now - created)) / (24 * 60 * 60 * 1000)))
}

export default function InboxPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState<number | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadInvitations()
  }, [])

  async function loadInvitations() {
    try {
      const data = await listMyInvitations() as Invitation[]
      setInvitations(data)
    } catch {
      setInvitations([])
    } finally {
      setLoading(false)
    }
  }

  async function handleAccept(inv: Invitation) {
    setActioningId(inv.id)
    try {
      await acceptInvitation(inv.token)
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id))
      navigate(`/workspaces/${inv.workspace}/projects`)
    } catch {
      setActioningId(null)
    }
  }

  async function handleDecline(inv: Invitation) {
    setActioningId(inv.id)
    try {
      await declineInvitation(inv.id)
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id))
    } finally {
      setActioningId(null)
    }
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
    <div className="max-w-4xl mx-auto px-8 py-8">
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">Inbox</h1>
        <p className="text-text-secondary mt-1">Workspace invitations and notifications</p>
      </div>

      {invitations.length === 0 ? (
        <div className="card p-16 text-center animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-surface-2 flex items-center justify-center">
            <svg className="w-10 h-10 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <p className="text-text-secondary text-lg font-medium mb-1">All caught up</p>
          <p className="text-text-muted text-sm">No pending invitations</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invitations.map((inv, i) => {
            const expired = isExpired(inv.created_at)
            const expiring = !expired && isExpiringSoon(inv.created_at)
            return (
              <div
                key={inv.id}
                className="card glass-hover p-5 animate-fade-in-up flex items-center justify-between gap-4"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-accent/20 to-cyan/20 flex items-center justify-center border border-accent/20 shrink-0">
                    <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">{inv.workspace_name}</p>
                    <p className="text-xs text-text-muted">Invited as <span className="text-text-secondary">{inv.role}</span> by {inv.invited_by_detail.first_name} {inv.invited_by_detail.last_name}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">Received {formatDate(inv.created_at)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {expired ? (
                    <span className="badge badge-error">Expired</span>
                  ) : expiring ? (
                    <span className="badge badge-warning">{daysRemaining(inv.created_at)}d left</span>
                  ) : (
                    <span className="badge badge-success">{daysRemaining(inv.created_at)}d left</span>
                  )}
                  {!expired && (
                    <>
                      <button
                        onClick={() => handleDecline(inv)}
                        disabled={actioningId === inv.id}
                        className="btn-ghost text-xs py-1.5 px-3"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleAccept(inv)}
                        disabled={actioningId === inv.id}
                        className="btn-primary text-xs py-1.5 px-4"
                      >
                        Accept
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
