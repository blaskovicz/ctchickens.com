import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import store from './store';
import router from './router';
import { createBootstrap } from 'bootstrap-vue-next';

const app = createApp(App);
app.use(store);
app.use(router);
app.use(createBootstrap());
app.mount('#app');
