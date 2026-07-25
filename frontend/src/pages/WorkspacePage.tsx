import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProject, getFileTree, createFileNode, deleteFileNode, type Project, type FileNode } from '../api/files'
import { useAuthStore } from '../store/authStore'
import FileTree from '../components/FileTree'
import CodeEditor from '../components/CodeEditor'
import TerminalPanel from '../components/TerminalPanel'
import CollaborationPanel from '../components/CollaborationPanel'

export default function WorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [project, setProject] = useState<Project | null>(null)
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [openFiles, setOpenFiles] = useState<FileNode[]>([])
  const [activeFile, setActiveFile] = useState<FileNode | null>(null)
  const [showTerminal, setShowTerminal] = useState(false)
  const [showCollab, setShowCollab] = useState(true)
  const [newFileName, setNewFileName] = useState('')
  const [showNewFile, setShowNewFile] = useState(false)
  const [newFileType, setNewFileType] = useState<'file' | 'dir'>('file')
  const [dirtyFiles, setDirtyFiles] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const id = Number(projectId)

  useEffect(() => {
    loadProject()
  }, [id])

  async function loadProject() {
    try {
      const p = await getProject(id)
      setProject(p)
      const tree = await getFileTree(id)
      setFileTree(tree)
    } catch {
      // project not found
    } finally {
      setLoading(false)
    }
  }

  function openFile(file: FileNode) {
    if (file.node_type === 'dir') return
    if (!openFiles.find((f) => f.id === file.id)) {
      setOpenFiles((prev) => [...prev, file])
    }
    setActiveFile(file)
  }

  function closeFile(fileId: number) {
    setOpenFiles((prev) => prev.filter((f) => f.id !== fileId))
    setDirtyFiles((prev) => {
      const next = new Set(prev)
      next.delete(fileId)
      return next
    })
    if (activeFile?.id === fileId) {
      setOpenFiles((prev) => {
        const remaining = prev.filter((f) => f.id !== fileId)
        setActiveFile(remaining.length > 0 ? remaining[remaining.length - 1] : null)
        return prev
      })
    }
  }

  function handleDirtyChange(fileId: number, isDirty: boolean) {
    setDirtyFiles((prev) => {
      const next = new Set(prev)
      if (isDirty) next.add(fileId)
      else next.delete(fileId)
      return next
    })
  }

  function updateFileInTree(updated: FileNode) {
    setActiveFile(updated)
    setOpenFiles((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
  }

  async function handleCreateFile(e: React.FormEvent) {
    e.preventDefault()
    if (!newFileName.trim() || !project) return
    const file = await createFileNode(project.id, newFileName.trim(), newFileType, null)
    setNewFileName('')
    setShowNewFile(false)
    setFileTree((prev) => [...prev, file])
    if (file.node_type === 'file') openFile(file)
  }

  async function handleDeleteFile(fileId: number) {
    await deleteFileNode(fileId)
    setFileTree((prev) => prev.filter((f) => f.id !== fileId))
    closeFile(fileId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-zinc-500">Project not found.</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="h-11 bg-surface-1 border-b border-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-zinc-500 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="text-sm font-semibold text-white">{project.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTerminal(!showTerminal)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              showTerminal ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-white hover:bg-surface-3'
            }`}
          >
            Terminal
          </button>
          <button
            onClick={() => setShowCollab(!showCollab)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              showCollab ? 'bg-accent/20 text-accent' : 'text-zinc-500 hover:text-white hover:bg-surface-3'
            }`}
          >
            Collaborators
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* File tree sidebar */}
        <div className="w-56 bg-surface-1 border-r border-border flex flex-col shrink-0">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Files</span>
            <button
              onClick={() => setShowNewFile(!showNewFile)}
              className="text-zinc-500 hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {showNewFile && (
            <form onSubmit={handleCreateFile} className="px-3 py-2 border-b border-border space-y-1.5">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setNewFileType('file')}
                  className={`flex-1 text-[10px] py-1 rounded transition-colors ${
                    newFileType === 'file' ? 'bg-accent/20 text-accent' : 'bg-surface-3 text-zinc-500'
                  }`}
                >
                  File
                </button>
                <button
                  type="button"
                  onClick={() => setNewFileType('dir')}
                  className={`flex-1 text-[10px] py-1 rounded transition-colors ${
                    newFileType === 'dir' ? 'bg-accent/20 text-accent' : 'bg-surface-3 text-zinc-500'
                  }`}
                >
                  Folder
                </button>
              </div>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder={newFileType === 'dir' ? 'folder-name' : 'filename.py'}
                className="w-full px-2 py-1 bg-surface-2 border border-border rounded text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-accent/50"
                autoFocus
              />
            </form>
          )}

          <div className="flex-1 overflow-y-auto py-1">
            <FileTree
              files={fileTree}
              activeFile={activeFile}
              onOpenFile={openFile}
              onDeleteFile={handleDeleteFile}
              onRefresh={loadProject}
              onCreateFile={(parentId) => {
                setNewFileName('')
                setShowNewFile(true)
              }}
            />
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          {openFiles.length > 0 && (
            <div className="flex bg-surface-1 border-b border-border overflow-x-auto shrink-0">
              {openFiles.map((file) => (
                <button
                  key={file.id}
                  onClick={() => setActiveFile(file)}
                  className={`flex items-center gap-2 px-3 py-2 text-xs border-r border-border transition-colors ${
                    activeFile?.id === file.id
                      ? 'bg-surface-0 text-white'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-surface-2'
                  }`}
                >
                  <FileIcon language={file.language} />
                  <span>{file.name}</span>
                  {dirtyFiles.has(file.id) && (
                    <span className="text-amber-400 text-lg leading-none">&#9679;</span>
                  )}
                  <span
                    onClick={(e) => { e.stopPropagation(); closeFile(file.id) }}
                    className="ml-1 text-zinc-600 hover:text-zinc-300"
                  >
                    &times;
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Editor + Terminal */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeFile ? (
              <CodeEditor
                file={activeFile}
                onFileUpdate={updateFileInTree}
                onDirtyChange={handleDirtyChange}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center bg-surface-0">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-surface-2 flex items-center justify-center">
                    <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                    </svg>
                  </div>
                  <p className="text-zinc-500 text-sm">Open a file from the sidebar</p>
                  <p className="text-zinc-600 text-xs mt-1">or create a new one with the + button</p>
                </div>
              </div>
            )}

            {showTerminal && (
              <TerminalPanel
                projectId={project.id}
                initialCode={activeFile?.content || ''}
                initialLanguage={activeFile?.language || 'python'}
              />
            )}
          </div>
        </div>

        {/* Collaboration sidebar */}
        {showCollab && activeFile && (
          <CollaborationPanel fileId={activeFile.id} />
        )}
      </div>
    </div>
  )
}

function FileIcon({ language }: { language: string | null }) {
  const color = LANGUAGE_COLORS[language || ''] || '#6b7280'
  return (
    <div
      className="w-3.5 h-3.5 rounded flex items-center justify-center text-[7px] font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {(language || 'f')[0].toUpperCase()}
    </div>
  )
}

const LANGUAGE_COLORS: Record<string, string> = {
  python: '#3572A5',
  javascript: '#f1e05a',
  typescript: '#3178c6',
  html: '#e34c26',
  css: '#563d7c',
  json: '#292929',
  markdown: '#083fa1',
  bash: '#89e051',
  yaml: '#cb171e',
  toml: '#9c4221',
  sql: '#e38c00',
  java: '#b07219',
  go: '#00ADD8',
  rust: '#dea584',
  ruby: '#701516',
  php: '#4F5D95',
  c: '#555555',
  cpp: '#f34b7d',
  csharp: '#178600',
  swift: '#F05138',
  kotlin: '#A97BFF',
  r: '#198CE7',
  dockerfile: '#384d54',
  text: '#6b7280',
  env: '#ecd53f',
  gitignore: '#f05032',
}
