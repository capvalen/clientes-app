<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { IconBuildingStore, IconUsers, IconFolder, IconLogout } from '@tabler/icons-vue'
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
  <header v-if="route.name !== 'login'">
    <div class="brand">
      <IconBuildingStore :size="22" />
      <strong>Customers App</strong>
    </div>

    <nav>
      <RouterLink to="/cliente"><IconUsers :size="16" /> Clientes</RouterLink>
      <RouterLink to="/proyecto"><IconFolder :size="16" /> Proyectos</RouterLink>
    </nav>

    <button v-if="authed" class="logout" @click="logout"><IconLogout :size="16" /> Salir</button>
  </header>

  <RouterView />
</template>

<style scoped>
header {
  line-height: 1.5;
  display: flex;
  flex-direction: column;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem 1rem;
  font-size: 1.05rem;
  color: var(--color-text);
}

nav {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.25rem;
  padding: 0.5rem 0;
}

nav a {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  border-radius: 0.35rem;
  color: var(--color-text);
  text-decoration: none;
  font-size: 14px;
}

nav a:hover {
  background-color: hsla(160, 100%, 37%, 0.12);
}

nav a.router-link-exact-active {
  background-color: hsla(160, 100%, 37%, 0.18);
  color: hsla(160, 100%, 30%, 1);
  font-weight: 600;
}

.logout {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  border-radius: 0.35rem;
  border: 0;
  background: none;
  color: #e5484d;
  cursor: pointer;
  font-size: 14px;
  text-align: left;
  margin-top: auto;
}

.logout:hover {
  background-color: rgba(229, 72, 77, 0.1);
}

@media (min-width: 1024px) {
  header {
    position: sticky;
    top: 0;
    height: 100vh;
    padding: 1.5rem 0;
    border-right: 1px solid var(--color-border);
  }

  .brand {
    padding: 0.5rem 1.5rem 1.25rem;
  }

  nav {
    padding: 0 1rem;
  }

  .logout {
    margin: 0 1rem 0.5rem;
  }
}
</style>
