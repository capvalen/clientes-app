/**
 * Cliente de la API de DNIs (Worker de Infocat).
 *
 * El token viaja en la URL y se configura en el .env como `VITE_INFOCAT_DNI`.
 */

const BASE_URL = 'https://dnis.infocat.workers.dev'

export interface DniData {
  dni: string
  apellido: string
  nombre: string
}

export interface DniUltimo extends DniData {
  fecha?: string
}

/** DNI que no se pudo identificar (lista de desconocidos) */
export interface DniDesconocido {
  id?: number
  dni: string
  fecha?: string
}

/** Resultado normalizado de una llamada a la API */
export interface DniApiResult {
  status: number
  ok: boolean
  /** Mensaje devuelto por la API (campo `error`/`message`), si lo hay */
  message: string
  /** Cuerpo de la respuesta ya parseado (o null si no traía cuerpo) */
  data: unknown
}

/** Token del servicio (definido en .env como VITE_INFOCAT_DNI) */
export function getDniToken(): string {
  return String(import.meta.env.VITE_INFOCAT_DNI ?? '').trim()
}

/** ¿Hay token configurado? */
export function hasDniToken(): boolean {
  return getDniToken().length > 0
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function bodyMessage(body: unknown): string {
  if (!body) return ''
  if (typeof body === 'string') return body.trim()
  if (typeof body === 'object') {
    const b = body as Record<string, unknown>
    for (const key of ['error', 'message', 'mensaje', 'detail']) {
      const value = b[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
  }
  return ''
}

async function call(path: string, init?: RequestInit): Promise<DniApiResult> {
  const res = await fetch(`${BASE_URL}${path}`, init)
  const data = await readBody(res)
  return {
    status: res.status,
    ok: res.ok,
    message: bodyMessage(data),
    data,
  }
}

/**
 * Consulta un DNI en el servicio (GET /api/dni/{dni}/{token}).
 * Devuelve el resultado tal cual para que la vista decida el mensaje.
 */
export async function consultarDni(dni: string): Promise<DniApiResult> {
  return call(
    `/api/dni/${encodeURIComponent(dni.trim())}/${encodeURIComponent(getDniToken())}`,
  )
}

/**
 * Alimenta un DNI manualmente (POST /api/alimentar/{token}).
 */
export async function alimentarDni(data: DniData): Promise<DniApiResult> {
  return call(`/api/alimentar/${encodeURIComponent(getDniToken())}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dni: data.dni.trim(),
      apellido: data.apellido.trim().toUpperCase(),
      nombre: data.nombre.trim().toUpperCase(),
    }),
  })
}

function text(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

/** Normaliza un registro de la lista a la forma { dni, apellido, nombre, fecha } */
function normalizarUltimo(raw: unknown): DniUltimo | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const dni = text(r.dni ?? r.DNI ?? r.documento ?? r.num_doc ?? r.numero)
  const apellido = text(
    r.apellido ?? r.apellidos ?? r.Apellido ?? r.apellido_paterno ?? r.paterno,
  )
  const nombre = text(r.nombre ?? r.nombres ?? r.Nombre)
  const fecha = text(
    r.fecha ?? r.created ?? r.created_at ?? r.fecha_registro ?? r.updated,
  )

  if (!dni && !apellido && !nombre) return null

  return { dni, apellido, nombre, fecha: fecha || undefined }
}

/** Extrae el array de registros sin importar si la API lo envuelve en un objeto */
function extraerLista(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    for (const key of [
      'items',
      'data',
      'dnis',
      'personas',
      'ultimos',
      'ultimos_dnis',
      'results',
    ]) {
      if (Array.isArray(d[key])) return d[key] as unknown[]
    }
  }
  return []
}

/**
 * Últimos DNIs registrados (GET /api/ultimos-dnis/{token}).
 * Lanza un Error con el mensaje de la API si la respuesta no es correcta.
 */
export async function listUltimosDnis(): Promise<DniUltimo[]> {
  const res = await call(`/api/ultimos-dnis/${encodeURIComponent(getDniToken())}`)
  if (!res.ok) {
    throw new Error(res.message || `Error ${res.status}`)
  }
  return extraerLista(res.data)
    .map(normalizarUltimo)
    .filter((item): item is DniUltimo => item !== null)
}

/** Normaliza un DNI desconocido: solo id/dni/fecha */
function normalizarDesconocido(raw: unknown): DniDesconocido | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const dni = text(r.dni ?? r.DNI ?? r.documento ?? r.num_doc ?? r.numero)
  if (!dni) return null

  const idRaw = r.id
  const id = idRaw == null || idRaw === '' ? undefined : Number(idRaw)
  const fecha = text(r.fecha ?? r.created ?? r.created_at ?? r.fecha_registro ?? r.updated)

  return {
    id: id !== undefined && Number.isFinite(id) ? id : undefined,
    dni,
    fecha: fecha || undefined,
  }
}

/**
 * DNIs desconocidos / no encontrados (GET /api/desconocidos).
 * Este endpoint no lleva token y responde `{ total, dnis: [...] }`.
 */
export async function listDnisDesconocidos(): Promise<DniDesconocido[]> {
  const res = await call('/api/desconocidos')
  if (!res.ok) {
    throw new Error(res.message || `Error ${res.status}`)
  }
  return extraerLista(res.data)
    .map(normalizarDesconocido)
    .filter((item): item is DniDesconocido => item !== null)
}

/** Elimina un DNI desconocido (DELETE /api/desconocidos/eliminar/{dni}/{token}) */
export async function eliminarDniDesconocido(dni: string): Promise<DniApiResult> {
  return call(
    `/api/desconocidos/eliminar/${encodeURIComponent(dni.trim())}/${encodeURIComponent(
      getDniToken(),
    )}`,
    { method: 'DELETE' },
  )
}
