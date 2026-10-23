import { normalizeName, normalizeEmail, normalizeText, upperFirst } from '../utils/format'

const BASE_URL = 'https://pb.infocatsoluciones.com'

const TOKEN_KEY = 'pb_token'

export interface Socio {
  nombre: string
  celular: string
  cargo: string
  ubicacion: string
}

export interface Nota {
  titulo: string
  dato: string
}

export interface Cliente {
  id: string
  nombre: string
  celular: string
  ruc: string
  direccion: string
  email: string
  socios: Socio[]
  notas: Nota[]
  created: string
  updated: string
}

export type EstadoProyecto = 'activo' | 'completado' | 'cancelado'

export interface Proyecto {
  id: string
  cliente_id: string
  proyecto: string
  descripcion: string
  total: number
  adelanto: number
  progreso: number
  estado: EstadoProyecto
  fecha_inicio: string
  fecha_final: string | null
  observaciones: string
  created: string
  updated: string
}

export type Periocidad = 'diario' | 'semanal' | 'mensual' | 'anual'

export type EstadoServicio = 'activo' | 'inactivo' | 'suspendido'

export interface Servicio {
  id: string
  cliente_id: string
  servicio: string
  descripcion: string
  total: number
  periocidad: Periocidad
  duracion_dias: number
  estado: EstadoServicio
  fecha_inicio: string
  fecha_final: string | null
  observaciones: string
  created: string
  updated: string
}

export type EntidadTipo = 'proyecto' | 'servicio'

export type EstadoPago = 'pendiente' | 'pagado' | 'anulado'

/** Distingue un pago completo de una deuda (monto por cobrar) */
export type QueEs = 'pago' | 'deuda'

export const METODOS_PAGO = [
  'Efectivo',
  'Yape',
  'Plin',
  'BCP',
  'Interbank',
  'Caja Huancayo',
] as const

export interface Pago {
  id: string
  monto: number
  /** Monto ya abonado de una deuda (0 mientras no se abone nada) */
  adelanto: number
  /** Indica si el registro es un pago o una deuda pendiente */
  que_es: QueEs
  fecha: string
  estado: EstadoPago
  metodo_pago: string
  /** Nombre(s) del/de los archivo(s) adjunto(s) (campo múltiple de PocketBase) */
  comprobante: string | string[]
  observaciones: string
  entidad_id: string
  entidad_tipo: EntidadTipo
  created: string
  updated: string
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

/** Normaliza campos JSON de PocketBase (pueden venir como array o string) */
function parseJson<T>(value: unknown, fallback: T): T {
  if (Array.isArray(value)) return value as T
  if (typeof value === 'string' && value) {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return fallback
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message || `Error ${res.status}`)
  }
  // Respuestas sin cuerpo (ej: DELETE → 204 No Content)
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }
  return res.json()
}

/** Autenticación contra PocketBase (endpoint estándar auth-with-password) */
export async function login(identity: string, password: string) {
  const res = await fetch(`${BASE_URL}/api/collections/users/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity, password }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message || 'Credenciales inválidas')
  }
  const data = await res.json()
  setToken(data.token)
  return data
}

export async function listClientes(): Promise<Cliente[]> {
  const data = await request<{ items: Cliente[] }>(
    '/api/collections/is_clientes/records?perPage=200&sort=-created',
  )
  return data.items
}

export async function getCliente(id: string): Promise<Cliente> {
  return request<Cliente>(`/api/collections/is_clientes/records/${id}`)
}

/** Normaliza todos los campos antes de enviarlos a la BD */
function normalizeCliente(data: Partial<Cliente>): Partial<Cliente> {
  return {
    ...data,
    nombre: data.nombre != null ? normalizeName(data.nombre) : data.nombre,
    celular: data.celular != null ? normalizeText(data.celular) : data.celular,
    ruc: data.ruc != null ? normalizeText(data.ruc) : data.ruc,
    direccion: data.direccion != null ? normalizeName(data.direccion) : data.direccion,
    email: data.email != null ? normalizeEmail(data.email) : data.email,
    socios: data.socios
      ? data.socios.map((s) => ({
          nombre: normalizeName(s.nombre),
          celular: normalizeText(s.celular),
          cargo: normalizeName(s.cargo),
          ubicacion: normalizeName(s.ubicacion),
        }))
      : data.socios,
    notas: data.notas
      ? data.notas.map((n) => ({
          titulo: normalizeName(n.titulo),
          dato: normalizeText(n.dato),
        }))
      : data.notas,
  }
}

export async function createCliente(data: Partial<Cliente>): Promise<Cliente> {
  return request<Cliente>('/api/collections/is_clientes/records', {
    method: 'POST',
    body: JSON.stringify(normalizeCliente(data)),
  })
}

export async function updateCliente(id: string, data: Partial<Cliente>): Promise<Cliente> {
  return request<Cliente>(`/api/collections/is_clientes/records/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(normalizeCliente(data)),
  })
}

export async function deleteCliente(id: string): Promise<void> {
  await request(`/api/collections/is_clientes/records/${id}`, { method: 'DELETE' })
}

export function parseSocios(value: unknown): Socio[] {
  return parseJson<Socio[]>(value, [])
}

export function parseNotas(value: unknown): Nota[] {
  return parseJson<Nota[]>(value, [])
}

// ---------- Proyectos ----------

export async function listProyectos(): Promise<Proyecto[]> {
  const data = await request<{ items: Proyecto[] }>(
    '/api/collections/is_proyectos/records?perPage=200&sort=-created',
  )
  return data.items
}

export async function getProyecto(id: string): Promise<Proyecto> {
  return request<Proyecto>(`/api/collections/is_proyectos/records/${id}`)
}

/** Normaliza los campos de texto antes de enviarlos a la BD */
function normalizeProyecto(data: Partial<Proyecto>): Partial<Proyecto> {
  return {
    ...data,
    proyecto: data.proyecto != null ? normalizeName(data.proyecto) : data.proyecto,
    descripcion: data.descripcion != null ? upperFirst(data.descripcion) : data.descripcion,
    observaciones:
      data.observaciones != null ? upperFirst(data.observaciones) : data.observaciones,
    total: data.total != null ? Number(data.total) : data.total,
    adelanto: data.adelanto != null ? Number(data.adelanto) : data.adelanto,
    progreso: data.progreso != null ? Number(data.progreso) : data.progreso,
    fecha_final: data.fecha_final || null,
  }
}

export async function createProyecto(data: Partial<Proyecto>): Promise<Proyecto> {
  return request<Proyecto>('/api/collections/is_proyectos/records', {
    method: 'POST',
    body: JSON.stringify(normalizeProyecto(data)),
  })
}

export async function updateProyecto(id: string, data: Partial<Proyecto>): Promise<Proyecto> {
  return request<Proyecto>(`/api/collections/is_proyectos/records/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(normalizeProyecto(data)),
  })
}

export async function deleteProyecto(id: string): Promise<void> {
  await request(`/api/collections/is_proyectos/records/${id}`, { method: 'DELETE' })
}

// ---------- Pagos ----------

export async function listPagosPorEntidad(
  entidadId: string,
  entidadTipo: EntidadTipo = 'proyecto',
): Promise<Pago[]> {
  const data = await request<{ items: Pago[] }>(
    `/api/collections/is_pagos/records?perPage=200&sort=-fecha&filter=${encodeURIComponent(
      `entidad_id="${entidadId}" && entidad_tipo="${entidadTipo}"`,
    )}`,
  )
  return data.items
}

/** Normaliza el parámetro de comprobantes a un array de File */
function toFileArray(value?: File[] | File | null): File[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

/** Crea un pago; los comprobantes (PDF/imagen) se suben como archivos (permite varios) */
export async function createPago(
  data: Partial<Pago>,
  comprobantes?: File[] | File | null,
): Promise<Pago> {
  const form = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    if (key === 'comprobante') return // los archivos se adjuntan aparte
    if (value != null && value !== '') form.append(key, String(value))
  })
  toFileArray(comprobantes).forEach((f) => form.append('comprobante', f))

  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}/api/collections/is_pagos/records`, {
    method: 'POST',
    body: form,
    headers,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message || `Error ${res.status}`)
  }
  return res.json()
}

/** Normaliza el campo comprobante a un array de nombres de archivo */
export function getComprobantes(pago: Pago): string[] {
  const value: unknown = pago.comprobante
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean).map(String)
  // PocketBase puede devolver varios archivos como string separado por comas
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Lista de comprobantes adjuntos de un pago (nombre + URL) */
export function getComprobanteFiles(pago: Pago): { name: string; url: string }[] {
  // PocketBase acepta el nombre de la colección en la URL de archivos
  return getComprobantes(pago).map((name) => ({
    name,
    url: `${BASE_URL}/api/files/is_pagos/${pago.id}/${name}`,
  }))
}

/** URL del primer comprobante adjunto de un pago (o null si no tiene) */
export function getComprobanteUrl(pago: Pago): string | null {
  return getComprobanteFiles(pago)[0]?.url ?? null
}

/**
 * Actualiza un pago; los comprobantes nuevos (PDF/imagen) se suben como archivos.
 * Con `appendComprobantes: true` se AÑADEN a los existentes (prefijo "+" de PocketBase)
 * en lugar de reemplazarlos.
 */
export async function updatePago(
  id: string,
  data: Partial<Pago>,
  comprobantes?: File[] | File | null,
  options: { appendComprobantes?: boolean } = {},
): Promise<Pago> {
  const form = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    if (key === 'comprobante') return // los archivos se adjuntan aparte
    if (value != null && value !== '') form.append(key, String(value))
  })
  const files = toFileArray(comprobantes)
  if (files.length > 0) {
    const key = options.appendComprobantes ? '+comprobante' : 'comprobante'
    files.forEach((f) => form.append(key, f))
  }

  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}/api/collections/is_pagos/records/${id}`, {
    method: 'PATCH',
    body: form,
    headers,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message || `Error ${res.status}`)
  }
  return res.json()
}

export async function deletePago(id: string): Promise<void> {
  await request(`/api/collections/is_pagos/records/${id}`, { method: 'DELETE' })
}

// ---------- Servicios ----------

export async function listServicios(): Promise<Servicio[]> {
  const data = await request<{ items: Servicio[] }>(
    '/api/collections/is_servicios/records?perPage=200&sort=-created',
  )
  return data.items
}

export async function getServicio(id: string): Promise<Servicio> {
  return request<Servicio>(`/api/collections/is_servicios/records/${id}`)
}

/** Normaliza los campos de texto antes de enviarlos a la BD */
function normalizeServicio(data: Partial<Servicio>): Partial<Servicio> {
  return {
    ...data,
    servicio: data.servicio != null ? normalizeName(data.servicio) : data.servicio,
    descripcion: data.descripcion != null ? upperFirst(data.descripcion) : data.descripcion,
    observaciones:
      data.observaciones != null ? upperFirst(data.observaciones) : data.observaciones,
    total: data.total != null ? Number(data.total) : data.total,
    duracion_dias: data.duracion_dias != null ? Number(data.duracion_dias) : data.duracion_dias,
    fecha_final: data.fecha_final || null,
  }
}

export async function createServicio(data: Partial<Servicio>): Promise<Servicio> {
  return request<Servicio>('/api/collections/is_servicios/records', {
    method: 'POST',
    body: JSON.stringify(normalizeServicio(data)),
  })
}

export async function updateServicio(id: string, data: Partial<Servicio>): Promise<Servicio> {
  return request<Servicio>(`/api/collections/is_servicios/records/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(normalizeServicio(data)),
  })
}

export async function deleteServicio(id: string): Promise<void> {
  await request(`/api/collections/is_servicios/records/${id}`, { method: 'DELETE' })
}

/**
 * Crea los pagos pendientes de un servicio en is_pagos.
 * Cada pago lleva el MISMO monto (el total del servicio) con las fechas
 * calculadas según la periocidad entre fecha_inicio y fecha_final.
 */
export async function crearPagosPendientes(
  entidadId: string,
  fechas: string[],
  monto: number,
  observaciones = '',
): Promise<void> {
  if (fechas.length === 0) return

  for (const fecha of fechas) {
    await createPago({
      monto,
      adelanto: 0,
      que_es: 'deuda',
      fecha,
      estado: 'pendiente',
      metodo_pago: 'Efectivo',
      observaciones,
      entidad_id: entidadId,
      entidad_tipo: 'servicio',
    })
  }
}