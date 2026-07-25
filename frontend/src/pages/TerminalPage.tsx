import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useAuthStore } from '../store/authStore'
import { getTerminal } from '../api/terminals'

export default function TerminalPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.accessToken)
  const termRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<string>('connecting')
  const [terminalInfo, setTerminalInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const id = Number(sessionId)

  useEffect(() => {
    async function init() {
      // Load terminal metadata
      try {
        const info = await getTerminal(id)
        setTerminalInfo(info)
      } catch {
        // Terminal might not exist
      }
      setLoading(false)
    }
    init()
  }, [id])

  useEffect(() => {
    if (loading || !termRef.current || !token) return

    // Create xterm instance
    const term = new Terminal({
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 14,
      theme: {
        background: '#0a0a0f',
        foreground: '#e4e4e7',
        cursor: '#6366f1',
        cursorAccent: '#0a0a0f',
        selectionBackground: '#6366f133',
        black: '#1a1a24',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#6366f1',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e4e4e7',
        brightBlack: '#3a3a4a',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#818cf8',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      cursorBlink: true,
      cursorStyle: 'bar',
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(termRef.current)

    // Fit to container
    setTimeout(() => fitAddon.fit(), 50)

    terminalRef.current = term

    // Connect WebSocket
    const wsUrl = `ws://${window.location.host}/ws/colab/terminal/${id}/?token=${token}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      term.focus()
      // Send initial size
      ws.send(JSON.stringify({
        type: 'terminal.resize',
        cols: term.cols,
        rows: term.rows,
      }))
    }

    ws.onmessage = (e) => {
      const event = JSON.parse(e.data)
      if (event.type === 'terminal.output') {
        term.write(event.data)
      }
    }

    ws.onclose = () => {
      setStatus('disconnected')
      term.write('\r\n\x1b[31m[Connection closed]\x1b[0m\r\n')
    }

    ws.onerror = () => {
      setStatus('error')
    }

    // Terminal input → WebSocket
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'terminal.input',
          data,
        }))
      }
    })

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'terminal.resize',
          cols: term.cols,
          rows: term.rows,
        }))
      }
    })
    resizeObserver.observe(termRef.current)

    return () => {
      resizeObserver.disconnect()
      ws.close()
      term.dispose()
    }
  }, [id, token, loading])

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
            <svg className={`w-4 h-4 ${terminalInfo?.shell_type === 'python' ? 'text-yellow-500' : 'text-emerald-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium text-white">
              {terminalInfo?.name || 'Terminal'}
            </span>
            {terminalInfo?.shell_type && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                terminalInfo.shell_type === 'python'
                  ? 'bg-yellow-500/10 text-yellow-400'
                  : 'bg-emerald-500/10 text-emerald-400'
              }`}>
                {terminalInfo.shell_type === 'python' ? 'Python' : 'Bash'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            status === 'connected' ? 'bg-emerald-500' :
            status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
            'bg-zinc-600'
          }`} />
          <span className="text-xs text-zinc-500">
            {status === 'connected' ? 'Connected' :
             status === 'connecting' ? 'Connecting...' :
             status === 'disconnected' ? 'Disconnected' : 'Error'}
          </span>
        </div>
      </div>

      {/* Terminal */}
      <div ref={termRef} className="flex-1 bg-[#0a0a0f] p-2" />
    </div>
  )
}
