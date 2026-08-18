import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { oneDark } from '@codemirror/theme-one-dark'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { bracketMatching } from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import * as Y from 'yjs'
import { yCollab } from 'y-codemirror.next'
import { useAuthStore } from '../store/authStore'
import { getFileContent, updateFileContent } from '../api/files'
import { SocketYjsProvider } from '../lib/socketYjsProvider'

export default function FileEditorPage() {
  const { fileId } = useParams<{ fileId: string }>()
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.accessToken)
  const editorRef = useRef<HTMLDivElement>(null)
  const [fileName, setFileName] = useState('')
  const [version, setVersion] = useState(0)
  const [peers, setPeers] = useState<Map<string, string>>(new Map())
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const providerRef = useRef<SocketYjsProvider | null>(null)
  const viewRef = useRef<EditorView | null>(null)

  const id = fileId || ''

  useEffect(() => {
    let destroyed = false

    async function init() {
      try {
        const file = await getFileContent(id)
        setVersion(file.version)
        setFileName(`File #${id}`)
      } catch {
        // File might not exist
      }

      if (destroyed || !editorRef.current || !token) return

      const ydoc = new Y.Doc()

      const provider = new SocketYjsProvider(String(id), ydoc, token)
      providerRef.current = provider

      provider.socket.addEventListener('open', () => setConnected(true))
      provider.socket.addEventListener('close', () => setConnected(false))

      provider.awareness.on('change', () => {
        const states = provider.awareness.getStates()
        const peers = new Map<string, string>()
        states.forEach((state, clientId) => {
          if (state.user) {
            peers.set(String(clientId), state.user.name || 'Anonymous')
          }
        })
        setPeers(peers)
      })

      provider.awareness.setLocalStateField('user', {
        name: useAuthStore.getState().user?.first_name || 'Anonymous',
        color: '#6366f1',
      })

      const ytext = ydoc.getText('content')

      if (ytext.length === 0) {
        try {
          const file = await getFileContent(id)
          if (file.content && ytext.length === 0) {
            ydoc.transact(() => {
              ytext.insert(0, file.content)
            })
          }
        } catch {
          // ignore
        }
      }

      const lastSavedRef = { content: ytext.toString(), saving: false }
      const snapshotInterval = setInterval(async () => {
        try {
          const current = ytext.toString()
          if (current !== lastSavedRef.content && !lastSavedRef.saving) {
            lastSavedRef.saving = true
            try {
              await updateFileContent(id, current)
              lastSavedRef.content = current
              setVersion((v) => v + 1)
            } catch (err) {
              console.error('Snapshot save failed', err)
            } finally {
              lastSavedRef.saving = false
            }
          }
        } catch (err) {
          // ignore
        }
      }, 5000)

      const lang = fileName.endsWith('.py') ? python() : javascript()

      const state = EditorState.create({
        doc: ytext.toString(),
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          history(),
          bracketMatching(),
          highlightSelectionMatches(),
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
          lang,
          oneDark,
          syntaxHighlighting(defaultHighlightStyle),
          EditorView.theme({
            '&': { height: '100%' },
            '.cm-scroller': { overflow: 'auto' },
          }),
          yCollab(ytext, provider.awareness, { undoManager: new Y.UndoManager(ytext) }),
        ],
      })

      const view = new EditorView({
        state,
        parent: editorRef.current,
      })
      viewRef.current = view

      const interval = setInterval(() => {
        setVersion((v) => v)
      }, 5000)

      return () => {
        clearInterval(interval)
        view.destroy()
        provider.destroy()
        ydoc.destroy()
      }
    }

    init()

    return () => {
      destroyed = true
      providerRef.current?.destroy()
      viewRef.current?.destroy()
    }
  }, [id, token])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0 bg-surface-1/80 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-text-muted hover:text-text-primary transition-colors p-1.5 rounded-lg hover:bg-surface-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-surface-2 flex items-center justify-center">
              <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-text-primary">{fileName}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Connection status */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success' : 'bg-text-muted'} ${connected ? 'animate-pulse-ring' : ''}`} />
            <span className="text-xs text-text-muted">
              {connected ? 'Connected' : 'Connecting...'}
            </span>
          </div>

          {/* Peers */}
          <div className="flex -space-x-1.5">
            {Array.from(peers.entries()).map(([id, name]) => (
              <div
                key={id}
                className="w-6 h-6 rounded-full bg-gradient-to-br from-accent/20 to-purple-500/20 border-2 border-surface-0 flex items-center justify-center text-accent text-[10px] font-semibold"
                title={name}
              >
                {name[0]?.toUpperCase()}
              </div>
            ))}
          </div>

          <span className="text-xs text-text-muted">v{version}</span>
        </div>
      </div>

      {/* Editor */}
      <div ref={editorRef} className="flex-1 overflow-hidden bg-surface-0" />
    </div>
  )
}
