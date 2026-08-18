import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { createTerminal } from '../api/terminals'
import { useAuthStore } from '../store/authStore'

interface Props {
  projectId: number
  onClose: () => void
  commandToSend?: string
}

export default function TerminalPanel({ projectId, onClose, commandToSend }: Props) {
  const token = useAuthStore((state) => state.accessToken)
  const terminalHost = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const pendingCommandRef = useRef<string>('')
  const [minimized, setMinimized] = useState(false)
  const [status, setStatus] = useState('Starting Bash')

  useEffect(() => {
    if (!commandToSend) return
    pendingCommandRef.current = commandToSend
    const socket = socketRef.current
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'input', data: commandToSend + '\n' }))
      pendingCommandRef.current = ''
    }
  }, [commandToSend])

  useEffect(() => {
    if (!terminalHost.current || !token) return
    let disposed = false
    let observer: ResizeObserver | undefined
    let fit: FitAddon | undefined
    const sendResize = () => {
      const socket = socketRef.current
      const terminal = terminalRef.current
      if (socket?.readyState === WebSocket.OPEN && terminal) socket.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }))
    }
    const start = async () => {
      try {
        const session = await createTerminal(projectId, 'Bash', 'bash')
        if (disposed || !terminalHost.current) return
        const terminal = new Terminal({ allowProposedApi: true, cursorBlink: true, cursorStyle: 'bar', fontFamily: "'Cascadia Code', 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace", fontSize: 13, lineHeight: 1.35, scrollback: 10000, theme: { background: '#1e1e1e', foreground: '#d4d4d4', cursor: '#aeafad', selectionBackground: '#264f78', black: '#000000', red: '#cd3131', green: '#0dbc79', yellow: '#e5e510', blue: '#2472c8', magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5', brightBlack: '#666666', brightRed: '#cd3131', brightGreen: '#23d18b', brightYellow: '#f5f543', brightBlue: '#3b8eea', brightMagenta: '#d670d6', brightCyan: '#29b8db', brightWhite: '#e5e5e5' } })
        fit = new FitAddon()
        terminal.loadAddon(fit)
        terminal.open(terminalHost.current)
        terminalRef.current = terminal
        requestAnimationFrame(() => {
          fit?.fit()
          sendResize()
          terminal.focus()
        })
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
        const socket = new WebSocket(`${protocol}://${window.location.host}/ws/colab/terminal/${session.id}/?token=${encodeURIComponent(token)}`)
        socketRef.current = socket
        socket.addEventListener('open', () => {
          setStatus('Bash')
          sendResize()
          terminal.focus()
          const cmd = pendingCommandRef.current
          if (cmd) {
            socket.send(JSON.stringify({ type: 'input', data: cmd + '\n' }))
            pendingCommandRef.current = ''
          }
        })
        socket.addEventListener('message', (event) => {
          const message = JSON.parse(event.data)
          if (message.type === 'output') terminal.write(message.data)
        })
        socket.addEventListener('close', () => { if (!disposed) setStatus('Disconnected') })
        socket.addEventListener('error', () => setStatus('Connection error'))
        terminal.onData((data) => {
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'input', data }))
        })
        observer = new ResizeObserver(() => {
          fit?.fit()
          sendResize()
        })
        observer.observe(terminalHost.current)
      } catch (error: any) {
        setStatus(error.response?.data?.detail || 'Unable to start Bash')
      }
    }
    void start()
    return () => {
      disposed = true
      observer?.disconnect()
      socketRef.current?.close()
      terminalRef.current?.dispose()
      terminalRef.current = null
    }
  }, [projectId, token])

  return <section className={`${minimized ? 'h-9' : 'h-[340px]'} shrink-0 flex flex-col border-t border-[#3c3c3c] bg-[#1e1e1e] text-[#cccccc] transition-[height] duration-150`}>
    <header className="h-9 shrink-0 flex items-center justify-between border-b border-[#3c3c3c] bg-[#252526] px-2 text-xs">
      <div className="flex h-full items-center gap-1"><button type="button" onClick={() => setMinimized((value) => !value)} className="px-2 text-[#cccccc] hover:bg-[#3c3c3c]" aria-label="Toggle terminal">{minimized ? '▸' : '▾'}</button><span className="flex h-full items-center border-b border-[#007acc] px-3 font-medium text-white">TERMINAL</span><span className="px-2 text-[#9d9d9d]">{status}</span></div>
      <div className="flex h-full items-center gap-1"><button type="button" onClick={() => terminalRef.current?.clear()} className="px-2 text-[#cccccc] hover:bg-[#3c3c3c]" aria-label="Clear terminal">⌫</button><button type="button" onClick={onClose} className="px-2 text-[#cccccc] hover:bg-[#3c3c3c]" aria-label="Close terminal">×</button></div>
    </header>
    <div ref={terminalHost} onClick={() => terminalRef.current?.focus()} className={minimized ? 'hidden' : 'min-h-0 flex-1 cursor-text px-2 py-2'} />
  </section>
}
