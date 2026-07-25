import { useState } from 'react'
import type { FileNode } from '../api/files'

interface Props {
  files: FileNode[]
  activeFile: FileNode | null
  onOpenFile: (file: FileNode) => void
  onDeleteFile: (fileId: number) => void
  onRefresh: () => void
  onCreateFile: (parentId: number | null) => void
  depth?: number
}

export default function FileTree({ files, activeFile, onOpenFile, onDeleteFile, onRefresh, onCreateFile, depth = 0 }: Props) {
  return (
    <div>
      {files.map((file) => (
        <FileTreeItem
          key={file.id}
          file={file}
          activeFile={activeFile}
          onOpenFile={onOpenFile}
          onDeleteFile={onDeleteFile}
          onRefresh={onRefresh}
          onCreateFile={onCreateFile}
          depth={depth}
        />
      ))}
    </div>
  )
}

function FileTreeItem({ file, activeFile, onOpenFile, onDeleteFile, onRefresh, onCreateFile, depth }: {
  file: FileNode
  activeFile: FileNode | null
  onOpenFile: (file: FileNode) => void
  onDeleteFile: (fileId: number) => void
  onRefresh: () => void
  onCreateFile: (parentId: number | null) => void
  depth: number
}) {
  const [expanded, setExpanded] = useState(depth < 1)
  const isActive = activeFile?.id === file.id
  const isDir = file.node_type === 'dir'

  return (
    <div>
      <button
        onClick={() => {
          if (isDir) {
            setExpanded(!expanded)
          } else {
            onOpenFile(file)
          }
        }}
        className={`w-full flex items-center gap-1.5 px-2 py-[3px] text-xs transition-colors group ${
          isActive ? 'bg-accent/10 text-accent' : 'text-zinc-400 hover:text-white hover:bg-surface-2'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isDir ? (
          <svg className={`w-3 h-3 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        ) : (
          <FileIconSmall language={file.language} />
        )}
        <span className="truncate">{file.name}</span>
        {!isDir && (
          <span
            onClick={(e) => { e.stopPropagation(); onDeleteFile(file.id) }}
            className="ml-auto opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        )}
      </button>
      {isDir && expanded && file.children && (
        <FileTree
          files={file.children}
          activeFile={activeFile}
          onOpenFile={onOpenFile}
          onDeleteFile={onDeleteFile}
          onRefresh={onRefresh}
          onCreateFile={onCreateFile}
          depth={depth + 1}
        />
      )}
    </div>
  )
}

const LANG_COLORS: Record<string, string> = {
  python: '#3572A5',
  javascript: '#f1e05a',
  typescript: '#3178c6',
  html: '#e34c26',
  css: '#563d7c',
  json: '#292929',
  bash: '#89e051',
  markdown: '#083fa1',
}

function FileIconSmall({ language }: { language: string | null }) {
  const color = LANG_COLORS[language || ''] || '#6b7280'
  return (
    <div
      className="w-3 h-3 rounded-[2px] shrink-0 flex items-center justify-center text-[6px] font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {(language || 'f')[0].toUpperCase()}
    </div>
  )
}
