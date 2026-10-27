/**
 * Tema de color primario de la aplicación.
 * El estado es un singleton y se persiste en localStorage.
 */
import { ref, watch } from 'vue'

export type ThemeId = 'verde' | 'naranja' | 'morado' | 'grises'

export interface ThemeOption {
  id: ThemeId
  label: string
  color: string
}

/** Los colores deben coincidir con THEME_COLORS del script inline de index.html */
export const THEMES: ThemeOption[] = [
  { id: 'verde', label: 'Verde', color: '#00bd7e' },
  { id: 'naranja', label: 'Naranja', color: '#f97316' },
  { id: 'morado', label: 'Morado', color: '#7c3aed' },
  { id: 'grises', label: 'Grises', color: '#4b5563' },
]

const STORAGE_KEY = 'pb_theme'

function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((t) => t.id === value)
}

const stored = localStorage.getItem(STORAGE_KEY)

export const theme = ref<ThemeId>(isThemeId(stored) ? stored : 'verde')

function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id
  const meta = document.querySelector('meta[name="theme-color"]')
  const color = THEMES.find((t) => t.id === id)?.color
  if (meta && color) meta.setAttribute('content', color)
}

/** Cambia el tema activo en toda la aplicación */
export function setTheme(id: ThemeId) {
  theme.value = id
}

watch(
  theme,
  (value) => {
    applyTheme(value)
    localStorage.setItem(STORAGE_KEY, value)
  },
  { immediate: true },
)
