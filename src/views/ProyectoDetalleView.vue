<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()
const id = route.params.id as string
</script>

<template>
  <main>
    <h1>Proyecto {{ id }}</h1>
    <p>Detalle del proyecto con id {{ id }}.</p>
    <RouterLink to="/proyecto">← Volver a proyectos</RouterLink>
  </main>
</template>