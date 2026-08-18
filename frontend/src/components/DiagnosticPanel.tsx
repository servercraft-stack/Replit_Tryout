import type { DiagnosticError } from '../api/files'

interface Props {
  diagnostics: DiagnosticError[]
  onDismiss: () => void
}

export default function DiagnosticPanel({ diagnostics, onDismiss }: Props) {
  const errors = diagnostics.filter(d => d.severity === 'error')
  const warnings = diagnostics.filter(d => d.severity === 'warning')

  return (
    <div className="bg-surface-1/90 backdrop-blur-xl border-t border-border max-h-40 overflow-y-auto animate-fade-in-up">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border sticky top-0 bg-surface-1/90 backdrop-blur-xl z-10">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Problems</span>
          {errors.length > 0 && <span className="badge badge-error">{errors.length}</span>}
          {warnings.length > 0 && <span className="badge badge-warning">{warnings.length}</span>}
        </div>
        <button onClick={onDismiss} className="text-text-muted hover:text-text-primary transition-colors p-1 rounded hover:bg-surface-2">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="divide-y divide-border">
        {diagnostics.map((d, i) => (
          <div key={i} className="flex items-start gap-2.5 px-4 py-2 hover:bg-surface-2/50 transition-colors">
            <svg
              className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${d.severity === 'error' ? 'text-error' : 'text-warning'}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] text-text-muted">
                Line {d.line}{d.column > 0 && `, Col ${d.column}`}
              </span>
              <p className={`text-xs mt-0.5 ${d.severity === 'error' ? 'text-error' : 'text-warning'}`}>
                {d.message}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
