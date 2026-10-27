import type { Periocidad } from '../api/pocketbase'

/** Devuelve "YYYY-MM-DD" a partir de las partes LOCALES de un Date (evita el desfase de toISOString) */
function toLocalISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Avanza la fecha indicada según la periocidad (muta el Date) */
function avanzarPeriocidad(d: Date, periocidad: Periocidad): void {
  switch (periocidad) {
    case 'diario':
      d.setDate(d.getDate() + 1)
      break
    case 'semanal':
      d.setDate(d.getDate() + 7)
      break
    case 'mensual':
      d.setMonth(d.getMonth() + 1)
      break
    case 'bianual':
      d.setMonth(d.getMonth() + 6)
      break
    case 'anual':
      d.setFullYear(d.getFullYear() + 1)
      break
  }
}

/**
 * Calcula las fechas de cuota de un servicio según su periocidad.
 * Parte de fecha_inicio y suma según la periocidad (diario +1d, semanal +7d,
 * mensual +1 mes, bianual +6 meses, anual +1 año) hasta superar fecha_final.
 * La fecha_final es solo un indicador de corte: si una cuota cae después
 * de fecha_final, no se incluye.
 */
export function calcularCuotas(
  fechaInicio: string,
  fechaFinal: string | null | undefined,
  periocidad: Periocidad,
): string[] {
  if (!fechaInicio) return []
  const cuotas: string[] = []
  // Extraer solo YYYY-MM-DD para evitar problemas con fechas que traen hora (ej: "2026-09-09 00:00:00.000Z")
  const fin = fechaFinal ? new Date(`${fechaFinal.slice(0, 10)}T00:00:00`) : null

  const actual = new Date(`${fechaInicio.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(actual.getTime())) return []

  // Límite de seguridad: máx 1000 cuotas
  for (let i = 0; i < 1000; i++) {
    if (fin && actual > fin) break
    cuotas.push(toLocalISODate(actual))
    avanzarPeriocidad(actual, periocidad)
  }

  return cuotas
}

/**
 * Genera exactamente `cantidad` fechas de cuota partiendo de fecha_inicio.
 * La cuota 1 cae en fecha_inicio, la 2 en fecha_inicio + 1 periocidad, etc.
 */
export function fechasCuotas(
  fechaInicio: string,
  periocidad: Periocidad,
  cantidad: number,
): string[] {
  if (!fechaInicio) return []
  const total = Math.floor(Number(cantidad))
  if (!Number.isFinite(total) || total <= 0) return []

  const actual = new Date(`${fechaInicio.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(actual.getTime())) return []

  const fechas: string[] = []
  // Límite de seguridad: máx 1000 cuotas
  for (let i = 0; i < Math.min(total, 1000); i++) {
    fechas.push(toLocalISODate(actual))
    avanzarPeriocidad(actual, periocidad)
  }

  return fechas
}

export const PERIOCIDAD_LABEL: Record<Periocidad, string> = {
  diario: 'Diario',
  semanal: 'Semanal',
  mensual: 'Mensual',
  bianual: 'Bianual',
  anual: 'Anual',
}

/** Suma una periocidad a una fecha (diario +1d, semanal +7d, mensual +1 mes, bianual +6 meses, anual +1 año) */
export function sumarPeriocidad(fecha: string, periocidad: Periocidad): string {
  const d = new Date(`${fecha.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return fecha
  avanzarPeriocidad(d, periocidad)
  return toLocalISODate(d)
}
