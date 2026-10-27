import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import Monto from './components/Monto.vue'
import './utils/theme'

const app = createApp(App)

app.use(router)
app.component('Monto', Monto)

app.mount('#app')

// Registra el service worker para que la app sea instalable en Android (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Si falla el registro, la app sigue funcionando con normalidad
    })
  })
}
