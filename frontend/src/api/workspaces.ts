import client from './client'

export interface Workspace {
  id: string
  name: string
  owner: string
  owner_name: string
  member_count: number
  created_at: string
  updated_at: string
}

export async function listWorkspaces() {
  const { data } = await client.get('/colab/workspaces/')
  return data
}

export async function createWorkspace(name: string) {
  const { data } = await client.post('/colab/workspaces/', { name })
  return data as Workspace
}

export async function getWorkspace(id: string) {
  const { data } = await client.get(`/colab/workspaces/${id}/`)
  return data as Workspace
}

export async function listMembers(workspaceId: string) {
  const { data } = await client.get(`/colab/workspaces/${workspaceId}/members/`)
  return data
}

export async function addMember(workspaceId: string, userId: string, role: string) {
  const { data } = await client.post(`/colab/workspaces/${workspaceId}/members/`, {
    user: userId,
    role,
  })
  return data
}
