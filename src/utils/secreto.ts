/**
 * Formato de los datos de un secreto (colección `is_notas` con `oculto = true`).
 *
 * El campo `dato` guarda un JSON con un array de items:
 *
 * - Item CIFRADO: `{ "dato": "<texto cifrado>" }` → **no** lleva `llave`.
 * - Item PLAANO: `{ "dato": "texto visible", "llave": "x" }` → la marca `llave`
 *   indica que el texto NO está cifrado y se muestra sin pedir la clave maestra.
 *
 * Formato heredado (se sigue leyendo sin cambios): un array de strings,
 * donde todos los textos están cifrados.
 */

/** Un dato dentro de un secreto */
export interface SecretoItem {
  /** Texto del dato: cifrado si el item no lleva `llave` */
  dato: string
  /** Marca de texto plano. Si está presente, el dato NO está cifrado. */
  llave?: string
}

/** Marca utilizada para los datos que se muestran en texto plano */
export const LLAVE_PLAINA = 'x'

/** ¿El dato está cifrado? (los que llevan `llave` son texto plano) */
export function esCifrado(item: SecretoItem): boolean {
  return !item.llave
}

/**
 * Lee los items de un secreto.
 * Admite el formato heredado (array de strings) y el actual (array de objetos).
 */
export function parseSecretoItems(dato: string): SecretoItem[] {
  let value: unknown
  try {
    value = JSON.parse(dato || '[]')
  } catch {
    return []
  }
  if (!Array.isArray(value)) return []

  return value.map((raw) => {
    // Formato heredado: string suelto (siempre cifrado)
    if (typeof raw === 'string') return { dato: raw }
    if (raw && typeof raw === 'object') {
      const obj = raw as { dato?: unknown; llave?: unknown }
      const texto = obj.dato != null ? String(obj.dato) : ''
      // Si trae `llave` es texto plano; si no, está cifrado
      if (obj.llave) return { dato: texto, llave: String(obj.llave) }
      return { dato: texto }
    }
    return { dato: '' }
  })
}

/** Serializa los items al JSON que se guarda en el campo `dato` */
export function serializeSecretoItems(items: SecretoItem[]): string {
  return JSON.stringify(
    items.map((item) => (item.llave ? { dato: item.dato, llave: item.llave } : { dato: item.dato })),
  )
}

/**
 * Primer dato cifrado del secreto.
 * Sirve como texto de referencia para validar la clave maestra ingresada.
 * Devuelve '' si el secreto no tiene nada cifrado.
 */
export function primerCifrado(items: SecretoItem[]): string {
  return items.find((item) => esCifrado(item))?.dato ?? ''
}
