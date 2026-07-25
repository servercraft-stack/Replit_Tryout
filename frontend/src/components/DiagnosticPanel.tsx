import type { DiagnosticError } from '../api/files'

interface Props {
  diagnostics: DiagnosticError[]
  onDismiss: () => void
}

export default function DiagnosticPanel({ diagnostics, onDismiss }: Props) {
  return (
    <div className="bg-red-500/5 border-t border-red-500/20 max-h-32 overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-red-500/10">
        <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">Problems</span>
        <button onClick={onDismiss} className="text-zinc-600 hover:text-zinc-400">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="divide-y divide-red-500/5">
        {diagnostics.map((d, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-500/5">
            <svg
              className={`w-3 h-3 shrink-0 ${d.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span className="text-[11px] text-zinc-400">
              <span className="text-zinc-500">Line {d.line}</span>
              {' — '}
              <span className={d.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}>{d.message}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
