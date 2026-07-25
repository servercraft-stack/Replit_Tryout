import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getBoard, listColumns, createColumn, listCards, createCard, type Board, type Column, type Card } from '../api/boards'
import { useWebSocket } from '../hooks/useWebSocket'

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const navigate = useNavigate()
  const [board, setBoard] = useState<Board | null>(null)
  const [columns, setColumns] = useState<Column[]>([])
  const [cardsByColumn, setCardsByColumn] = useState<Record<number, Card[]>>({})
  const [onlineUsers, setOnlineUsers] = useState<Map<number, string>>(new Map())
  const [newColumnTitle, setNewColumnTitle] = useState('')
  const [newCardTitles, setNewCardTitles] = useState<Record<number, string>>({})
  const [editingCard, setEditingCard] = useState<Card | null>(null)
  const [editBody, setEditBody] = useState('')
  const [loading, setLoading] = useState(true)

  const id = Number(boardId)

  // WebSocket for live updates
  const { send } = useWebSocket({
    url: `/ws/colab/boards/${id}/`,
    onMessage: useCallback((e: MessageEvent) => {
      const event = JSON.parse(e.data)
      handleSocketEvent(event)
    }, []),
    onOpen: useCallback(() => {}, []),
  })

  function handleSocketEvent(event: Record<string, any>) {
    switch (event.type) {
      case 'presence.join':
        setOnlineUsers((prev) => {
          const next = new Map(prev)
          next.set(event.actor_id, event.actor_name || `User ${event.actor_id}`)
          return next
        })
        break
      case 'presence.leave':
        setOnlineUsers((prev) => {
          const next = new Map(prev)
          next.delete(event.actor_id)
          return next
        })
        break
      case 'card.created':
        if (event.payload?.column_id) {
          loadCards(event.payload.column_id)
        }
        break
      case 'card.updated':
        if (event.payload?.card_id) {
          loadCardFromServer(event.payload.card_id)
        }
        break
      case 'card.moved':
        // Reload all columns
        columns.forEach((col) => loadCards(col.id))
        break
      case 'card.deleted':
        columns.forEach((col) => loadCards(col.id))
        break
    }
  }

  useEffect(() => {
    loadBoard()
  }, [id])

  async function loadBoard() {
    try {
      const data = await getBoard(id)
      setBoard(data)
      const cols = data.columns || (await listColumns(id))
      setColumns(cols)
      const cards: Record<number, Card[]> = {}
      for (const col of cols) {
        cards[col.id] = col.cards || (await listCards(col.id))
      }
      setCardsByColumn(cards)
    } catch {
      // Board might not exist
    } finally {
      setLoading(false)
    }
  }

  async function loadCards(columnId: number) {
    const cards = await listCards(columnId)
    setCardsByColumn((prev) => ({ ...prev, [columnId]: Array.isArray(cards) ? cards : [] }))
  }

  async function loadCardFromServer(cardId: number) {
    // Refresh all columns for simplicity
    columns.forEach((col) => loadCards(col.id))
  }

  async function handleCreateColumn(e: React.FormEvent) {
    e.preventDefault()
    if (!newColumnTitle.trim()) return
    const col = await createColumn(id, newColumnTitle.trim(), columns.length)
    setColumns((prev) => [...prev, col])
    setCardsByColumn((prev) => ({ ...prev, [col.id]: [] }))
    setNewColumnTitle('')
  }

  async function handleCreateCard(columnId: number, e: React.FormEvent) {
    e.preventDefault()
    const title = newCardTitles[columnId]
    if (!title?.trim()) return
    const card = await createCard(columnId, title.trim())
    setCardsByColumn((prev) => ({
      ...prev,
      [columnId]: [...(prev[columnId] || []), card],
    }))
    setNewCardTitles((prev) => ({ ...prev, [columnId]: '' }))
  }

  function startEditCard(card: Card) {
    setEditingCard(card)
    setEditBody(card.body || card.title)
  }

  async function saveEditCard() {
    if (!editingCard) return
    send({
      type: 'card.update',
      request_id: `edit-${Date.now()}`,
      payload: {
        card_id: editingCard.id,
        base_version: editingCard.version,
        changes: { body: editBody },
      },
    })
    setEditingCard(null)
  }

  async function deleteCard(columnId: number, cardId: number) {
    send({
      type: 'card.delete',
      request_id: `del-${Date.now()}`,
      payload: { card_id: cardId },
    })
    setCardsByColumn((prev) => ({
      ...prev,
      [columnId]: (prev[columnId] || []).filter((c) => c.id !== cardId),
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-zinc-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-white">{board?.title}</h1>
        </div>

        {/* Online users */}
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {Array.from(onlineUsers.entries()).map(([id, name]) => (
              <div
                key={id}
                className="w-7 h-7 rounded-full bg-accent/20 border-2 border-surface-0 flex items-center justify-center text-accent text-xs font-semibold"
                title={name}
              >
                {name[0]?.toUpperCase()}
              </div>
            ))}
          </div>
          {onlineUsers.size > 0 && (
            <span className="text-xs text-zinc-500">{onlineUsers.size} online</span>
          )}
        </div>
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full">
          {columns.map((col) => (
            <div key={col.id} className="w-80 shrink-0 flex flex-col bg-surface-1 border border-border rounded-xl">
              {/* Column header */}
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-300">{col.title}</h3>
                <span className="text-xs text-zinc-600 bg-surface-3 px-2 py-0.5 rounded-full">
                  {(cardsByColumn[col.id] || []).length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {(cardsByColumn[col.id] || []).map((card) => (
                  <div
                    key={card.id}
                    className="bg-surface-2 border border-border rounded-lg p-3 hover:border-accent/30 transition-colors group cursor-pointer"
                    onClick={() => startEditCard(card)}
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-sm text-white font-medium">{card.title}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteCard(col.id, card.id) }}
                        className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    {card.body && (
                      <p className="text-xs text-zinc-500 mt-1.5 line-clamp-2">{card.body}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-zinc-600">v{card.version}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* New card input */}
              <div className="p-3 border-t border-border">
                <form onSubmit={(e) => handleCreateCard(col.id, e)} className="flex gap-2">
                  <input
                    type="text"
                    value={newCardTitles[col.id] || ''}
                    onChange={(e) => setNewCardTitles((prev) => ({ ...prev, [col.id]: e.target.value }))}
                    placeholder="New card..."
                    className="flex-1 px-3 py-1.5 bg-surface-3 border border-border rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                  <button
                    type="submit"
                    className="px-2 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-sm transition-colors"
                  >
                    +
                  </button>
                </form>
              </div>
            </div>
          ))}

          {/* Add column */}
          <div className="w-80 shrink-0">
            <form onSubmit={handleCreateColumn} className="flex gap-2">
              <input
                type="text"
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                placeholder="Add column..."
                className="flex-1 px-4 py-2.5 bg-surface-2 border border-border rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-surface-2 hover:bg-surface-3 border border-border rounded-xl text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Add
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editingCard && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditingCard(null)}>
          <div className="bg-surface-1 border border-border rounded-xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">{editingCard.title}</h3>
              <button onClick={() => setEditingCard(null)} className="text-zinc-500 hover:text-white">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5">
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                className="w-full h-40 bg-surface-2 border border-border rounded-lg p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                placeholder="Card content..."
              />
            </div>
            <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => setEditingCard(null)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEditCard}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
