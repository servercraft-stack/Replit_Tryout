import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { executeCode, getAvailableLanguages, type ExecutionResult } from '../api/executor'

interface Props {
  projectId: number
  initialCode?: string
  initialLanguage?: string
}

const LANGUAGE_ICONS: Record<string, { color: string; label: string }> = {
  python: { color: '#3572A5', label: 'PY' },
  javascript: { color: '#f1e05a', label: 'JS' },
  c: { color: '#555555', label: 'C' },
  cpp: { color: '#f34b7d', label: 'C++' },
  java: { color: '#b07219', label: 'JV' },
  go: { color: '#00ADD8', label: 'GO' },
  rust: { color: '#dea584', label: 'RS' },
  ruby: { color: '#701516', label: 'RB' },
  bash: { color: '#89e051', label: 'SH' },
}

export default function TerminalPanel({ projectId, initialCode, initialLanguage }: Props) {
  const user = useAuthStore((s) => s.user)
  const [mode, setMode] = useState<'terminal' | 'execute'>('execute')
  const [language, setLanguage] = useState(initialLanguage || 'python')
  const [code, setCode] = useState(initialCode || '')
  const [output, setOutput] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ExecutionResult | null>(null)
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadLanguages()
  }, [])

  useEffect(() => {
    if (initialCode) setCode(initialCode)
    if (initialLanguage) setLanguage(initialLanguage)
  }, [initialCode, initialLanguage])

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output, result])

  async function loadLanguages() {
    try {
      const data = await getAvailableLanguages()
      setAvailableLanguages(data.languages)
    } catch {
      setAvailableLanguages(['python', 'javascript'])
    }
  }

  async function handleRun() {
    if (!code.trim() || running) return
    setRunning(true)
    setResult(null)
    setOutput((prev) => [...prev, `\x1b[2m$ ${language} \x1b[0m`])

    try {
      const res = await executeCode(language, code)
      setResult(res)
      if (res.output) {
        setOutput((prev) => [...prev, res.output])
      }
      if (res.error) {
        setOutput((prev) => [...prev, `\x1b[31m${res.error}\x1b[0m`])
      }
      if (res.exit_code === 0 && !res.output && !res.error) {
        setOutput((prev) => [...prev, '\x1b[2m(no output)\x1b[0m'])
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Execution failed'
      setOutput((prev) => [...prev, `\x1b[31m${msg}\x1b[0m`])
    } finally {
      setRunning(false)
    }
  }

  function clearOutput() {
    setOutput([])
    setResult(null)
  }

  const langInfo = LANGUAGE_ICONS[language] || { color: '#6b7280', label: language.slice(0, 2).toUpperCase() }

  return (
    <div className={`${collapsed ? 'h-8' : 'h-64'} bg-surface-0 border-t border-border flex flex-col transition-all duration-300`}>
      {/* Header */}
      <div className="h-8 bg-surface-1 border-b border-border flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => setCollapsed(!collapsed)} className="text-zinc-500 hover:text-white transition-colors">
            <svg className={`w-3 h-3 transition-transform duration-200 ${collapsed ? '' : 'rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Language selector */}
          <div className="flex gap-1">
            {availableLanguages.slice(0, 6).map((lang) => {
              const info = LANGUAGE_ICONS[lang] || { color: '#6b7280', label: lang.slice(0, 2).toUpperCase() }
              return (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-all duration-200 ${
                    language === lang
                      ? 'text-white scale-110'
                      : 'text-zinc-600 hover:text-zinc-400 hover:scale-105'
                  }`}
                  style={{ backgroundColor: language === lang ? info.color : 'transparent' }}
                  title={lang}
                >
                  {info.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={clearOutput}
            className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
            title="Clear output"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button
            onClick={handleRun}
            disabled={running || !code.trim()}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-[10px] font-semibold rounded-md transition-all duration-200 hover:scale-105 active:scale-95"
          >
            {running ? (
              <>
                <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Running...
              </>
            ) : (
              <>
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
                Run
              </>
            )}
          </button>
        </div>
      </div>

      {/* Output */}
      {!collapsed && (
        <div ref={outputRef} className="flex-1 overflow-y-auto p-3 font-mono text-xs">
          {output.length === 0 && !result && (
            <div className="text-zinc-600 flex items-center gap-2">
              <span className="text-lg">&#9657;</span>
              <span>Write code above and press Run, or select a language to start.</span>
            </div>
          )}
          {output.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap leading-relaxed" style={{ color: getLineColor(line) }}>
              {stripAnsi(line)}
            </div>
          ))}
          {result && (
            <div className={`mt-2 px-2 py-1 rounded text-[10px] ${
              result.exit_code === 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            }`}>
              Process exited with code {result.exit_code}
              {result.timed_out && ' (timed out)'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function getLineColor(line: string): string {
  if (line.includes('\x1b[31m') || line.toLowerCase().includes('error')) return '#f87171'
  if (line.includes('\x1b[32m')) return '#4ade80'
  if (line.includes('\x1b[2m')) return '#71717a'
  return '#e4e4e7'
}

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '')
}
