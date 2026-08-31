import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { executeCode, getAvailableLanguages, type ExecutionResult } from '../api/executor'
import Lightfall from '../components/Lightfall'

export default function SandboxPage() {
  const navigate = useNavigate()
  const [languages, setLanguages] = useState<string[]>([])
  const [language, setLanguage] = useState('python')
  const [code, setCode] = useState('print("Hello, World!")')
  const [result, setResult] = useState<ExecutionResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [showLightfall, setShowLightfall] = useState(true)

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
    <div className="h-full flex flex-col relative overflow-hidden bg-surface-0">
      {/* Dynamic 3D Lightfall backdrop */}
      {showLightfall && (
        <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
          <Lightfall
            colors={['#00F0FF', '#7000FF', '#FF007F']}
            backgroundColor="#050714"
            speed={0.5}
            streakCount={5}
            streakWidth={1}
            streakLength={1}
            glow={0.8}
            density={0.5}
            twinkle={0.7}
            zoom={2.5}
            backgroundGlow={0.4}
            opacity={0.6}
            mouseInteraction={true}
            mouseStrength={0.6}
            mouseRadius={0.5}
          />
        </div>
      )}

      {/* Header bar */}
      <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between shrink-0 bg-surface-1/80 backdrop-blur-xl z-10 shadow-lg">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="text-text-muted hover:text-text-primary transition-colors p-2 rounded-xl hover:bg-surface-2 border border-white/5"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-wide">3D Interactive Sandbox</h1>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-glow" />
            </div>
            <p className="text-xs text-text-muted">Run code live in an isolated container environment</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLightfall(!showLightfall)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              showLightfall
                ? 'bg-accent/20 border-accent/40 text-accent'
                : 'bg-surface-2 border-border text-text-muted hover:text-text-primary'
            }`}
          >
            {showLightfall ? '3D Lightfall: On' : '3D Lightfall: Off'}
          </button>

          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="px-3 py-1.5 bg-surface-2 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent/50 shadow-inner"
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>

          <button
            onClick={handleRun}
            disabled={running}
            className="px-5 py-1.5 bg-gradient-to-r from-accent to-violet hover:from-accent-hover hover:to-violet/90 text-white text-sm font-semibold rounded-xl shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {running ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Executing...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
                <span>Run Code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Sandbox Workspace */}
      <div className="flex-1 flex overflow-hidden z-10 p-4 gap-4">
        {/* Code Editor Panel */}
        <div className="flex-1 flex flex-col rounded-2xl border border-white/10 bg-surface-1/70 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/10 bg-surface-2/50 flex items-center justify-between">
            <span className="text-xs text-text-secondary font-mono font-semibold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-glow" />
              main.{language === 'python' ? 'py' : language === 'javascript' ? 'js' : language === 'typescript' ? 'ts' : 'txt'}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-text-muted bg-surface-3 px-2 py-0.5 rounded-md">
              {language}
            </span>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            className="flex-1 w-full bg-surface-0/60 p-4 text-sm font-mono text-text-primary resize-none focus:outline-none selection:bg-accent/30"
            style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
          />
        </div>

        {/* Console / Output Panel */}
        <div className="w-96 flex flex-col rounded-2xl border border-white/10 bg-surface-1/70 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/10 bg-surface-2/50 flex items-center justify-between">
            <span className="text-xs text-text-secondary font-semibold uppercase tracking-wider flex items-center gap-2">
              <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Execution Output
            </span>
            {result && (
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${result.exit_code === 0 ? 'badge-success' : 'badge-error'}`}>
                exit {result.exit_code}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                {error}
              </div>
            )}

            {result && (
              <div className="space-y-4 animate-fade-in-up">
                {result.output && (
                  <div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5 font-semibold">stdout</div>
                    <pre className="text-xs text-text-primary font-mono whitespace-pre-wrap bg-surface-0/80 border border-white/5 rounded-xl p-3.5 overflow-x-auto shadow-inner">
                      {result.output}
                    </pre>
                  </div>
                )}
                {result.error && (
                  <div>
                    <div className="text-[10px] text-red-400 uppercase tracking-wider mb-1.5 font-semibold">stderr</div>
                    <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap bg-red-950/20 border border-red-500/20 rounded-xl p-3.5 overflow-x-auto shadow-inner">
                      {result.error}
                    </pre>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-surface-2/60 border border-white/5 rounded-xl p-2.5 text-center shadow-md">
                    <div className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Exit</div>
                    <div className={`text-base font-bold ${result.exit_code === 0 ? 'text-emerald-400' : 'text-crimson'}`}>
                      {result.exit_code}
                    </div>
                  </div>
                  <div className="bg-surface-2/60 border border-white/5 rounded-xl p-2.5 text-center shadow-md">
                    <div className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Timed Out</div>
                    <div className={`text-base font-bold ${result.timed_out ? 'text-amber-400' : 'text-text-secondary'}`}>
                      {result.timed_out ? 'Yes' : 'No'}
                    </div>
                  </div>
                  <div className="bg-surface-2/60 border border-white/5 rounded-xl p-2.5 text-center shadow-md">
                    <div className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Runtime</div>
                    <div className="text-xs font-bold text-text-primary truncate">{result.language}</div>
                  </div>
                </div>
              </div>
            )}

            {!result && !error && !running && (
              <div className="text-center text-text-muted text-xs my-12 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-surface-2/80 border border-white/5 flex items-center justify-center text-text-muted">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                  </svg>
                </div>
                <p>Click "Run Code" to execute code in the 3D sandbox environment.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
