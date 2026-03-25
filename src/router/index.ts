import { createRouter, createWebHashHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/about',
      name: 'about',
      component: HomeView
    },
    {
      path: '/directory',
      name: 'directory',
      component: HomeView
    },
    {
      path: '/products',
      name: 'products',
      component: HomeView
    },
    {
      path: '/resources',
      name: 'resources',
      component: HomeView
    },
    {
      path: '/directory/:slug',
      name: 'breeder-profile',
      component: () => import('../views/BreederProfileView.vue')
    },
    {
      path: '/directory/:slug/edit',
      name: 'breeder-edit',
      component: () => import('../views/BreederEditView.vue')
    },
    {
      path: '/admin/inbox',
      name: 'admin-inbox',
      component: () => import('../views/AdminInboxView.vue')
    }
  ],
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    }
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth' };
    }
    const sections = ['/about', '/directory', '/products', '/resources'];
    if (sections.includes(to.path)) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ el: `#${to.path.substring(1)}`, behavior: 'smooth' });
        }, 100);
      });
    }
    return { top: 0 };
  }
});

export default router;