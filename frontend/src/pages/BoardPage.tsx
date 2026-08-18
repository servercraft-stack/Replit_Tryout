import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getBoard, listColumns, createColumn, listCards, createCard, updateCard, deleteCard, moveCard, type Board, type Column, type Card } from '../api/boards'
import { useAuthStore } from '../store/authStore'

const TITLE_MAX = 120
const BODY_MAX = 2000

type DragItem = { type: 'column'; id: number; index: number } | { type: 'card'; columnId: number; id: number; index: number }

export default function BoardPage() {
  const { workspaceId, projectId, boardId } = useParams<{ workspaceId: string; projectId: string; boardId: string }>()
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.accessToken)
  const [board, setBoard] = useState<Board | null>(null)
  const [columns, setColumns] = useState<Column[]>([])
  const [cardsByColumn, setCardsByColumn] = useState<Record<number, Card[]>>({})
  const [onlineUsers, setOnlineUsers] = useState<Map<number, string>>(new Map())
  const [newColumnTitle, setNewColumnTitle] = useState('')
  const [newCardTitles, setNewCardTitles] = useState<Record<number, string>>({})
  const [editingCard, setEditingCard] = useState<Card | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [conflict, setConflict] = useState<string | null>(null)
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<number | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const dragCounter = useRef<Map<string, number>>(new Map())

  const id = Number(boardId)

  useEffect(() => {
    if (!token) return
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const socket = new WebSocket(`${scheme}://${window.location.host}/ws/colab/boards/${id}/?token=${encodeURIComponent(token)}`)
    socketRef.current = socket
    socket.addEventListener('message', (message) => handleSocketEvent(JSON.parse(message.data)))
    return () => { socket.close() }
  }, [token, id])

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
        if (event.payload?.column_id) loadCards(event.payload.column_id)
        break
      case 'card.updated':
        if (event.payload?.card_id) {
          loadCardsFromServer(event.payload.card_id)
        }
        break
      case 'card.moved':
        if (event.payload?.column_id) loadCards(event.payload.column_id)
        break
      case 'card.deleted':
        columns.forEach((col) => loadCards(col.id))
        break
      case 'card.conflict':
        setConflict(event.payload?.message || 'Version conflict detected')
        setTimeout(() => setConflict(null), 4000)
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
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  async function loadCards(columnId: number) {
    const cards = await listCards(columnId)
    setCardsByColumn((prev) => ({ ...prev, [columnId]: Array.isArray(cards) ? cards : [] }))
  }

  async function loadCardsFromServer(cardId: number) {
    for (const col of columns) {
      const cards = await listCards(col.id)
      const found = cards.find((c: Card) => c.id === cardId)
      if (found) {
        setCardsByColumn((prev) => ({ ...prev, [col.id]: cards }))
        break
      }
    }
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
    setEditTitle(card.title)
    setEditBody(card.body || '')
  }

  async function saveEditCard() {
    if (!editingCard) return
    if (!editTitle.trim()) return
    if (editTitle.length > TITLE_MAX || editBody.length > BODY_MAX) return
    try {
      const updated = await updateCard(editingCard.id, {
        title: editTitle.trim(),
        body: editBody,
      })
      setCardsByColumn((prev) => ({
        ...prev,
        [editingCard.column]: (prev[editingCard.column] || []).map((c) => (c.id === updated.id ? updated : c)),
      }))
      setEditingCard(null)
    } catch {
      setConflict('Failed to update card')
      setTimeout(() => setConflict(null), 4000)
    }
  }

  async function confirmDeleteCard() {
    if (!editingCard) return
    await deleteCard(editingCard.id)
    setCardsByColumn((prev) => ({
      ...prev,
      [editingCard.column]: (prev[editingCard.column] || []).filter((c) => c.id !== editingCard.id),
    }))
    setEditingCard(null)
  }

  function handleDragStart(item: DragItem) {
    setDraggedItem(item)
  }

  function handleDragEnd() {
    setDraggedItem(null)
    setDragOverColumn(null)
    dragCounter.current.clear()
  }

  function handleColumnDragEnter(columnId: number) {
    setDragOverColumn(columnId)
  }

  function handleColumnDragLeave(columnId: number) {
    const key = `col-${columnId}`
    const counter = dragCounter.current.get(key) || 0
    dragCounter.current.set(key, counter - 1)
    if (counter <= 1) {
      setDragOverColumn((prev) => (prev === columnId ? null : prev))
    }
  }

  function handleColumnDragOver(e: React.DragEvent, columnId: number) {
    e.preventDefault()
    if (!draggedItem || draggedItem.type !== 'card') return
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const colCards = cardsByColumn[columnId] || []
    const insertIndex = e.clientY < midY ? colCards.length : 0
    e.dataTransfer.setData('text/plain', JSON.stringify({ columnId, insertIndex }))
  }

  async function handleCardDrop(e: React.DragEvent, targetColumnId: number) {
    e.preventDefault()
    if (!draggedItem || draggedItem.type !== 'card') return
    const raw = e.dataTransfer.getData('text/plain')
    let insertIndex = 0
    try {
      const parsed = JSON.parse(raw)
      insertIndex = parsed.insertIndex
    } catch {
      insertIndex = (cardsByColumn[targetColumnId] || []).length
    }
    const { columnId: sourceColumnId, id: cardId } = draggedItem
    try {
      const result = await moveCard(cardId, targetColumnId, insertIndex)
      if (sourceColumnId !== targetColumnId) {
        setCardsByColumn((prev) => {
          const next = { ...prev }
          const sourceCards = [...(next[sourceColumnId] || [])]
          const targetCards = [...(next[targetColumnId] || [])]
          const idx = sourceCards.findIndex((c) => c.id === cardId)
          if (idx !== -1) sourceCards.splice(idx, 1)
          targetCards.splice(insertIndex, 0, result)
          next[sourceColumnId] = sourceCards
          next[targetColumnId] = targetCards
          return next
        })
      } else {
        setCardsByColumn((prev) => ({
          ...prev,
          [sourceColumnId]: (prev[sourceColumnId] || []).map((c) => (c.id === cardId ? result : c)),
        }))
      }
    } catch {
      setConflict('Failed to move card')
      setTimeout(() => setConflict(null), 4000)
    }
    handleDragEnd()
  }

  function handleCardDragStart(e: React.DragEvent, card: Card, columnId: number) {
    const index = (cardsByColumn[columnId] || []).findIndex((c) => c.id === card.id)
    handleDragStart({ type: 'card', columnId, id: card.id, index })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', card.id.toString())
  }

  function handleColumnHeaderDragStart(e: React.DragEvent, column: Column, index: number) {
    handleDragStart({ type: 'column', id: column.id, index })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(column.id))
  }

  function handleColumnDrop(e: React.DragEvent) {
    e.preventDefault()
    if (!draggedItem || draggedItem.type !== 'column') return
    const targetId = Number(e.dataTransfer.getData('text/plain'))
    if (targetId === draggedItem.id) return
    setColumns((prev) => {
      const next = [...prev]
      const fromIdx = next.findIndex((c) => c.id === draggedItem.id)
      const toIdx = next.findIndex((c) => c.id === targetId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return next
    })
    handleDragEnd()
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
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/workspaces/${workspaceId}/projects/${projectId}/ide`)} className="text-zinc-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-white">{board?.title || 'Board'}</h1>
        </div>
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

      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full">
          {columns.map((col, idx) => (
            <div
              key={col.id}
              draggable
               onDragStart={(e) => handleColumnHeaderDragStart(e, col, idx)}
              onDragOver={(e) => {
                if (draggedItem?.type === 'column') {
                  e.preventDefault()
                }
                handleColumnDragOver(e, col.id)
              }}
              onDrop={(e) => {
                if (draggedItem?.type === 'column') {
                  handleColumnDrop(e)
                } else {
                  handleCardDrop(e, col.id)
                }
              }}
              onDragEnter={() => handleColumnDragEnter(col.id)}
              onDragLeave={() => handleColumnDragLeave(col.id)}
              className={`w-80 shrink-0 flex flex-col bg-surface-1 border rounded-xl transition-all duration-200 ${
                dragOverColumn === col.id && draggedItem?.type === 'card' ? 'border-accent/40 shadow-glow' : 'border-border'
              } ${draggedItem?.type === 'column' ? 'cursor-move' : ''}`}
            >
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="cursor-grab active:cursor-grabbing">
                    <svg className="w-4 h-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-300">{col.title}</h3>
                </div>
                <span className="text-xs text-zinc-600 bg-surface-3 px-2 py-0.5 rounded-full">
                  {(cardsByColumn[col.id] || []).length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[80px]">
                {(cardsByColumn[col.id] || []).map((card) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={(e) => handleCardDragStart(e, card, col.id)}
                    onDragEnd={handleDragEnd}
                    className={`bg-surface-2 border border-border rounded-lg p-3 hover:border-accent/30 transition-all group cursor-pointer ${
                      draggedItem?.type === 'card' && draggedItem.id === card.id ? 'opacity-40 scale-95' : ''
                    }`}
                    onClick={() => startEditCard(card)}
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-sm text-white font-medium line-clamp-2">{card.title}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteCard(card.id); setCardsByColumn((prev) => ({ ...prev, [col.id]: (prev[col.id] || []).filter((c) => c.id !== card.id) })) }}
                        className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all ml-2"
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
                      {card.updated_by && (
                        <span className="text-[10px] text-zinc-600 truncate">{card.updated_by}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-border">
                <form onSubmit={(e) => handleCreateCard(col.id, e)} className="flex gap-2">
                  <input
                    type="text"
                    value={newCardTitles[col.id] || ''}
                    onChange={(e) => setNewCardTitles((prev) => ({ ...prev, [col.id]: e.target.value }))}
                    placeholder="New card..."
                    maxLength={TITLE_MAX}
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
          <div className="w-80 shrink-0">
            <form onSubmit={handleCreateColumn} className="flex gap-2">
              <input
                type="text"
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                placeholder="Add column..."
                maxLength={TITLE_MAX}
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

      {editingCard && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditingCard(null)}>
          <div className="bg-surface-1 border border-border rounded-xl w-full max-w-lg mx-4 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Edit Card</h3>
              <button onClick={() => setEditingCard(null)} className="text-zinc-500 hover:text-white">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value.slice(0, TITLE_MAX))}
                  maxLength={TITLE_MAX}
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <div className="text-right text-[10px] text-zinc-600 mt-1">{editTitle.length}/{TITLE_MAX}</div>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Body</label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value.slice(0, BODY_MAX))}
                  maxLength={BODY_MAX}
                  className="w-full h-40 bg-surface-2 border border-border rounded-lg p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                  placeholder="Card content..."
                />
                <div className="text-right text-[10px] text-zinc-600 mt-1">{editBody.length}/{BODY_MAX}</div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-border flex justify-between">
              <button
                onClick={confirmDeleteCard}
                className="px-4 py-2 text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                Delete
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingCard(null)}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEditCard}
                  disabled={!editTitle.trim() || editTitle.length > TITLE_MAX || editBody.length > BODY_MAX}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {conflict && (
        <div className="fixed bottom-6 right-6 bg-crimson/10 border border-crimson/30 text-crimson px-4 py-3 rounded-xl shadow-lg z-50 animate-fade-in-up">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span className="text-sm font-medium">{conflict}</span>
          </div>
        </div>
      )}
    </div>
  )
}
