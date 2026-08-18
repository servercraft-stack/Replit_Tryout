import * as Y from 'https://esm.sh/yjs@13.6.18'

const token = document.body.dataset.token
const status = document.querySelector('#status')
const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
const editorSocket = new WebSocket(`${protocol}://${location.host}/ws/pair/${token}/editor/`)
const terminalSocket = new WebSocket(`${protocol}://${location.host}/ws/pair/${token}/terminal/`)
editorSocket.binaryType = 'arraybuffer'
const documentState = new Y.Doc()
const text = documentState.getText('code')
let editor
let applyingRemote = false
let modelSubscription
const remoteCursor = 'pair-remote-cursor'

document.querySelector('#share').addEventListener('click', async () => {
  await navigator.clipboard.writeText(location.href)
  status.textContent = 'Session link copied'
})

function positionToOffset(model, position) {
  return model.getOffsetAt(position)
}

function offsetToPosition(model, offset) {
  return model.getPositionAt(Math.min(Math.max(offset, 0), model.getValueLength()))
}

function syncEditor() {
  if (!editor) return
  const content = text.toString()
  if (editor.getValue() === content) return
  applyingRemote = true
  const model = editor.getModel()
  const selection = editor.getSelection()
  model.setValue(content)
  editor.setSelection(selection)
  applyingRemote = false
}

function initializeEditor() {
  require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } })
  require(['vs/editor/editor.main'], () => {
    editor = monaco.editor.create(document.querySelector('#editor'), {
      value: text.toString(),
      language: 'javascript',
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
    })
    modelSubscription = editor.onDidChangeModelContent(() => {
      if (applyingRemote) return
      const value = editor.getValue()
      documentState.transact(() => text.delete(0, text.length).insert(0, value))
    })
    editor.onDidChangeCursorPosition((event) => {
      if (editorSocket.readyState !== WebSocket.OPEN) return
      editorSocket.send(JSON.stringify({ type: 'cursor', cursor: event.position }))
    })
  })
}

text.observe(syncEditor)
documentState.on('update', (update, origin) => {
  if (origin === 'remote' || editorSocket.readyState !== WebSocket.OPEN) return
  editorSocket.send(update)
})

editorSocket.addEventListener('open', () => { status.textContent = 'Editor connected' })
editorSocket.addEventListener('message', (event) => {
  if (typeof event.data === 'string') {
    const message = JSON.parse(event.data)
    if (message.type === 'cursor' && editor) {
      const position = message.cursor
      editor.deltaDecorations([], [{ range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column + 1), options: { className: remoteCursor, inlineClassName: remoteCursor } }])
    }
    return
  }
  Y.applyUpdate(documentState, new Uint8Array(event.data), 'remote')
  if (!editor) initializeEditor()
})
editorSocket.addEventListener('close', () => { status.textContent = 'Editor disconnected' })

const term = new Terminal({ cursorBlink: true, scrollback: 5000, theme: { background: '#0d1117' } })
const fit = new FitAddon.FitAddon()
term.loadAddon(fit)
term.open(document.querySelector('#terminal'))
requestAnimationFrame(() => fit.fit())
term.onData((data) => {
  if (terminalSocket.readyState === WebSocket.OPEN) terminalSocket.send(JSON.stringify({ type: 'input', data }))
})
function resizeTerminal() {
  fit.fit()
  if (terminalSocket.readyState === WebSocket.OPEN) terminalSocket.send(JSON.stringify({ type: 'resize', columns: term.cols, rows: term.rows }))
}
terminalSocket.addEventListener('open', resizeTerminal)
terminalSocket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.type === 'output') term.write(message.data)
})
window.addEventListener('resize', resizeTerminal)
window.addEventListener('beforeunload', () => {
  modelSubscription?.dispose()
  editorSocket.close()
  terminalSocket.close()
  term.dispose()
})
