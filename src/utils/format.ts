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