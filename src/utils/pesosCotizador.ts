import {
  CONFIG_PESOS_COTIZADOR_DEFAULT,
  createConfiguracion,
  getConfiguracion,
  getUserId,
  parsePesosCotizador,
  type ConfigPesosCotizador,
} from '../api/pocketbase'

/** Clave de la configuración en is_configuraciones */
export const PESOS_CLAVE = 'pesos_cotizador'

/** Clave con la copia local para usar en /cotizador */
const STORAGE_KEY = 'pesos_cotizador'

/** Configuración guardada en este navegador (o los valores por defecto si no hay) */
export function getPesosCotizadorLocal(): ConfigPesosCotizador {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return CONFIG_PESOS_COTIZADOR_DEFAULT
    return parsePesosCotizador(raw)
  } catch {
    return CONFIG_PESOS_COTIZADOR_DEFAULT
  }
}

/** Guarda en localStorage la configuración recibida del servidor */
export function savePesosCotizadorLocal(config: ConfigPesosCotizador) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    /* localStorage no disponible */
  }
}

export interface PesosCotizadorCargados {
  configId: string
  config: ConfigPesosCotizador
}

/**
 * Carga la configuración de pesos del usuario desde is_configuraciones.
 * Si no existe el registro, lo crea con los valores por defecto.
 * En ambos casos deja una copia en localStorage para /cotizador.
 */
export async function cargarPesosCotizador(): Promise<PesosCotizadorCargados> {
  const userId = getUserId()
  if (!userId) {
    throw new Error('No se pudo obtener el id del usuario. Vuelve a iniciar sesión.')
  }

  let config = await getConfiguracion(PESOS_CLAVE, userId)
  if (!config) {
    config = await createConfiguracion(PESOS_CLAVE, userId, CONFIG_PESOS_COTIZADOR_DEFAULT)
  }

  const parsed = parsePesosCotizador(config.valor)
  savePesosCotizadorLocal(parsed)
  return { configId: config.id, config: parsed }
}
