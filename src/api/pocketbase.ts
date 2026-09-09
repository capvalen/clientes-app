import { normalizeName, normalizeEmail, normalizeText } from '../utils/format'

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