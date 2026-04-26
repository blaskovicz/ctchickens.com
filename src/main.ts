import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import store from './store';
import router from './router';
import { createBootstrap } from 'bootstrap-vue-next';

window.addEventListener('error', (event) => {
  const target = event.target;
  if (target instanceof HTMLLinkElement || target instanceof HTMLScriptElement) {
    const key = 'asset-error-reload';
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      window.location.reload();
    }
  }
}, true);

const app = createApp(App);
app.use(store);
app.use(router);
app.use(createBootstrap());
app.mount('#app');
