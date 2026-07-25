import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'

interface UseWebSocketOptions {
  url: string
  onMessage?: (event: MessageEvent) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: (event: Event) => void
  enabled?: boolean
}

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
  onError,
  enabled = true,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const token = useAuthStore((s) => s.accessToken)

  const connect = useCallback(() => {
    if (!enabled || !token) return

    const separator = url.includes('?') ? '&' : '?'
    const fullUrl = `${url}${separator}token=${token}`
    const ws = new WebSocket(fullUrl)
    wsRef.current = ws

    ws.onopen = () => onOpen?.()
    ws.onmessage = (e) => onMessage?.(e)
    ws.onclose = () => onClose?.()
    ws.onerror = (e) => onError?.(e)

    return ws
  }, [url, token, enabled, onMessage, onOpen, onClose, onError])

  useEffect(() => {
    const ws = connect()
    return () => {
      ws?.close()
    }
  }, [connect])

  const send = useCallback((data: Record<string, any>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { ws: wsRef, send }
}
