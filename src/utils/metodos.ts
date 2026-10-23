import { METODOS_PAGO } from '../api/pocketbase'

/**
 * Imagen (logo) de cada método de pago.
 * Los archivos deben estar en `public/images/` con el nombre indicado aquí.
 */
export const METODO_IMAGEN: Record<string, string> = {
  Efectivo: '/images/efectivo.png',
  Yape: '/images/yape.png',
  Plin: '/images/plin.png',
  BCP: '/images/bcp.png',
  Interbank: '/images/interbank.png',
  'Caja Huancayo': '/images/caja.png',
}

/** Devuelve la ruta de imagen del método (o null si no tiene) */
export function metodoImagen(metodo: string): string | null {
  return METODO_IMAGEN[metodo] ?? null
}

/** Lista de métodos con su imagen para el selector */
export const METODOS_PAGO_CON_IMAGEN = METODOS_PAGO.map((metodo) => ({
  metodo,
  imagen: METODO_IMAGEN[metodo] ?? null,
}))
