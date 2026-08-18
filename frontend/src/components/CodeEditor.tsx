import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react'
import * as monaco from 'monaco-editor'
import { getDiagnostics, getFileContent, updateFileContent, type DiagnosticError, type FileNode } from '../api/files'
import DiagnosticPanel from './DiagnosticPanel'

interface Props {
  file: FileNode
  onFileUpdate: (file: FileNode) => void
  onDirtyChange?: (fileId: string, dirty: boolean) => void
  onCursorChange?: (line: number, col: number) => void
}

export interface CodeEditorRef {
  saveContent: () => Promise<void>
  getContent: () => string
}

const EXTENSION_TO_MONACO: Record<string, string> = {
  py: 'python', js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', html: 'html', htm: 'html', css: 'css', scss: 'css', json: 'json', md: 'markdown', yaml: 'yaml', yml: 'yaml', toml: 'ini', sh: 'shell', bash: 'shell', sql: 'sql', xml: 'xml', java: 'java', go: 'go', rs: 'rust', rb: 'ruby', php: 'php', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp', swift: 'swift', kt: 'kotlin', txt: 'plaintext',
}

monaco.editor.defineTheme('streams-dark-plus', {
  base: 'vs-dark', inherit: true, rules: [],
  colors: { 'editor.background': '#18181b', 'editor.foreground': '#e4e4e7', 'editor.lineHighlightBackground': '#27272a', 'editor.selectionBackground': '#3730a3', 'editorCursor.foreground': '#a5b4fc', 'editorLineNumber.foreground': '#71717a' },
})

export default forwardRef<CodeEditorRef, Props>(function CodeEditor({ file, onFileUpdate, onDirtyChange, onCursorChange }: Props, ref) {
  const hostRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<number | undefined>()
  const latestContentRef = useRef('')
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const saveFnRef = useRef<((content: string) => Promise<void>) | null>(null)
  const [diagnostics, setDiagnostics] = useState<DiagnosticError[]>([])
  const [status, setStatus] = useState<'loading' | 'saved' | 'saving' | 'error'>('loading')

  const language = useCallback((node: FileNode) => {
    if (node.language) return EXTENSION_TO_MONACO[node.language] || node.language
    return EXTENSION_TO_MONACO[node.name.split('.').pop()?.toLowerCase() || ''] || 'plaintext'
  }, [])

  useEffect(() => {
    if (!hostRef.current) return
    let disposed = false
    let diagnosticsTimer: number | undefined
    const editor = monaco.editor.create(hostRef.current, {
      value: '', language: language(file), theme: 'streams-dark-plus', automaticLayout: true, minimap: { enabled: false }, fontSize: 14, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", lineHeight: 22, padding: { top: 8, bottom: 8 }, scrollBeyondLastLine: false, smoothScrolling: true, bracketPairColorization: { enabled: true }, guides: { indentation: true },
    })
    editorRef.current = editor
    const save = async (content: string) => {
      setStatus('saving')
      try {
        const updated = await updateFileContent(file.id, content)
        if (latestContentRef.current === content) { setStatus('saved'); onDirtyChange?.(file.id, false) }
        onFileUpdate({ ...file, content: updated.content, version: updated.version })
      } catch { if (!disposed) setStatus('error') }
    }
    saveFnRef.current = save
    const updateDiagnostics = (content: string) => {
      window.clearTimeout(diagnosticsTimer)
      diagnosticsTimer = window.setTimeout(async () => {
        try {
          const result = await getDiagnostics(file.id, content)
          if (disposed) return
          const all = [...result.errors, ...result.warnings]
          setDiagnostics(all)
          monaco.editor.setModelMarkers(editor.getModel()!, 'streams-diagnostics', all.map((d) => ({ severity: d.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning, message: d.message, startLineNumber: Math.max(1, d.line), startColumn: Math.max(1, d.column), endLineNumber: Math.max(1, d.line), endColumn: Math.max(1, d.column + 1) })))
        } catch { /* Diagnostics must never prevent editing. */ }
      }, 450)
    }
    let loadingContent = true
    const changeSubscription = editor.onDidChangeModelContent(() => {
      if (loadingContent) return
      const content = editor.getValue()
      latestContentRef.current = content
      onDirtyChange?.(file.id, true)
      setStatus('saving')
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = window.setTimeout(() => void save(content), 700)
      updateDiagnostics(content)
    })
    const cursorSubscription = editor.onDidChangeCursorPosition((event) => onCursorChange?.(event.position.lineNumber, event.position.column))
    void getFileContent(file.id).then((data) => {
      if (disposed) return
      editor.setValue(data.content)
      latestContentRef.current = data.content
      loadingContent = false
      setStatus('saved')
      updateDiagnostics(data.content)
    }).catch(() => { if (!disposed) { loadingContent = false; setStatus('error') } })

    return () => {
      disposed = true
      window.clearTimeout(saveTimerRef.current)
      window.clearTimeout(diagnosticsTimer)
      changeSubscription.dispose(); cursorSubscription.dispose()
      monaco.editor.setModelMarkers(editor.getModel()!, 'streams-diagnostics', [])
      editor.dispose()
      editorRef.current = null
      saveFnRef.current = null
    }
  }, [file.id, language, onFileUpdate, onDirtyChange, onCursorChange])

  useImperativeHandle(ref, () => ({
    saveContent: async () => {
      const editor = editorRef.current
      const save = saveFnRef.current
      if (!editor || !save) return
      const content = editor.getValue()
      latestContentRef.current = content
      window.clearTimeout(saveTimerRef.current)
      await save(content)
    },
    getContent: () => {
      return editorRef.current?.getValue() || latestContentRef.current || ''
    }
  }), [])

  return <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
    <div ref={hostRef} className="flex-1 overflow-hidden" />
    {diagnostics.length > 0 && <DiagnosticPanel diagnostics={diagnostics} onDismiss={() => setDiagnostics([])} />}
    <div className="h-6 bg-surface-1/80 border-t border-border flex items-center justify-between px-3 shrink-0 text-[10px] text-text-muted">
      <span>{language(file)}</span>
      <span className={status === 'error' ? 'text-error' : ''}>{status === 'loading' ? 'Loading…' : status === 'saving' ? 'Saving…' : status === 'error' ? 'Save failed — retry by editing' : 'Saved'}</span>
    </div>
  </div>
})
