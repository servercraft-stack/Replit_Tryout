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
import { WebsocketProvider } from 'y-websocket'
import { useAuthStore } from '../store/authStore'
import { getFileContent } from '../api/files'

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
  const providerRef = useRef<WebsocketProvider | null>(null)
  const viewRef = useRef<EditorView | null>(null)

  const id = Number(fileId)

  useEffect(() => {
    let destroyed = false

    async function init() {
      // Load file metadata
      try {
        const file = await getFileContent(id)
        setVersion(file.version)
      } catch {
        // File might not exist
      }

      if (destroyed || !editorRef.current || !token) return

      // Create Yjs document
      const ydoc = new Y.YDoc()

      // Connect to WebSocket provider
      const wsUrl = `ws://${window.location.host}/ws/colab/files/${id}/?token=${token}`
      const provider = new WebsocketProvider(wsUrl, `file-${id}`, ydoc, {
        connect: true,
      })
      providerRef.current = provider

      provider.on('sync', (synced: boolean) => {
        setConnected(synced)
      })

      provider.on('status', ({ status }: { status: string }) => {
        setConnected(status === 'connected')
      })

      // Track awareness (other cursors)
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

      // Set local user awareness
      provider.awareness.setLocalStateField('user', {
        name: useAuthStore.getState().user?.first_name || 'Anonymous',
        color: '#6366f1',
      })

      // Get or create shared text type
      const ytext = ydoc.getText('content')

      // If the document is empty, set initial content
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

      // Detect language from file name
      const lang = fileName.endsWith('.py') ? python() : javascript()

      // Create CodeMirror editor
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
          // Yjs collaboration binding
          Y.yCollab(ytext, provider.awareness, { undoManager: new Y.UndoManager(ytext) }),
        ],
      })

      const view = new EditorView({
        state,
        parent: editorRef.current,
      })
      viewRef.current = view

      // Periodic version sync
      const interval = setInterval(() => {
        setVersion((v) => v) // trigger re-render for connection status
      }, 5000)

      return () => {
        clearInterval(interval)
        view.destroy()
        provider.disconnect()
        provider.destroy()
        ydoc.destroy()
      }
    }

    init()

    return () => {
      destroyed = true
      providerRef.current?.disconnect()
      providerRef.current?.destroy()
      viewRef.current?.destroy()
    }
  }, [id, token])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-zinc-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium text-white">File #{id}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
            <span className="text-xs text-zinc-500">
              {connected ? 'Connected' : 'Connecting...'}
            </span>
          </div>

          {/* Peers */}
          <div className="flex -space-x-1.5">
            {Array.from(peers.entries()).map(([id, name]) => (
              <div
                key={id}
                className="w-6 h-6 rounded-full bg-accent/20 border-2 border-surface-0 flex items-center justify-center text-accent text-[10px] font-semibold"
                title={name}
              >
                {name[0]?.toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Editor */}
      <div ref={editorRef} className="flex-1 overflow-hidden bg-[#1e1e2e]" />
    </div>
  )
}
