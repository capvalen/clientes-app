import { createRouter, createWebHistory } from 'vue-router'
import { isAuthenticated } from '../api/pocketbase'

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
  ],
})

router.beforeEach((to) => {
  if (to.name !== 'login' && !isAuthenticated()) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'login' && isAuthenticated()) {
    return { name: 'cliente' }
  }
})

export default router
