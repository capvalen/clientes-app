<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import {
  IconUsers,
  IconFolder,
  IconTools,
  IconCash,
  IconSettings,
  IconDeviceDesktop,
  IconLogout,
  IconMenu2,
  IconX,
} from '@tabler/icons-vue'
import { isAuthenticated, clearToken, ensureSession } from './api/pocketbase'
import Toasts from './components/Toasts.vue'

const route = useRoute()
const router = useRouter()

/** Versión de la app (inyectada desde package.json en build) */
const version = __APP_VERSION__

const authed = ref(isAuthenticated())
const menuOpen = ref(false)

watch(
  () => route.fullPath,
  () => {
    authed.value = isAuthenticated()
    // Cerrar el offcanvas al navegar
    menuOpen.value = false
  },
)

// Bloquear el scroll del body mientras el offcanvas está abierto
watch(menuOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

// La sesión dejó de ser válida (token expirado y sin poder refrescar)
function onAuthExpired() {
  authed.value = false
  menuOpen.value = false
  router.push({ name: 'login', query: { redirect: route.fullPath } })
}

// Refresco periódico del token mientras la app está abierta
let refreshTimer: number | undefined

onMounted(() => {
  // Extiende la sesión al iniciar la app (sesión deslizante)
  if (authed.value) ensureSession(true)
  // Revisa/renueva cada 30 minutos para sesiones de larga duración
  refreshTimer = window.setInterval(() => ensureSession(), 30 * 60 * 1000)
  window.addEventListener('pb:auth-expired', onAuthExpired)
})

onUnmounted(() => {
  if (refreshTimer) window.clearInterval(refreshTimer)
  window.removeEventListener('pb:auth-expired', onAuthExpired)
})

function logout() {
  clearToken()
  authed.value = false
  menuOpen.value = false
  router.push('/login')
}
</script>

<template>
  <template v-if="route.name !== 'login'">
    <!-- Barra superior horizontal (100% del ancho) -->
    <nav class="topbar">
      <div class="brand">
        <img src="/infocat_transparente.png" alt="Deal Desk" class="brand-logo" />
        <strong>Deal Desk - Gestión de Mesa de contratos</strong>
      </div>

      <!-- Hamburguesa (solo móvil/tablet) -->
      <button
        class="burger"
        type="button"
        aria-label="Abrir menú"
        :aria-expanded="menuOpen"
        @click="menuOpen = true"
      >
        <IconMenu2 :size="24" />
      </button>

      <button v-if="authed" class="logout topbar-logout" @click="logout">
        <IconLogout :size="16" /> Salir
      </button>
    </nav>

    <!-- Menú vertical (sidebar en escritorio) -->
    <header class="sidebar">
      <nav class="menu">
        <RouterLink to="/cliente"><IconUsers :size="16" /> Clientes</RouterLink>
        <RouterLink to="/proyecto"><IconFolder :size="16" /> Proyectos</RouterLink>
        <RouterLink to="/servicio"><IconTools :size="16" /> Servicios</RouterLink>
        <RouterLink to="/cobro"><IconCash :size="16" /> Cobros</RouterLink>
        <RouterLink to="/opciones"><IconSettings :size="16" /> Opciones</RouterLink>
      </nav>
    </header>

    <!-- Offcanvas (móvil/tablet) -->
    <Transition name="fade">
      <div v-if="menuOpen" class="offcanvas-backdrop" @click="menuOpen = false"></div>
    </Transition>

    <Transition name="slide">
      <aside v-if="menuOpen" class="offcanvas" role="dialog" aria-label="Menú">
        <div class="offcanvas-head">
          <div class="brand">
            <img src="/infocat_transparente.png" alt="Deal Desk" class="brand-logo" />
            <strong>Deal Desk</strong>
          </div>
          <button class="close" type="button" aria-label="Cerrar menú" @click="menuOpen = false">
            <IconX :size="22" />
          </button>
        </div>

        <nav class="menu">
          <RouterLink to="/cliente"><IconUsers :size="18" /> Clientes</RouterLink>
          <RouterLink to="/proyecto"><IconFolder :size="18" /> Proyectos</RouterLink>
          <RouterLink to="/servicio"><IconTools :size="18" /> Servicios</RouterLink>
          <RouterLink to="/cobro"><IconCash :size="18" /> Cobros</RouterLink>
          <RouterLink to="/opciones"><IconSettings :size="18" /> Opciones</RouterLink>
        </nav>

        <button v-if="authed" class="logout" @click="logout">
          <IconLogout :size="18" /> Salir
        </button>
      </aside>
    </Transition>
  </template>

  <RouterView />

  <footer v-if="route.name !== 'login'" class="app-footer">
    <span class="footer-item">
      <IconDeviceDesktop :size="16" /> v{{ version }}
    </span>
    <span class="footer-item">
      Desarrollado por:
      <a href="https://infocatsoluciones.com" target="_blank" rel="noopener">
        Infocat Soluciones
      </a>
    </span>
  </footer>

  <Toasts />
</template>

<style scoped>
/* Pie de página con la versión y el crédito */
.app-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  flex-wrap: wrap;
  margin-top: 2rem;
  padding: 1rem;
  text-align: center;
  font-size: 0.8rem;
  color: var(--color-text-2);
  border-top: 1px solid var(--color-border);
}

.footer-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.app-footer a {
  color: var(--color-primary-dark);
  font-weight: 600;
  text-decoration: none;
  padding: 0;
  transition: none;
}

.app-footer a:hover {
  background-color: transparent;
  text-decoration: underline;
}

/* Barra superior horizontal */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.05rem;
  color: var(--color-text);
  min-width: 0;
}

.brand strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand-logo {
  height: 28px;
  width: auto;
  flex-shrink: 0;
}

/* Hamburguesa: visible solo en móvil/tablet */
.burger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.4rem;
  border: 1px solid var(--color-border);
  border-radius: 0.35rem;
  background: none;
  color: var(--color-text);
  cursor: pointer;
  flex-shrink: 0;
}

.burger:hover {
  background-color: var(--color-background-mute);
}

.logout {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.9rem;
  border: 0;
  border-radius: 0.35rem;
  background: none;
  color: #e5484d;
  cursor: pointer;
  font-size: 14px;
}

.logout:hover {
  background-color: rgba(229, 72, 77, 0.1);
}

/* En móvil el logout vive dentro del offcanvas */
.topbar-logout {
  display: none;
}

/* Menú vertical: oculto en móvil, sidebar en escritorio */
.sidebar {
  display: none;
  line-height: 1.5;
}

.menu {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.25rem;
  padding: 1rem 0;
}

.menu a {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  border-radius: 0.35rem;
  color: var(--color-text);
  text-decoration: none;
  font-size: 14px;
}

.menu a:hover {
  background-color: hsl(var(--primary) / 0.12);
}

.menu a.router-link-exact-active {
  background-color: hsl(var(--primary) / 0.18);
  color: var(--color-primary-dark);
  font-weight: 600;
}

/* ---- Offcanvas (móvil/tablet) ---- */
.offcanvas-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 40;
}

.offcanvas {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: min(290px, 84vw);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: #ffffff;
  box-shadow: 4px 0 16px rgba(0, 0, 0, 0.15);
  overflow-y: auto;
  z-index: 50;
}

.offcanvas-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.offcanvas .menu {
  padding: 0.5rem 0;
}

.offcanvas .menu a {
  padding: 0.75rem;
  font-size: 15px;
}

.offcanvas .logout {
  margin-top: auto;
  justify-content: center;
}

.close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.4rem;
  border: 0;
  border-radius: 0.35rem;
  background: none;
  color: var(--color-text);
  cursor: pointer;
  flex-shrink: 0;
}

.close:hover {
  background-color: var(--color-background-mute);
}

/* Transiciones */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}

@media (min-width: 1024px) {
  .topbar {
    grid-column: 1 / -1;
    padding: 0.75rem 1.5rem;
  }

  .burger {
    display: none;
  }

  .topbar-logout {
    display: inline-flex;
  }

  .sidebar {
    display: block;
    position: sticky;
    top: 0;
    height: calc(100vh - 57px);
    padding: 1.5rem 0;
    border-right: 1px solid var(--color-border);
  }

  .menu {
    padding: 0 1rem;
  }

  /* El offcanvas no aplica en escritorio */
  .offcanvas,
  .offcanvas-backdrop {
    display: none;
  }

  .app-footer {
    grid-column: 1 / -1;
  }
}
</style>
