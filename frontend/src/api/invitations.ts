import client from './client'

export interface Invitation {
  id: number
  workspace: string
  workspace_name: string
  email: string
  invited_by: string
  invited_by_detail: { id: string; email: string; first_name: string; last_name: string }
  role: string
  status: string
  token: string
  created_at: string
}

export async function sendInvitation(workspaceId: string, email: string, role = 'editor') {
  const { data } = await client.post('/colab/invitations/', {
    workspace: workspaceId,
    email,
    role,
  })
  return data as Invitation
}

export async function listInvitations(workspaceId?: string) {
  const params = workspaceId ? { workspace: workspaceId } : {}
  const { data } = await client.get('/colab/invitations/', { params })
  return data
}

export async function listMyInvitations() {
  const { data } = await client.get('/colab/invitations/my/')
  return data as Invitation[]
}

export async function acceptInvitation(token: string) {
  const { data } = await client.post('/colab/invitations/accept/', { token })
  return data as { message: string; workspace: { id: string; name: string } }
}
