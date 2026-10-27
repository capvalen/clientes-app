/**
 * Datos del usuario guardados en el navegador.
 * Se leen de `localStorage.user` (JSON con el correo en `user`).
 */

export interface StoredUser {
  user?: string
}

const USER_KEY = 'user'

/** Correo autorizado para ver el módulo Proyecto DNIs */
export const DNI_ADMIN_EMAIL = 'infocat2.0@gmail.com'

/** Guarda el usuario de la sesión en localStorage */
export function setStoredUser(user: StoredUser) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify({ user: user.user ?? '' }))
  } catch {
    /* localStorage no disponible */
  }
}

/** Elimina el usuario guardado (al cerrar sesión) */
export function clearStoredUser() {
  try {
    localStorage.removeItem(USER_KEY)
  } catch {
    /* localStorage no disponible */
  }
}

/** Devuelve el usuario guardado en localStorage (o null si no existe / es inválido) */
export function getStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== 'object') return null

    const obj = data as Record<string, unknown>
    const user = typeof obj.user === 'string' ? obj.user : ''

    // Limpia claves antiguas (p. ej. `perfil`) de versiones anteriores
    if (Object.keys(obj).length !== 1 || typeof obj.user !== 'string') {
      localStorage.setItem(USER_KEY, JSON.stringify({ user }))
    }

    return { user }
  } catch {
    return null
  }
}

/** ¿El usuario actual es el correo autorizado del módulo DNIs? */
export function isDniAdmin(): boolean {
  const user = getStoredUser()
  if (!user) return false
  return String(user.user ?? '').trim().toLowerCase() === DNI_ADMIN_EMAIL
}
