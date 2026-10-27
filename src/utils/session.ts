/**
 * Datos del usuario guardados en el navegador.
 * Se leen de `localStorage.user` (JSON con `user` y `perfil`).
 */

export interface StoredUser {
  user?: string
  perfil?: string
}

const USER_KEY = 'user'

/** Devuelve el usuario guardado en localStorage (o null si no existe / es inválido) */
export function getStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== 'object') return null
    return data as StoredUser
  } catch {
    return null
  }
}

/** ¿El usuario actual es cpariona con perfil administrador? */
export function isDniAdmin(): boolean {
  const user = getStoredUser()
  if (!user) return false
  return (
    String(user.user ?? '').trim().toLowerCase() === 'cpariona' &&
    String(user.perfil ?? '').trim().toLowerCase() === 'administrador'
  )
}
