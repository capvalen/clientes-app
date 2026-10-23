/**
 * Notificaciones tipo "toast" (singleton global).
 * Uso: showToast('Clave bloqueada')  ·  showToast('Error', 'error')
 */
import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  message: string
  type: ToastType
}

const DURATION_MS = 2500

export const toasts = ref<Toast[]>([])

let seq = 0

/** Muestra una notificación efímera */
export function showToast(message: string, type: ToastType = 'success') {
  const id = ++seq
  toasts.value.push({ id, message, type })
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, DURATION_MS)
}

/** Cierra una notificación de inmediato */
export function dismissToast(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}
