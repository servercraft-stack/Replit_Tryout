import * as Y from 'yjs'
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness'

const REMOTE_ORIGIN = Symbol('remote-crdt-update')

function websocketUrl(fileId: string, token: string) {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}/ws/colab/files/${fileId}/?token=${encodeURIComponent(token)}`
}

export class SocketYjsProvider {
  readonly awareness: Awareness
  readonly socket: WebSocket
  private readonly fileId: string

  constructor(fileId: string, readonly doc: Y.Doc, token: string) {
    this.fileId = fileId
    this.awareness = new Awareness(doc)
    this.socket = new WebSocket(websocketUrl(fileId, token))
    this.socket.binaryType = 'arraybuffer'
    this.socket.addEventListener('message', (event) => {
      if (typeof event.data === 'string') {
        const message = JSON.parse(event.data)
        if (message.type === 'awareness') applyAwarenessUpdate(this.awareness, Uint8Array.from(atob(message.data), (value) => value.charCodeAt(0)), REMOTE_ORIGIN)
        return
      }
      Y.applyUpdate(doc, new Uint8Array(event.data), REMOTE_ORIGIN)
    })
    doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== REMOTE_ORIGIN && this.socket.readyState === WebSocket.OPEN) this.socket.send(update)
    })
    this.awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
      if (origin !== REMOTE_ORIGIN && this.socket.readyState === WebSocket.OPEN) {
        const bytes = encodeAwarenessUpdate(this.awareness, [...added, ...updated, ...removed])
        this.socket.send(JSON.stringify({ type: 'awareness', data: btoa(String.fromCharCode(...bytes)) }))
      }
    })
  }

  destroy() {
    this.awareness.destroy()
    this.socket.close()
  }
}
