<script setup lang="ts">
import { METODOS_PAGO } from '../api/pocketbase'
import { metodoImagen } from '../utils/metodos'

/** Selector visual de método de pago (imagen + nombre) */
const model = defineModel<string>({ default: 'Efectivo' })
</script>

<template>
  <div class="metodo-picker">
    <button
      v-for="m in METODOS_PAGO"
      :key="m"
      type="button"
      class="metodo-option"
      :class="{ active: model === m }"
      @click="model = m"
    >
      <img v-if="metodoImagen(m)" :src="metodoImagen(m)!" :alt="m" />
      <span>{{ m }}</span>
    </button>
  </div>
</template>

<style scoped>
.metodo-picker {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
  gap: 0.5rem;
  margin-top: 0.35rem;
}

.metodo-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 0.35rem;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 0.75rem;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.metodo-option img {
  height: 32px;
  width: auto;
  max-width: 100%;
  object-fit: contain;
}

.metodo-option:hover {
  border-color: hsl(var(--primary) / 0.5);
}

.metodo-option.active {
  border-color: var(--color-primary);
  background: hsl(var(--primary) / 0.12);
  font-weight: 600;
}
</style>
