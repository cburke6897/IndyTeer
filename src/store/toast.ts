import { useSyncExternalStore } from 'react'

export type ToastKind = 'success' | 'error' | 'info'
export interface ToastItem { id: number; message: string; kind: ToastKind }

let toasts: ToastItem[] = []
let counter = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function toast(message: string, kind: ToastKind = 'success') {
  const id = ++counter
  toasts = [...toasts, { id, message, kind }]
  emit()
  setTimeout(() => dismissToast(id), 4000)
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function useToasts() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l) } },
    () => toasts,
  )
}
