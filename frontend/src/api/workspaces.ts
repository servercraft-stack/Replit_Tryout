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

export interface WorkspaceMember {
  id: string
  user: string
  user_detail: { id: string; email: string; first_name: string; last_name: string }
  role: 'owner' | 'admin' | 'editor' | 'viewer'
  joined_at: string
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

export async function updateWorkspace(id: string, name: string) {
  const { data } = await client.patch(`/colab/workspaces/${id}/`, { name })
  return data as Workspace
}

export async function deleteWorkspace(id: string) {
  await client.delete(`/colab/workspaces/${id}/`)
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

export async function updateMember(workspaceId: string, memberId: string, role: string) {
  const { data } = await client.put(`/colab/workspaces/${workspaceId}/members/${memberId}/`, { role })
  return data as WorkspaceMember
}

export async function deleteMember(workspaceId: string, memberId: string) {
  await client.delete(`/colab/workspaces/${workspaceId}/members/${memberId}/`)
}

export async function listMyInvitations() {
  const { data } = await client.get('/colab/invitations/my/')
  return data as any[]
}

export async function acceptInvitation(token: string) {
  const { data } = await client.post('/colab/invitations/accept/', { token })
  return data as { message: string; workspace: { id: string; name: string } }
}
