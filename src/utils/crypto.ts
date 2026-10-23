/**
 * Cifrado de secretos con Web Crypto API (AES-GCM + PBKDF2).
 *
 * La clave maestra (contraseña) se guarda en `sessionStorage` al crearla en
 * la vista "Opciones". Para revelar secretos se pide la clave y queda
 * desbloqueada durante 5 minutos (en memoria).
 *
 * Formato del texto cifrado: `saltBase64.ivBase64.cipherBase64`
 * - salt: aleatorio de 16 bytes (para PBKDF2)
 * - iv: aleatorio de 12 bytes (para AES-GCM)
 * - cipher: texto cifrado + tag de autenticación
 */
import { ref } from 'vue'

const enc = new TextEncoder()
const dec = new TextDecoder()

const PBKDF2_ITERATIONS = 150_000
const SALT_BYTES = 16
const IV_BYTES = 12

/** Clave maestra desbloqueada hasta este instante (ms). 0 = bloqueada. */
const unlockedUntil = ref(0)

/** Tiempo de desbloqueo de la clave al revelar (5 minutos) */
export const UNLOCK_MS = 5 * 60 * 1000

// ---------- Base64 <-> bytes ----------
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// ---------- Derivación de clave ----------
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

// ---------- Cifrado / Descifrado ----------
/** Cifra un texto con la clave dada. Devuelve `salt.iv.cipher` en base64 */
export async function encryptText(plain: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(password, salt)
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    enc.encode(plain),
  )
  return `${bytesToBase64(salt)}.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(cipher))}`
}

/** Descifra un texto `salt.iv.cipher`. Lanza si la clave es incorrecta o el formato inválido */
export async function decryptText(payload: string, password: string): Promise<string> {
  const parts = payload.split('.')
  if (parts.length !== 3) throw new Error('Formato cifrado inválido')
  const [saltB64, ivB64, cipherB64] = parts as [string, string, string]
  const key = await deriveKey(password, base64ToBytes(saltB64))
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(ivB64) as BufferSource },
    key,
    base64ToBytes(cipherB64) as BufferSource,
  )
  return dec.decode(plain)
}

// ---------- Clave maestra (sessionStorage) ----------
const MASTER_KEY_STORAGE = 'dd_master_key'

/**
 * Clave de aplicación (build-time) para ofuscar la clave maestra guardada.
 * OJO: al ser una SPA, este valor viaja en el bundle (visible en el JS); por eso
 * esto es OFUSCACIÓN (no secreto real), pensada para no dejar la clave "a la vista".
 */
const APP_CIPHER_KEY: string = import.meta.env.VITE_INFOCAT_CIFRA ?? ''

/** Marca para distinguir valores ofuscados de texto plano heredado */
const OBF_PREFIX = 'obf1:'

/** Ofusca un texto con la clave de aplicación (XOR + base64). Síncrono. */
function obfuscate(text: string): string {
  if (!APP_CIPHER_KEY) return text
  const key = enc.encode(APP_CIPHER_KEY)
  const data = enc.encode(text)
  const out = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i++) out[i] = (data[i] as number) ^ (key[i % key.length] as number)
  return OBF_PREFIX + bytesToBase64(out)
}

/** Revierte `obfuscate`. Si el valor no está ofuscado, lo devuelve tal cual. */
function deobfuscate(text: string): string {
  if (!text.startsWith(OBF_PREFIX)) return text // valor heredado en texto plano
  if (!APP_CIPHER_KEY) return ''
  try {
    const key = enc.encode(APP_CIPHER_KEY)
    const data = base64ToBytes(text.slice(OBF_PREFIX.length))
    const out = new Uint8Array(data.length)
    for (let i = 0; i < data.length; i++)
      out[i] = (data[i] as number) ^ (key[i % key.length] as number)
    return dec.decode(out)
  } catch {
    return ''
  }
}

/** Contraseña maestra guardada en la sesión del navegador (o null) */
export function getMasterPassword(): string | null {
  const stored = sessionStorage.getItem(MASTER_KEY_STORAGE)
  if (stored == null) return null
  const pass = deobfuscate(stored)
  return pass || null
}

/** Indica si ya existe una clave maestra creada en esta sesión */
export function hasMasterPassword(): boolean {
  return !!getMasterPassword()
}

/** Guarda la clave maestra en la sesión (ofuscada) */
export function setMasterPassword(password: string) {
  sessionStorage.setItem(MASTER_KEY_STORAGE, obfuscate(password))
}

/** Elimina la clave maestra de la sesión */
export function clearMasterPassword() {
  sessionStorage.removeItem(MASTER_KEY_STORAGE)
  lockMaster()
}

// ---------- Desbloqueo temporal (5 min) ----------
/** Marca la clave como desbloqueada durante los próximos 5 minutos */
export function unlockMaster() {
  unlockedUntil.value = Date.now() + UNLOCK_MS
}

/** Bloquea la clave de inmediato (vuelve a pedirla para revelar) */
export function lockMaster() {
  unlockedUntil.value = 0
}

/** ¿La clave está desbloqueada ahora mismo? */
export function isMasterUnlocked(): boolean {
  return Date.now() < unlockedUntil.value
}

/** Segundos que quedan de desbloqueo (0 si está bloqueada) */
export function masterUnlockSecondsLeft(): number {
  return Math.max(0, Math.ceil((unlockedUntil.value - Date.now()) / 1000))
}
