/**
 * Estado global de visibilidad de montos.
 * Es un singleton (se comparte entre todas las vistas) y se persiste
 * en localStorage para que la preferencia se mantenga al navegar/recargar.
 */
import { ref, watch } from 'vue'

const STORAGE_KEY = 'pb_show_montos'

export const showMontos = ref(localStorage.getItem(STORAGE_KEY) === '1')

watch(showMontos, (value) => {
  localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
})

/** Texto mostrado cuando los montos están ocultos (para inputs/atributos, sin HTML) */
export const MONTO_OCULTO = 'S/ •••'

/** Formatea un monto en soles respetando el estado global de visibilidad */
export function monto(value: number | string | null | undefined): string {
  if (!showMontos.value) return MONTO_OCULTO
  return `S/ ${Number(value || 0).toFixed(2)}`
}

/** Alterna la visibilidad de los montos en todo el sitio */
export function toggleMontos() {
  showMontos.value = !showMontos.value
}
