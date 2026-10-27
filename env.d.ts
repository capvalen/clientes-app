/// <reference types="vite/client" />

/** Versión de la app inyectada desde package.json (ver vite.config.ts) */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /** Clave de aplicación para ofuscar la clave maestra (ver .env) */
  readonly VITE_INFOCAT_CIFRA?: string
  /** Token del servicio de DNIs (ver .env) */
  readonly VITE_INFOCAT_DNI?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
