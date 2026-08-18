import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'

interface Props {
  fileId: string
}

interface Collaborator {
  id: string
  name: string
  color: string
  cursor?: { line: number; ch: number }
}

export default function CollaborationPanel({ fileId }: Props) {
  const user = useAuthStore((s) => s.user)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [followedUser, setFollowedUser] = useState<string | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      // The actual collaborator data comes from Yjs awareness
      // This is a placeholder that would be connected to the real provider
    }, 2000)

    return () => clearInterval(interval)
  }, [fileId])

  function toggleFollow(userId: string) {
    setFollowedUser((prev) => (prev === userId ? null : userId))
  }

  return (
    <div className="w-56 bg-surface-1/80 backdrop-blur-xl border-l border-border flex flex-col shrink-0 animate-slide-in-right">
      <div className="px-3 py-2.5 border-b border-border">
        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Collaborators</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Current user */}
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-surface-2/50 border border-border">
          <div className="relative">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent/20 to-purple-500/20 flex items-center justify-center text-accent text-[10px] font-semibold border border-accent/20">
              {user?.first_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-success rounded-full border-2 border-surface-1" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-text-primary font-medium truncate">
              {user?.first_name} (you)
            </p>
          </div>
        </div>

        {/* Other collaborators */}
        {collaborators.length === 0 && (
          <div className="px-2 py-6 text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-surface-2 flex items-center justify-center">
              <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </div>
            <p className="text-[10px] text-text-muted">No other users connected</p>
            <p className="text-[10px] text-text-muted/70 mt-0.5">Share the file URL to collaborate</p>
          </div>
        )}

        {collaborators.map((collab) => (
          <div
            key={collab.id}
            className={`flex items-center gap-2.5 px-2 py-2 rounded-xl transition-all duration-200 ${
              followedUser === collab.id ? 'bg-accent/10 ring-1 ring-accent/30' : 'hover:bg-surface-2/80'
            }`}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold border border-white/10"
              style={{ backgroundColor: collab.color + '33', color: collab.color }}
            >
              {collab.name[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-primary font-medium truncate">{collab.name}</p>
              {collab.cursor && (
                <p className="text-[10px] text-text-muted">Line {collab.cursor.line}</p>
              )}
            </div>
            <button
              onClick={() => toggleFollow(collab.id)}
              className={`text-[10px] p-1 rounded-md transition-all duration-200 ${
                followedUser === collab.id
                  ? 'bg-accent/20 text-accent'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-2'
              }`}
              title={followedUser === collab.id ? 'Stop following' : 'Follow'}
            >
              {followedUser === collab.id ? (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* File info */}
      <div className="p-3 border-t border-border">
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <span className="text-[10px] text-text-muted">File ID</span>
            <span className="text-[10px] text-text-secondary">{fileId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-text-muted">Mode</span>
            <span className="text-[10px] text-success flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Autosaved
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
