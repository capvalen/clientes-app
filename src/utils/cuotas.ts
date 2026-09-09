import type { Periocidad } from '../api/pocketbase'

/**
 * Calcula las fechas de cuota de un servicio según su periocidad.
 * Parte de fecha_inicio y suma según la periocidad (diario +1d, semanal +7d,
 * mensual +1 mes, anual +1 año) hasta superar fecha_final.
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
    cuotas.push(actual.toISOString().slice(0, 10))

    switch (periocidad) {
      case 'diario':
        actual.setDate(actual.getDate() + 1)
        break
      case 'semanal':
        actual.setDate(actual.getDate() + 7)
        break
      case 'mensual':
        actual.setMonth(actual.getMonth() + 1)
        break
      case 'anual':
        actual.setFullYear(actual.getFullYear() + 1)
        break
    }
  }

  return cuotas
}

export const PERIOCIDAD_LABEL: Record<Periocidad, string> = {
  diario: 'Diario',
  semanal: 'Semanal',
  mensual: 'Mensual',
  anual: 'Anual',
}

/** Suma una periocidad a una fecha (diario +1d, semanal +7d, mensual +1 mes, anual +1 año) */
export function sumarPeriocidad(fecha: string, periocidad: Periocidad): string {
  const d = new Date(`${fecha.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return fecha
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
    case 'anual':
      d.setFullYear(d.getFullYear() + 1)
      break
  }
  return d.toISOString().slice(0, 10)
}