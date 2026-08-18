import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useAuthStore } from '../store/authStore'
import { getTerminal } from '../api/terminals'

export default function TerminalPage() {
  const { workspaceId, projectId, sessionId } = useParams<{ workspaceId: string; projectId: string; sessionId: string }>()
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.accessToken)
  const termRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const [status, setStatus] = useState<string>('connecting')
  const [terminalInfo, setTerminalInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const id = Number(sessionId)

  useEffect(() => {
    async function init() {
      try {
        const info = await getTerminal(id)
        setTerminalInfo(info)
      } catch {
        navigate('/')
      }
      setLoading(false)
    }
    init()
  }, [id])

  const initTerminal = useCallback(() => {
    if (!termRef.current || !token) return
    const term = new Terminal({
      fontFamily: "'Cascadia Code', 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.35,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#aeafad',
        cursorAccent: '#1e1e1e',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#cd3131',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      cursorBlink: true,
      cursorStyle: 'bar',
      allowProposedApi: true,
      scrollback: 10000,
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(termRef.current)
    setTimeout(() => fitAddon.fit(), 50)
    terminalRef.current = term
    fitRef.current = fitAddon
    return term
  }, [token])

  useEffect(() => {
    if (loading || !termRef.current || !token) return
    const term = initTerminal()
    if (!term) return

    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const socket = new WebSocket(`${scheme}://${window.location.host}/ws/colab/terminal/${id}/?token=${encodeURIComponent(token)}`)
    socketRef.current = socket

    socket.addEventListener('open', () => {
      setStatus('connected')
      term.focus()
      socket.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
    })
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.type === 'output') term.write(message.data)
    })
    socket.addEventListener('close', () => {
      setStatus('disconnected')
      term.write('\r\n\x1b[31m[Connection closed]\x1b[0m\r\n')
    })
    socket.addEventListener('error', () => setStatus('error'))

    term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'input', data }))
    })

    const resizeObserver = new ResizeObserver(() => {
      fitRef.current?.fit()
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
    })
    resizeObserver.observe(termRef.current)

    return () => {
      resizeObserver.disconnect()
      socket.close()
      term.dispose()
    }
  }, [id, token, loading, initTerminal])

  function handleReconnect() {
    window.location.reload()
  }

  function handleDisconnect() {
    socketRef.current?.close()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0 bg-surface-1/80 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/workspaces/${workspaceId || ''}/projects/${projectId || ''}/ide`)} className="text-text-muted hover:text-text-primary transition-colors p-1.5 rounded-lg hover:bg-surface-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${terminalInfo?.shell_type === 'python' ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'}`}>
              <svg className={`w-4 h-4 ${terminalInfo?.shell_type === 'python' ? 'text-yellow-400' : 'text-emerald-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5h15m-15 4.5h15m-15 4.5h15M5.25 19.5h15" />
              </svg>
            </div>
            <span className="text-sm font-medium text-text-primary">
              {terminalInfo?.name || 'Terminal'}
            </span>
            {terminalInfo?.shell_type && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                terminalInfo.shell_type === 'python'
                  ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {terminalInfo.shell_type === 'python' ? 'Python' : 'Bash'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {terminalInfo?.pid && (
              <span className="text-xs text-text-muted font-mono">PID: {terminalInfo.pid}</span>
            )}
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              terminalInfo?.status === 'running' ? 'badge-success' : terminalInfo?.status === 'stopped' ? 'badge-error' : 'badge-warning'
            }`}>
              {terminalInfo?.status || 'unknown'}
            </span>
            <div className={`w-2 h-2 rounded-full ${
              status === 'connected' ? 'bg-success' :
              status === 'connecting' ? 'bg-warning animate-pulse' :
              'bg-text-muted'
            }`} />
            <span className="text-xs text-text-muted">
              {status === 'connected' ? 'Connected' :
               status === 'connecting' ? 'Connecting...' :
               status === 'disconnected' ? 'Disconnected' : 'Error'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {status === 'disconnected' || status === 'error' ? (
              <button
                onClick={handleReconnect}
                className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-medium transition-colors"
              >
                Reconnect
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-text-muted border border-border rounded-lg text-xs font-medium transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      </div>

      <div ref={termRef} className="flex-1 bg-surface-0 p-2" />
    </div>
  )
}
