import { useEffect, useRef, useState, useCallback } from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { bracketMatching } from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useAuthStore } from '../store/authStore'
import { getFileContent, updateFileContent, getDiagnostics, type FileNode, type DiagnosticError } from '../api/files'
import DiagnosticPanel from './DiagnosticPanel'

interface Props {
  file: FileNode
  onFileUpdate: (file: FileNode) => void
  onDirtyChange?: (fileId: number, dirty: boolean) => void
}

function getLangExtension(language: string | null) {
  switch (language) {
    case 'python': return python()
    case 'javascript':
    case 'typescript':
    case 'jsx':
    case 'tsx': return javascript({ jsx: true, typescript: language === 'typescript' || language === 'tsx' })
    default: return javascript()
  }
}

export default function CodeEditor({ file, onFileUpdate, onDirtyChange }: Props) {
  const token = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)
  const [diagnostics, setDiagnostics] = useState<DiagnosticError[]>([])
  const [showDiagnostics, setShowDiagnostics] = useState(true)
  const [connected, setConnected] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const dirtyRef = useRef(false)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef('')

  // Mark dirty
  const markDirty = useCallback((isDirty: boolean) => {
    dirtyRef.current = isDirty
    setDirty(isDirty)
    onDirtyChange?.(file.id, isDirty)
  }, [file.id, onDirtyChange])

  // Save to backend
  const saveToBackend = useCallback(async (content: string) => {
    if (saving) return
    setSaving(true)
    try {
      const updated = await updateFileContent(file.id, content)
      markDirty(false)
      setLastSaved(new Date())
      onFileUpdate({ ...file, content, version: updated.version })
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }, [file, saving, markDirty, onFileUpdate])

  // Auto-save with 2s debounce
  const scheduleAutoSave = useCallback((content: string) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }
    autoSaveTimerRef.current = setTimeout(() => {
      saveToBackend(content)
    }, 2000)
  }, [saveToBackend])

  // Manual save (Ctrl+S)
  const manualSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }
    saveToBackend(contentRef.current)
  }, [saveToBackend])

  useEffect(() => {
    let destroyed = false
    let cleanup: (() => void) | null = null

    async function init() {
      if (!editorRef.current || !token) return

      // Load file content from backend
      let initialContent = ''
      try {
        const data = await getFileContent(file.id)
        initialContent = data.content
      } catch { /* empty file */ }

      if (destroyed) return
      contentRef.current = initialContent

      const ydoc = new Y.YDoc()
      const wsUrl = `ws://${window.location.host}/ws/colab/files/${file.id}/?token=${token}`
      const provider = new WebsocketProvider(wsUrl, `file-${file.id}`, ydoc, { connect: true })
      providerRef.current = provider

      provider.on('sync', (synced: boolean) => setConnected(synced))
      provider.on('status', ({ status }: { status: string }) => setConnected(status === 'connected'))

      provider.awareness.setLocalStateField('user', {
        name: user?.first_name || 'Anonymous',
        color: '#6366f1',
        userId: user?.id,
      })

      const ytext = ydoc.getText('content')
      if (ytext.length === 0 && initialContent) {
        ydoc.transact(() => { ytext.insert(0, initialContent) })
      }

      const lang = getLangExtension(file.language)
      const isDark = document.documentElement.classList.contains('dark')

      const state = EditorState.create({
        doc: ytext.toString(),
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          bracketMatching(),
          highlightSelectionMatches(),
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
            // Ctrl+S / Cmd+S to save
            {
              key: 'Mod-s',
              run: () => {
                manualSave()
                return true
              },
            },
          ]),
          lang,
          syntaxHighlighting(defaultHighlightStyle),
          EditorView.theme({
            '&': { height: '100%' },
            '.cm-scroller': { overflow: 'auto' },
            '.cm-gutters': {
              backgroundColor: isDark ? '#111118' : '#f8f9fa',
              borderRight: isDark ? '1px solid #2a2a3a' : '1px solid #e5e7eb',
            },
            '.cm-activeLineGutter': {
              backgroundColor: isDark ? '#1a1a24' : '#f0f1f3',
            },
          }),
          Y.yCollab(ytext, provider.awareness, { undoManager: new Y.UndoManager(ytext) }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const content = update.state.doc.toString()
              contentRef.current = content
              markDirty(true)
              scheduleAutoSave(content)
              runDiagnostics(content)
            }
          }),
        ],
      })

      const view = new EditorView({ state, parent: editorRef.current })
      viewRef.current = view
      runDiagnostics(ytext.toString())

      cleanup = () => {
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
        view.destroy()
        provider.disconnect()
        provider.destroy()
        ydoc.destroy()
      }
    }

    async function runDiagnostics(content: string) {
      try {
        const result = await getDiagnostics(file.id, content)
        setDiagnostics([...result.errors, ...result.warnings])
      } catch {
        setDiagnostics([])
      }
    }

    init()
    return () => { destroyed = true; cleanup?.() }
  }, [file.id, token])

  // Keyboard shortcut listener for Ctrl+S
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        manualSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [manualSave])

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
      <div ref={editorRef} className="flex-1 overflow-hidden" />

      {diagnostics.length > 0 && showDiagnostics && (
        <DiagnosticPanel diagnostics={diagnostics} onDismiss={() => setShowDiagnostics(false)} />
      )}

      {/* Status bar */}
      <div className="h-6 bg-surface-1 border-t border-border flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full transition-colors ${connected ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
            <span className="text-[10px] text-zinc-500">{connected ? 'Connected' : 'Connecting'}</span>
          </div>
          {file.language && (
            <span className="text-[10px] text-zinc-600 capitalize">{file.language}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <span className="text-[10px] text-amber-400 flex items-center gap-1">
              <span className="text-lg leading-none">&#9679;</span> Unsaved
            </span>
          )}
          {saving && (
            <span className="text-[10px] text-zinc-500 flex items-center gap-1">
              <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </span>
          )}
          {!dirty && lastSaved && (
            <span className="text-[10px] text-zinc-600">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
          {diagnostics.length > 0 && (
            <button onClick={() => setShowDiagnostics(!showDiagnostics)} className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors">
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              {diagnostics.length}
            </button>
          )}
          <span className="text-[10px] text-zinc-600">v{file.version}</span>
          <button
            onClick={manualSave}
            disabled={!dirty || saving}
            className="text-[10px] text-zinc-500 hover:text-white disabled:text-zinc-700 transition-colors"
            title="Save (Ctrl+S)"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
