<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import { IconArrowLeft, IconHome } from '@tabler/icons-vue'

defineProps<{
  items: { label: string; to?: string }[]
}>()

const router = useRouter()
</script>

<template>
  <nav class="breadcrumbs">
    <button type="button" class="back" title="Volver" @click="router.back()">
      <IconArrowLeft :size="16" /> Volver
    </button>

    <div class="trail">
      <IconHome :size="16" class="home" />
      <template v-for="(item, i) in items" :key="i">
        <span class="sep">/</span>
        <RouterLink v-if="item.to" :to="item.to">{{ item.label }}</RouterLink>
        <span v-else class="current">{{ item.label }}</span>
      </template>
    </div>
  </nav>
</template>

<style scoped>
.breadcrumbs {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  align-self: flex-start;
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 0.35rem;
  background: var(--color-background-soft);
  color: var(--color-text);
  cursor: pointer;
  font-size: 0.9rem;
}

.back:hover {
  background: var(--color-background-mute);
}

.trail {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  font-size: 0.9rem;
}

.home {
  color: hsla(160, 100%, 30%, 1);
}

.sep {
  color: var(--color-text-2);
}

.current {
  color: var(--color-text-2);
}
</style>