# Prompt: implementar el módulo “Proyecto DNIs”

Copia y pega este documento como instrucción para otra IA. Describe la API real,
el formato de datos, las notificaciones y la UI que debe implementar.

---

## 1. Objetivo

Implementar en una app **Vue 3 + TypeScript + Vite** un módulo llamado **Proyecto DNIs**
que permita:

1. Consultar un DNI automáticamente contra un Worker externo.
2. Alimentar (registrar) un DNI manualmente con DNI, apellidos y nombres.
3. Ver los últimos 5 DNIs registrados.
4. Ver la lista de DNIs desconocidos (no encontrados).
5. Copiar un DNI al portapapeles.
6. Eliminar un DNI de la lista de desconocidos.

El módulo solo debe ser visible y accesible para el usuario
`cpariona` con perfil `administrador`.

---

## 2. API

**Base URL:**

```
https://dnis.infocat.workers.dev
```

El token se obtiene de la variable de entorno `VITE_INFOCAT_DNI` y viaja **en la URL**.

### 2.1 Consultar un DNI (Automático)

```
GET /api/dni/{dni}/{token}
```

- `{dni}`: 8 dígitos.
- `{token}`: valor de `VITE_INFOCAT_DNI`.

Estados:

| Estado | Significado | Acción esperada |
| ------ | ----------- | --------------- |
| 200 / 201 | Encontrado / registrado | Notificación de éxito |
| 404 | No encontrado o token inválido | Notificación de error con el mensaje de la API |

Ejemplos de error reales:

```json
{ "error": "Token inválido o Usuario inactivo" }
```

> El cuerpo exacto de una respuesta exitosa de este endpoint no está confirmado.
> El código debe tolerar que devuelva la persona directamente o dentro de
> `data`/`record`, con los campos `apellido`/`apellidos` y `nombre`/`nombres`.
> Si vienen, se pueden rellenar los inputs del formulario.

### 2.2 Alimentar un DNI (Manual)

```
POST /api/alimentar/{token}
Content-Type: application/json
```

Body:

```json
{
  "dni": "46684494",
  "apellido": "PALMA BLANCAS",
  "nombre": "ANAHIT ROSARIO"
}
```

- Enviar `dni` sin espacios.
- Enviar `apellido` y `nombre` en MAYÚSCULAS y sin espacios sobrantes.
- Estados `200` / `201` = éxito. `404` = error.

### 2.3 Últimos DNIs

```
GET /api/ultimos-dnis/{token}
```

Respuesta real (ejemplo):

```json
{
  "total": 10,
  "personas": [
    {
      "id": 20144,
      "dni": "73961099",
      "apellido": "LOZANO VASQUEZ",
      "nombre": "ABIGAHIL HELEN",
      "direccion": "",
      "created_at": "2026-10-26T21:28:31.011Z"
    }
  ]
}
```

Formato de una persona (registro de DNI):

```ts
interface PersonaDni {
  id: number
  dni: string
  apellido: string
  nombre: string
  direccion: string
  created_at: string
}
```

- La lista viene ordenada del más reciente al más antiguo.
- En la UI se muestran **solo los 5 primeros** (`slice(0, 5)`).
- La fecha visible se toma de `created_at`.

### 2.4 DNIs desconocidos

```
GET /api/desconocidos
```

> Este endpoint **no lleva token**.

Respuesta real (ejemplo):

```json
{
  "total": 4,
  "dnis": [
    { "id": 5, "dni": "62467184" },
    { "id": 4, "dni": "77599009" }
  ]
}
```

- En la UI **no mostrar el `id`**.
- Los badges de esta lista van en tonos rojos.

### 2.5 Eliminar un DNI desconocido

```
DELETE /api/desconocidos/eliminar/{dni}/{token}
```

- Estados 2xx = eliminado.
- Cualquier otro estado = error con el mensaje de la API.

---

## 3. Configuración `.env`

Agregar en `.env` y `.env.example`:

```env
VITE_INFOCAT_DNI=cambia-esta-clave
```

Tipar la variable (por ejemplo en `env.d.ts`):

```ts
interface ImportMetaEnv {
  readonly VITE_INFOCAT_DNI?: string
}
```

Helpers:

```ts
export function getDniToken(): string {
  return String(import.meta.env.VITE_INFOCAT_DNI ?? '').trim()
}

export function hasDniToken(): boolean {
  return getDniToken().length > 0
}
```

Notas:

- Si no hay token, mostrar un aviso: `Falta configurar VITE_INFOCAT_DNI en el .env`.
- Al ser una SPA, el valor de una variable `VITE_*` queda visible en el bundle.
- Con un token inválido la API responde `404` (`Token inválido o Usuario inactivo`)
  o `403` (`Usuario no identificado`) según el endpoint.

---

## 4. Acceso restringido

Leer el usuario desde `localStorage` con la clave `user`:

```json
{ "user": "cpariona", "perfil": "administrador" }
```

Regla (comparar sin distinguir mayúsculas/minúsculas y recortando espacios):

```ts
export function isDniAdmin(): boolean {
  const raw = localStorage.getItem('user')
  if (!raw) return false
  try {
    const user = JSON.parse(raw)
    return (
      String(user.user ?? '').trim().toLowerCase() === 'cpariona' &&
      String(user.perfil ?? '').trim().toLowerCase() === 'administrador'
    )
  } catch {
    return false
  }
}
```

Debe aplicarse en dos lugares:

1. **Menú**: mostrar el ítem “Proyecto DNIs” solo si `isDniAdmin()`.
2. **Router**: ruta `/dnis` con `meta: { requiresDniAdmin: true }`; si no cumple,
   redirigir a la vista principal (por ejemplo `/cliente`).

Para probar, en la consola del navegador:

```js
localStorage.setItem(
  'user',
  JSON.stringify({ user: 'cpariona', perfil: 'administrador' }),
)
```

---

## 5. Notificaciones (toasts)

Usar el sistema de toasts existente de la app, por ejemplo:

```ts
showToast(mensaje, 'success' | 'error' | 'info')
```

- `success` → verde.
- `error` → rojo.
- `info` → azul.

Reglas para el módulo DNIs:

| Caso | Toast | Tipo |
| ---- | ----- | ---- |
| Consulta/registro con estado 200 o 201 | `DNI {dni} registrado` | `success` |
| 404 al consultar | mensaje de la API o `DNI {dni} no encontrado` | `error` |
| Otro estado HTTP | mensaje de la API o `Error {status}` | `error` |
| Fallo de red | mensaje de la excepción | `error` |
| DNI copiado | `DNI {dni} copiado` | `success` |
| DNI desconocido eliminado | `DNI {dni} eliminado` | `error` (rojo) |
| Falta el token | `Falta configurar VITE_INFOCAT_DNI en el .env` | `error` |

La notificación de éxito debe ser **exactamente** `DNI {dni} registrado`
(sin textos adicionales como “encontrado” o “ya registrado”).

---

## 6. UI

### 6.1 Formulario

Card blanca con:

- Título: **Alimentar información**.
- Tres inputs **sin placeholders**:
  1. `DNI *` — solo dígitos, máximo 8, `inputmode="numeric"`.
  2. `Apellidos *`.
  3. `Nombres *`.
- Dos botones debajo:
  - **Automático** → `GET /api/dni/{dni}/{token}`.
  - **Manual** → `POST /api/alimentar/{token}`.
- Mientras una petición está en curso, mostrar spinner y deshabilitar ambos botones.
- Validaciones:
  - DNI de 8 dígitos antes de cualquier acción.
  - En Manual, apellidos y nombres obligatorios.
  - En ambos, verificar que exista el token.

Tras un registro exitoso: limpiar el formulario (en Manual) y recargar ambas listas.

### 6.2 Listas

Debajo del formulario, dos tarjetas dentro de **un mismo row**:

- **Últimos DNIs** (máximo 5):
  - Badge del DNI con el color por defecto del tema (tono primario).
  - Apellidos y nombres.
  - Fecha formateada desde `created_at`.
  - Botón **Copiar**.
- **DNIs desconocidos**:
  - Badge del DNI en **tonos rojos** (fondo rojo suave, borde rojo, texto rojo oscuro).
  - Texto “No registrado”. **No mostrar el `id`**.
  - Botón **Copiar**.
  - Botón de ícono de papelera **rojo** para eliminar.
  - Al eliminar: `confirm()` previo, spinner en el botón, toast rojo y recarga de la lista.

Layout:

- Escritorio (`min-width: 1024px`): las dos tarjetas en **2 columnas**
  (`display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start;`).
- Móvil/tablet: una debajo de otra.
- Todas las tarjetas y cada ítem de las listas con **fondo blanco**.

Cada tarjeta de lista debe tener su propio botón **Actualizar**, y estados de
carga, lista vacía y error.

### 6.3 Copiar DNI

```ts
async function copiarDni(dni: string) {
  if (!dni) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(dni)
    } else {
      const ta = document.createElement('textarea')
      ta.value = dni
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    showToast(`DNI ${dni} copiado`, 'success')
  } catch {
    showToast('No se pudo copiar el DNI', 'error')
  }
}
```

---

## 7. Estructura sugerida

```
src/api/dnis.ts        → cliente de la API (tipos, fetch, normalización)
src/utils/session.ts   → lectura de localStorage.user e isDniAdmin()
src/views/DniView.vue  → formulario + ambas listas
src/router/index.ts    → ruta /dnis protegida
src/App.vue            → ítem de menú condicional
env.d.ts               → tipado de VITE_INFOCAT_DNI
```

Lógica clave del cliente (resumen):

```ts
const BASE_URL = 'https://dnis.infocat.workers.dev'

// GET /api/dni/{dni}/{token}
consultarDni(dni)

// POST /api/alimentar/{token}
alimentarDni({ dni, apellido, nombre })

// GET /api/ultimos-dnis/{token}
listUltimosDnis() // lee `personas`, usa `created_at`

// GET /api/desconocidos
listDnisDesconocidos() // lee `dnis`, sin token

// DELETE /api/desconocidos/eliminar/{dni}/{token}
eliminarDniDesconocido(dni)
```

Todas las respuestas deben normalizarse de forma tolerante: aceptar array directo
o envuelto en `items`, `data`, `dnis`, `personas`, `ultimos`, `results`.

---

## 8. Comandos de verificación

```bash
# Desarrollo
npm run dev

# Chequeo de tipos
npm run type-check

# Build
npm run build
```

Pruebas manuales con `curl` (reemplazar `<TOKEN>`):

```bash
# Consultar un DNI
curl -s "https://dnis.infocat.workers.dev/api/dni/46684494/<TOKEN>"

# Alimentar un DNI
curl -s -X POST "https://dnis.infocat.workers.dev/api/alimentar/<TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"dni":"46684494","apellido":"PALMA BLANCAS","nombre":"ANAHIT ROSARIO"}'

# Últimos DNIs
curl -s "https://dnis.infocat.workers.dev/api/ultimos-dnis/<TOKEN>"

# DNIs desconocidos (sin token)
curl -s "https://dnis.infocat.workers.dev/api/desconocidos"

# Eliminar un DNI desconocido
curl -s -X DELETE "https://dnis.infocat.workers.dev/api/desconocidos/eliminar/12345678/<TOKEN>"
```

---

## 9. Checklist final

- [ ] `VITE_INFOCAT_DNI` definido en `.env` y tipado en `env.d.ts`.
- [ ] Ítem “Proyecto DNIs” visible solo para `cpariona` / `administrador`.
- [ ] Ruta `/dnis` protegida por guard.
- [ ] Formulario con 3 inputs sin placeholders.
- [ ] Automático hace `GET /api/dni/{dni}/{token}`.
- [ ] Manual hace `POST /api/alimentar/{token}` con apellidos/nombres en mayúsculas.
- [ ] `200` y `201` muestran `DNI {dni} registrado` (verde).
- [ ] `404` y otros errores muestran toast rojo con el mensaje de la API.
- [ ] Últimos DNIs limitado a 5 y ordenado del más reciente al más antiguo.
- [ ] Desconocidos: badge rojo, sin `id`, con copiar y eliminar.
- [ ] Eliminar muestra toast rojo `DNI {dni} eliminado` y refresca la lista.
- [ ] Dos columnas en escritorio y una en móvil; tarjetas blancas.
- [ ] `npm run type-check` y `npm run build` sin errores.
