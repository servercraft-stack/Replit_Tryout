import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProject, getFileTree, createFileNode, deleteFileNode, updateFileContent, type Project, type FileNode } from '../api/files'
import { useAuthStore } from '../store/authStore'
import FileTree from '../components/FileTree'
import CodeEditor, { type CodeEditorRef } from '../components/CodeEditor'
import CollaborationPanel from '../components/CollaborationPanel'
import TerminalPanel from '../components/TerminalPanel'

export default function WorkspacePage() {
  const { workspaceId, projectId } = useParams<{ workspaceId: string; projectId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [project, setProject] = useState<Project | null>(null)
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [openFiles, setOpenFiles] = useState<FileNode[]>([])
  const [activeFile, setActiveFile] = useState<FileNode | null>(null)
  const [showTerminal, setShowTerminal] = useState(false)
  const [terminalCommand, setTerminalCommand] = useState('')
  const [showCollab, setShowCollab] = useState(true)
  const [newFileName, setNewFileName] = useState('')
  const [newFileParentId, setNewFileParentId] = useState<string | null>(null)
  const [showNewFile, setShowNewFile] = useState(false)
  const [newFileType, setNewFileType] = useState<'file' | 'dir'>('file')
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const id = Number(projectId)
  const editorRef = useRef<CodeEditorRef>(null)

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

  function closeFile(fileId: string) {
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

  function handleDirtyChange(fileId: string, isDirty: boolean) {
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
    const file = await createFileNode(project.id, newFileName.trim(), newFileType, newFileParentId)
    setNewFileName('')
    setNewFileParentId(null)
    setShowNewFile(false)
    setFileTree((prev) => [...prev, file])
    if (file.node_type === 'file') openFile(file)
  }

  async function handleDeleteFile(fileId: string) {
    await deleteFileNode(fileId)
    setFileTree((prev) => prev.filter((f) => f.id !== fileId))
    closeFile(fileId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-muted">Project not found.</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="h-12 bg-surface-1/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/workspaces/${workspaceId}/projects`)} className="text-text-muted hover:text-text-primary transition-colors p-1.5 rounded-lg hover:bg-surface-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/20">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-text-primary">{project.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTerminal((shown) => !shown)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              'text-text-muted hover:text-text-primary hover:bg-surface-2 border border-transparent'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5h15m-15 4.5h15m-15 4.5h15M5.25 19.5h15" />
            </svg>
            {showTerminal ? 'Hide Terminal' : 'Bash Terminal'}
          </button>
          <button
            onClick={() => setShowCollab(!showCollab)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              showCollab
                ? 'bg-accent/10 text-accent border border-accent/20'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-2 border border-transparent'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Collaborators
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* File tree sidebar */}
        <div className="w-56 bg-surface-1/60 backdrop-blur-xl border-r border-border flex flex-col shrink-0">
          <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Files</span>
            <button
              onClick={() => setShowNewFile(!showNewFile)}
              className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-md hover:bg-surface-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {showNewFile && (
            <form onSubmit={handleCreateFile} className="px-3 py-2.5 border-b border-border space-y-2">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setNewFileType('file')}
                  className={`flex-1 text-[10px] py-1.5 rounded-lg font-medium transition-all ${
                    newFileType === 'file'
                      ? 'bg-accent/10 text-accent border border-accent/20'
                      : 'bg-surface-2 text-text-muted border border-transparent hover:text-text-secondary'
                  }`}
                >
                  File
                </button>
                <button
                  type="button"
                  onClick={() => setNewFileType('dir')}
                  className={`flex-1 text-[10px] py-1.5 rounded-lg font-medium transition-all ${
                    newFileType === 'dir'
                      ? 'bg-accent/10 text-accent border border-accent/20'
                      : 'bg-surface-2 text-text-muted border border-transparent hover:text-text-secondary'
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
                className="input text-xs py-1.5"
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
                setNewFileParentId(parentId)
                setShowNewFile(true)
              }}
            />
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          {openFiles.length > 0 && (
            <div className="flex bg-surface-1/80 backdrop-blur-xl border-b border-border overflow-x-auto shrink-0">
              {openFiles.map((file) => (
                <button
                  key={file.id}
                  onClick={() => setActiveFile(file)}
                  className={`flex items-center gap-2 px-3 py-2 text-xs border-r border-border transition-all duration-200 min-w-[120px] max-w-[200px] ${
                    activeFile?.id === file.id
                      ? 'bg-surface-0 text-text-primary border-b-2 border-b-accent -mb-px'
                      : 'text-text-muted hover:text-text-secondary hover:bg-surface-2/50'
                  }`}
                >
                  <FileIcon language={file.language} />
                  <span className="truncate">{file.name}</span>
                  {dirtyFiles.has(file.id) && (
                    <span className="text-amber-400 text-lg leading-none ml-auto">●</span>
                  )}
                  <span
                    onClick={(e) => { e.stopPropagation(); closeFile(file.id) }}
                    className="ml-auto text-text-muted hover:text-text-primary transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </span>
                </button>
              ))}
              {activeFile && (
                <button
                  onClick={async () => {
                    await editorRef.current?.saveContent()
                    const cmd = getRunCommand(activeFile)
                    if (cmd) {
                      setShowTerminal(true)
                      setTerminalCommand(cmd)
                    }
                  }}
                  className="px-3 py-2 text-xs border-r border-border flex items-center gap-1.5 text-emerald-400 hover:bg-surface-2/50"
                  title={`Run ${activeFile.name}`}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                  </svg>
                  Run
                </button>
              )}
            </div>
          )}

          {/* Editor + Terminal */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeFile ? (
              <CodeEditor
                ref={editorRef}
                file={activeFile}
                onFileUpdate={updateFileInTree}
                onDirtyChange={handleDirtyChange}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center bg-surface-0">
                <div className="text-center animate-fade-in-up">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-surface-2 flex items-center justify-center border border-border">
                    <svg className="w-10 h-10 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                    </svg>
                  </div>
                  <p className="text-text-secondary text-sm font-medium">Open a file from the sidebar</p>
                  <p className="text-text-muted text-xs mt-1">or create a new one with the + button</p>
                </div>
              </div>
            )}

            {showTerminal && <TerminalPanel projectId={project.id} onClose={() => { setShowTerminal(false); setTerminalCommand('') }} commandToSend={terminalCommand} />}

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
      className="w-3.5 h-3.5 rounded flex items-center justify-center text-[7px] font-bold text-white shrink-0"
      style={{ backgroundColor: color }}
    >
      {(language || 'f')[0].toUpperCase()}
    </div>
  )
}

function getRunCommand(file: { name: string; language: string | null }): string {
  const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : ''
  const language = file.language || ''

  if (language === 'python' || ext === 'py') return `python "${file.name}"`
  if (language === 'javascript' || ext === 'js') return `node "${file.name}"`
  if (language === 'typescript' || ext === 'ts') return `npx tsx "${file.name}"`
  if (language === 'bash' || ext === 'sh' || ext === 'bash') return `bash "${file.name}"`
  return ''
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
