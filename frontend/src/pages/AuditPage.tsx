import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { listEvents, type CollaborationEvent } from '../api/boards'
import { useAuthStore } from '../store/authStore'

export default function AuditPage() {
  const { workspaceId, projectId, boardId } = useParams<{ workspaceId: string; projectId: string; boardId: string }>()
  const navigate = useNavigate()
  const [events, setEvents] = useState<CollaborationEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [eventType, setEventType] = useState('')
  const [entityType, setEntityType] = useState('')
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  const id = Number(boardId)

  useEffect(() => {
    loadEvents()
  }, [id, eventType, entityType, startDate, endDate])

  async function loadEvents() {
    setLoading(true)
    try {
      const data = await listEvents({
        board: id,
        event_type: eventType || undefined,
        entity_type: entityType || undefined,
        start: startDate || undefined,
        end: endDate || undefined,
      })
      setEvents(Array.isArray(data) ? data : [])
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return events
    const q = search.toLowerCase()
    return events.filter((e) =>
      e.actor?.toLowerCase().includes(q) ||
      e.event_type?.toLowerCase().includes(q) ||
      e.entity_type?.toLowerCase().includes(q) ||
      JSON.stringify(e.payload).toLowerCase().includes(q)
    )
  }, [events, search])

  const uniqueEventTypes = useMemo(() => Array.from(new Set(events.map((e) => e.event_type))), [events])
  const uniqueEntityTypes = useMemo(() => Array.from(new Set(events.map((e) => e.entity_type))), [events])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/workspaces/${workspaceId}/projects/${projectId}/board/${boardId}`)} className="text-zinc-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-semibold text-white">Audit Log</h1>
            <p className="text-xs text-zinc-500">Board collaboration events</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events..."
            className="px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-accent/50 w-64"
          />
        </div>
      </div>

      <div className="px-6 py-4 border-b border-border flex items-center gap-3 shrink-0 bg-surface-1/50">
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          <option value="">All event types</option>
          {uniqueEventTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          <option value="">All entities</option>
          {uniqueEntityTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
        <button
          onClick={loadEvents}
          className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 border border-border rounded-lg text-sm text-zinc-400 hover:text-white transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-1/80 backdrop-blur-xl sticky top-0">
            <tr className="border-b border-border">
              <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Actor</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Action</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Entity</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Version</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((event) => (
              <>
                <tr
                  key={event.id}
                  className="hover:bg-surface-2/50 transition-colors cursor-pointer"
                  onClick={() => setExpandedRow(expandedRow === event.id ? null : event.id)}
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent text-[10px] font-semibold">
                        {event.actor?.[0]?.toUpperCase() || '?'}
                      </div>
                      <span className="text-text-primary">{event.actor}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className="badge badge-info">{event.event_type}</span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="text-text-secondary">{event.entity_type} #{event.entity_id}</span>
                  </td>
                  <td className="px-6 py-3 text-text-muted">v{event.version}</td>
                  <td className="px-6 py-3 text-text-muted">{new Date(event.timestamp).toLocaleString()}</td>
                </tr>
                {expandedRow === event.id && (
                  <tr key={`${event.id}-payload`} className="bg-surface-2/30">
                    <td colSpan={5} className="px-6 py-4">
                      <div className="bg-surface-2 border border-border rounded-lg p-4 overflow-x-auto">
                        <pre className="text-xs text-zinc-400 font-mono whitespace-pre-wrap break-all">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                  No events found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
