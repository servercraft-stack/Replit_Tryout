import client from './client'

export interface Board {
  id: number
  workspace: string
  title: string
  column_count: number
  columns?: Column[]
  created_at: string
  updated_at: string
}

export interface Column {
  id: number
  board: number
  title: string
  position: number
  cards?: Card[]
  created_at: string
  updated_at: string
}

export interface Card {
  id: number
  column: number
  title: string
  body: string
  position: number
  version: number
  updated_by: string | null
  updated_by_detail?: { id: string; email: string; first_name: string; last_name: string }
  created_at: string
  updated_at: string
}

export async function listBoards(workspaceId?: string) {
  const params = workspaceId ? { workspace: workspaceId } : {}
  const { data } = await client.get('/colab/boards/', { params })
  return data
}

export async function createBoard(workspaceId: string, title: string) {
  const { data } = await client.post('/colab/boards/', { workspace: workspaceId, title })
  return data as Board
}

export async function getBoard(id: number) {
  const { data } = await client.get(`/colab/boards/${id}/`)
  return data
}

export async function listColumns(boardId: number) {
  const { data } = await client.get('/colab/columns/', { params: { board: boardId } })
  return data
}

export async function createColumn(boardId: number, title: string, position: number) {
  const { data } = await client.post('/colab/columns/', { board: boardId, title, position })
  return data as Column
}

export async function listCards(columnId: number) {
  const { data } = await client.get('/colab/cards/', { params: { column: columnId } })
  return data
}

export async function createCard(columnId: number, title: string, body = '', position = 0) {
  const { data } = await client.post('/colab/cards/', {
    column: columnId,
    title,
    body,
    position,
  })
  return data as Card
}

export async function updateCard(id: number, changes: Partial<Card>) {
  const { data } = await client.patch(`/colab/cards/${id}/`, changes)
  return data as Card
}

export async function moveCard(id: number, columnId: number, position: number) {
  const { data } = await client.post(`/colab/cards/${id}/move/`, {
    column_id: columnId,
    position,
  })
  return data as Card
}

export interface CollaborationEvent {
  id: number
  actor: string
  actor_email: string
  event_type: string
  entity_type: string
  entity_id: number
  version: number
  payload: Record<string, any>
  timestamp: string
}

export async function listEvents(params: { board?: number; event_type?: string; entity_type?: string; start?: string; end?: string }) {
  const { data } = await client.get('/colab/events/', { params })
  return data
}

export async function deleteCard(id: number) {
  await client.delete(`/colab/cards/${id}/`)
}
