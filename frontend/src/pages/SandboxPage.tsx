import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { executeCode, getAvailableLanguages, type ExecutionResult } from '../api/executor'
import Lightfall from '../components/Lightfall'
import { Shape3D, Card3D } from '../components/Shape3D'

export default function SandboxPage() {
  const navigate = useNavigate()
  const [languages, setLanguages] = useState<string[]>([])
  const [language, setLanguage] = useState('python')
  const [code, setCode] = useState('print("Hello 3D Lightfall World!")')
  const [result, setResult] = useState<ExecutionResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getAvailableLanguages().then((data) => {
      setLanguages(data.languages || [])
      if (data.languages?.length && !data.languages.includes(language)) {
        setLanguage(data.languages[0])
      }
    })
  }, [])

  async function handleRun() {
    setRunning(true)
    setResult(null)
    setError('')
    try {
      const res = await executeCode(language, code)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Execution failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-surface-0">
      {/* Top Header with Lightfall Ambient Shader */}
      <div className="relative px-5 py-3 border-b border-border flex items-center justify-between shrink-0 bg-surface-1/90 backdrop-blur-xl overflow-hidden">
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <Lightfall
            colors={['#00F5A0', '#00F0FF', '#7B2CBF']}
            backgroundColor="#0B0D12"
            speed={0.5}
            streakCount={4}
            opacity={0.5}
          />
        </div>

        <div className="relative z-10 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-text-muted hover:text-text-primary transition-colors p-1.5 rounded-lg hover:bg-surface-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <Shape3D type="gem" size={28} color="#00F0FF" />
            <div>
              <h1 className="text-sm font-bold text-white flex items-center gap-2">
                3D Code Sandbox
                <span className="badge badge-cyan">Interactive</span>
              </h1>
              <p className="text-xs text-text-muted">Instant isolated execution engine</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50 capitalize"
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
          <button
            onClick={handleRun}
            disabled={running}
            className="btn-primary py-1.5 px-5 text-sm font-semibold flex items-center gap-2"
          >
            {running ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Running...
              </>
            ) : (
              'Run'
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col border-r border-border">
          <div className="px-4 py-2 border-b border-border bg-surface-1/50 flex items-center justify-between">
            <span className="text-xs text-text-muted font-medium uppercase tracking-wider">{language} editor</span>
            <span className="text-[10px] text-text-muted">UTF-8</span>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            className="flex-1 w-full bg-surface-0 p-4 text-sm font-mono text-text-primary resize-none focus:outline-none"
            style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
          />
        </div>

        <div className="w-96 flex flex-col bg-surface-1/30">
          <div className="px-4 py-2 border-b border-border bg-surface-1/50 flex items-center justify-between">
            <span className="text-xs text-text-muted font-medium uppercase tracking-wider">Output</span>
            {result && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${result.exit_code === 0 ? 'badge-success' : 'badge-error'}`}>
                exit {result.exit_code}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-auto p-4">
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
                {error}
              </div>
            )}
            {result && (
              <div className="space-y-4">
                {result.output && (
                  <div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5 font-semibold">stdout</div>
                    <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap bg-surface-2/50 border border-border rounded-lg p-3 overflow-x-auto">
                      {result.output}
                    </pre>
                  </div>
                )}
                {result.error && (
                  <div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5 font-semibold">stderr</div>
                    <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap bg-surface-2/50 border border-red-500/20 rounded-lg p-3 overflow-x-auto">
                      {result.error}
                    </pre>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-surface-2/50 border border-border rounded-lg p-3 text-center">
                    <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Exit Code</div>
                    <div className={`text-lg font-semibold ${result.exit_code === 0 ? 'text-success' : 'text-crimson'}`}>
                      {result.exit_code}
                    </div>
                  </div>
                  <div className="bg-surface-2/50 border border-border rounded-lg p-3 text-center">
                    <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Timed Out</div>
                    <div className={`text-lg font-semibold ${result.timed_out ? 'text-warning' : 'text-text-secondary'}`}>
                      {result.timed_out ? 'Yes' : 'No'}
                    </div>
                  </div>
                  <div className="bg-surface-2/50 border border-border rounded-lg p-3 text-center">
                    <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Language</div>
                    <div className="text-sm font-semibold text-text-primary truncate">{result.language}</div>
                  </div>
                </div>
              </div>
            )}
            {!result && !error && !running && (
              <div className="text-center text-text-muted text-xs mt-12 flex flex-col items-center gap-3">
                <Shape3D type="octahedron" size={48} color="#00F5A0" />
                <p>Write some code and click Run</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
