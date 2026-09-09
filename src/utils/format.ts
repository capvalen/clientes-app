/**
 * Helpers de normalización de texto.
 * Se aplican a todos los campos antes de enviarlos a la BD.
 */

/** Recorta espacios y colapsa espacios múltiples */
export function normalizeText(value: unknown): string {
  if (value == null) return ''
  return String(value).trim().replace(/\s+/g, ' ')
}

/** Primera letra en mayúscula, el resto en minúscula */
export function capitalize(text: string): string {
  const t = normalizeText(text)
  if (!t) return t
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

/** Solo la primera letra en mayúscula, el resto del texto intacto (preserva saltos de línea) */
export function upperFirst(text: string): string {
  const t = String(text ?? '').trim()
  if (!t) return t
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Cada palabra con la primera letra en mayúscula (nombres propios) */
export function titleCase(text: string): string {
  return normalizeText(text)
    .split(' ')
    .map(capitalize)
    .join(' ')
}

/** Nombres de personas/empresas: título por palabra */
export function normalizeName(value: unknown): string {
  return titleCase(normalizeText(value))
}

/** Emails: recortado y en minúsculas */
export function normalizeEmail(value: unknown): string {
  return normalizeText(value).toLowerCase()
}

/** Trunca un texto a N caracteres agregando "..." al final */
export function truncate(text: string, max = 30): string {
  const t = normalizeText(text)
  if (t.length <= max) return t
  return t.slice(0, max).trimEnd() + '...'
}

/** Formatea una fecha (ISO o "YYYY-MM-DD") a dd/MM/YYYY */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/** Formatea una fecha con hora a dd/MM/YYYY hh:mm a (12h con AM/PM) */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  let hh = date.getHours()
  const min = String(date.getMinutes()).padStart(2, '0')
  const ampm = hh >= 12 ? 'PM' : 'AM'
  hh = hh % 12 || 12
  return `${dd}/${mm}/${yyyy} ${hh}:${min} ${ampm}`
}