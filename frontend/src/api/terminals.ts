import client from './client'

export interface TerminalSession {
  id: number
  project: number
  user: string
  name: string
  shell_type: 'bash' | 'python'
  pid: number | null
  status: string
  created_at: string
  updated_at: string
}

export async function listTerminals(projectId?: number) {
  const params = projectId ? { project: projectId } : {}
  const { data } = await client.get('/colab/terminals/', { params })
  return data
}

export async function createTerminal(projectId: number, name = 'Terminal', shellType: 'bash' | 'python' = 'bash') {
  const { data } = await client.post('/colab/terminals/', {
    project: projectId,
    name,
    shell_type: shellType,
  })
  return data as TerminalSession
}

export async function getTerminal(id: number) {
  const { data } = await client.get(`/colab/terminals/${id}/`)
  return data as TerminalSession
}
