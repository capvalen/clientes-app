<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { IconUsers, IconFolder, IconTools, IconLogout } from '@tabler/icons-vue'
import { isAuthenticated, clearToken } from './api/pocketbase'

const route = useRoute()
const router = useRouter()

const authed = ref(isAuthenticated())

watch(
  () => route.fullPath,
  () => {
    authed.value = isAuthenticated()
  },
)

function logout() {
  clearToken()
  authed.value = false
  router.push('/login')
}
</script>

<template>
  <template v-if="route.name !== 'login'">
    <!-- Barra superior horizontal -->
    <nav class="topbar">
      <div class="brand">
        <img src="/infocat_transparente.png" alt="Infocat" class="brand-logo" />
        <strong>Gestión de Clientes - Infocat</strong>
      </div>
      <button v-if="authed" class="logout" @click="logout">
        <IconLogout :size="16" /> Salir
      </button>
    </nav>

    <!-- Menú vertical (sidebar) -->
    <header>
      <nav class="menu">
        <RouterLink to="/cliente"><IconUsers :size="16" /> Clientes</RouterLink>
        <RouterLink to="/proyecto"><IconFolder :size="16" /> Proyectos</RouterLink>
        <RouterLink to="/servicio"><IconTools :size="16" /> Servicios</RouterLink>
      </nav>
    </header>
  </template>

  <RouterView />
</template>

<style scoped>
/* Barra superior horizontal */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
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
}

.brand-logo {
  height: 28px;
  width: auto;
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

/* Menú vertical (sidebar) */
header {
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
  background-color: hsla(160, 100%, 37%, 0.12);
}

.menu a.router-link-exact-active {
  background-color: hsla(160, 100%, 37%, 0.18);
  color: hsla(160, 100%, 30%, 1);
  font-weight: 600;
}

@media (min-width: 1024px) {
  .topbar {
    grid-column: 1 / -1;
    padding: 0.75rem 1.5rem;
  }

  header {
    position: sticky;
    top: 0;
    height: calc(100vh - 57px);
    padding: 1.5rem 0;
    border-right: 1px solid var(--color-border);
  }

  .menu {
    padding: 0 1rem;
  }
}
</style>
