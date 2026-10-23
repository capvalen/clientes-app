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

/**
 * Extrae año, mes y día de la parte de FECHA (UTC) de un valor de PocketBase.
 * Evita el desfase por zona horaria al mostrar fechas guardadas como
 * medianoche UTC (`YYYY-MM-DD 00:00:00.000Z`).
 */
function pbDateParts(value: string): { y: number; m: number; d: number } | null {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) }
}

/** Formatea una fecha (ISO o "YYYY-MM-DD") a dd/MM/YYYY */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const parts = pbDateParts(value)
  if (parts) {
    const dd = String(parts.d).padStart(2, '0')
    const mm = String(parts.m).padStart(2, '0')
    return `${dd}/${mm}/${parts.y}`
  }
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

const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

/** Formatea fecha y hora como "22 ago 2026 · 7:31 pm" (mes corto en español, am/pm en minúsculas) */
export function formatFechaHora(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const dd = date.getDate()
  const mes = MESES_CORTOS[date.getMonth()]
  const yyyy = date.getFullYear()
  let hh = date.getHours()
  const min = String(date.getMinutes()).padStart(2, '0')
  const ampm = hh >= 12 ? 'pm' : 'am'
  hh = hh % 12 || 12
  return `${dd} ${mes} ${yyyy} · ${hh}:${min} ${ampm}`
}

/** Formatea solo la fecha como "6 ago. 2026" (día sin cero, mes corto en español con punto) */
export function formatFechaCorta(value: string | null | undefined): string {
  if (!value) return '—'
  const parts = pbDateParts(value)
  if (parts) {
    return `${parts.d} ${MESES_CORTOS[parts.m - 1]}. ${parts.y}`
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const dd = date.getDate()
  const mes = MESES_CORTOS[date.getMonth()]
  const yyyy = date.getFullYear()
  return `${dd} ${mes}. ${yyyy}`
}

/**
 * Normaliza una fecha al formato datetime de PocketBase: `YYYY-MM-DD HH:mm:ss.SSSZ`.
 * Acepta un `Date`, un `datetime` o una fecha suelta `YYYY-MM-DD` (se asume 00:00 UTC).
 */
export function pbDateTime(value: Date | string = new Date()): string {
  let d: Date
  if (value instanceof Date) {
    d = value
  } else if (value.length <= 10) {
    d = new Date(`${value}T00:00:00Z`)
  } else {
    d = new Date(value)
  }
  if (Number.isNaN(d.getTime())) return String(value)
  const p = (n: number, len = 2) => String(n).padStart(len, '0')
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}.${p(d.getUTCMilliseconds(), 3)}Z`
  )
}