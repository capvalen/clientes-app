import { createRouter, createWebHistory } from 'vue-router'
import { isAuthenticated } from '../api/pocketbase'
import { isDniAdmin } from '../utils/session'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/cliente',
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/cliente',
      name: 'cliente',
      // route level code-splitting
      // this generates a separate chunk (Cliente.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/ClienteView.vue'),
    },
    {
      path: '/cliente/:id',
      name: 'cliente-detalle',
      component: () => import('../views/ClienteDetalleView.vue'),
    },
    {
      path: '/proyecto',
      name: 'proyecto',
      component: () => import('../views/ProyectoView.vue'),
    },
    {
      path: '/proyecto/:id',
      name: 'proyecto-detalle',
      component: () => import('../views/ProyectoDetalleView.vue'),
    },
    {
      path: '/servicio',
      name: 'servicio',
      component: () => import('../views/ServicioView.vue'),
    },
    {
      path: '/servicio/:id',
      name: 'servicio-detalle',
      component: () => import('../views/ServicioDetalleView.vue'),
    },
    {
      path: '/cobro',
      name: 'cobro',
      component: () => import('../views/CobroView.vue'),
    },
    {
      path: '/opciones',
      name: 'opciones',
      component: () => import('../views/OpcionesView.vue'),
    },
    {
      path: '/dnis',
      name: 'dnis',
      // Módulo privado: solo para el usuario cpariona con perfil administrador
      meta: { requiresDniAdmin: true },
      component: () => import('../views/DniView.vue'),
    },
  ],
})

router.beforeEach((to) => {
  if (to.name !== 'login' && !isAuthenticated()) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'login' && isAuthenticated()) {
    return { name: 'cliente' }
  }
  if (to.meta.requiresDniAdmin && !isDniAdmin()) {
    return { name: 'cliente' }
  }
})

export default router
