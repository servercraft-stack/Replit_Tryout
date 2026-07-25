import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'

interface Props {
  fileId: number
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
    // Poll awareness states from Yjs provider
    // In a real implementation, this would subscribe to awareness changes
    // For now, we'll use a simulated approach
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
    <div className="w-56 bg-surface-1 border-l border-border flex flex-col shrink-0">
      <div className="px-3 py-2 border-b border-border">
        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Collaborators</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Current user */}
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface-2">
          <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-accent text-[10px] font-semibold">
            {user?.first_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white font-medium truncate">
              {user?.first_name} (you)
            </p>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
        </div>

        {/* Other collaborators */}
        {collaborators.length === 0 && (
          <div className="px-2 py-4 text-center">
            <p className="text-[10px] text-zinc-600">No other users connected</p>
            <p className="text-[10px] text-zinc-700 mt-0.5">Share the file URL to collaborate</p>
          </div>
        )}

        {collaborators.map((collab) => (
          <div
            key={collab.id}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
              followedUser === collab.id ? 'bg-accent/10 ring-1 ring-accent/30' : 'hover:bg-surface-2'
            }`}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold"
              style={{ backgroundColor: collab.color + '33', color: collab.color }}
            >
              {collab.name[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white font-medium truncate">{collab.name}</p>
              {collab.cursor && (
                <p className="text-[10px] text-zinc-600">Line {collab.cursor.line}</p>
              )}
            </div>
            <button
              onClick={() => toggleFollow(collab.id)}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                followedUser === collab.id
                  ? 'bg-accent/20 text-accent'
                  : 'text-zinc-600 hover:text-zinc-400'
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
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-[10px] text-zinc-600">File ID</span>
            <span className="text-[10px] text-zinc-400">{fileId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-zinc-600">Mode</span>
            <span className="text-[10px] text-emerald-400">Live</span>
          </div>
        </div>
      </div>
    </div>
  )
}
