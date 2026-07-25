import client from './client'

export interface Project {
  id: number
  workspace: string
  name: string
  description: string
  file_count: number
  terminal_count: number
  created_at: string
  updated_at: string
}

export interface FileNode {
  id: number
  project: number
  parent: number | null
  name: string
  node_type: 'file' | 'dir'
  language: string | null
  icon: string
  content: string
  version: number
  children: FileNode[] | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface DiagnosticError {
  line: number
  column: number
  message: string
  severity: 'error' | 'warning'
}

export async function listProjects(workspaceId?: string) {
  const params = workspaceId ? { workspace: workspaceId } : {}
  const { data } = await client.get('/colab/projects/', { params })
  return data
}

export async function createProject(workspaceId: string, name: string, description = '') {
  const { data } = await client.post('/colab/projects/', {
    workspace: workspaceId,
    name,
    description,
  })
  return data as Project
}

export async function getProject(id: number) {
  const { data } = await client.get(`/colab/projects/${id}/`)
  return data as Project
}

export async function listFiles(projectId: number, parentId?: number | null) {
  const params: Record<string, any> = { project: projectId }
  if (parentId === null) params.parent = ''
  else if (parentId !== undefined) params.parent = parentId
  const { data } = await client.get('/colab/files/', { params })
  return data
}

export async function getFileTree(projectId: number) {
  // Get root files, then recursively build tree
  const rootFiles = await listFiles(projectId, null)
  const items = Array.isArray(rootFiles) ? rootFiles : rootFiles.results || []

  async function loadChildren(node: FileNode): Promise<FileNode> {
    if (node.node_type === 'dir') {
      const children = await listFiles(projectId, node.id)
      node.children = Array.isArray(children) ? children : children.results || []
      for (const child of node.children) {
        await loadChildren(child)
      }
    }
    return node
  }

  for (const item of items) {
    await loadChildren(item)
  }

  return items
}

export async function createFileNode(
  projectId: number,
  name: string,
  nodeType: 'file' | 'dir',
  parentId: number | null = null,
) {
  const { data } = await client.post('/colab/files/', {
    project: projectId,
    parent: parentId,
    name,
    node_type: nodeType,
  })
  return data as FileNode
}

export async function getFileContent(id: number) {
  const { data } = await client.get(`/colab/files/${id}/content/`)
  return data as { id: number; content: string; version: number }
}

export async function updateFileContent(id: number, content: string) {
  const { data } = await client.patch(`/colab/files/${id}/content/`, { content })
  return data as { id: number; content: string; version: number }
}

export async function deleteFileNode(id: number) {
  await client.delete(`/colab/files/${id}/`)
}

export async function getDiagnostics(fileId: number, content: string) {
  const { data } = await client.post(`/colab/files/${fileId}/diagnostics/`, { content })
  return data as { errors: DiagnosticError[]; warnings: DiagnosticError[] }
}
