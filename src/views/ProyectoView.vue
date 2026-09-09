<script setup lang="ts">
import { IconFolder } from '@tabler/icons-vue'
</script>

<template>
  <main>
    <h1>Proyectos</h1>
    <p class="muted"><IconFolder :size="16" /> Aún no hay proyectos configurados.</p>
  </main>
</template>

<style scoped>
.muted {
  color: var(--color-text-2);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
</style>