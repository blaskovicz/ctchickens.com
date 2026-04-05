import { createRouter, createWebHashHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import { auth } from '../firebase';
import { getRedirectResult } from 'firebase/auth';

// --- AUTH REDIRECT JUICE ---
// We trigger this at the module level immediately. This happens as soon as 
// the router file is imported (which is before the app mounts).
// By calling it before createRouter(), we ensure the Firebase SDK reads the 
// URL parameters (juice) before Hash Mode cleans them up.
const redirectPromise = getRedirectResult(auth);
if (redirectPromise instanceof Promise) {
  void redirectPromise.catch(e => console.error("Router-level redirect error:", e));
}

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
      path: '/legal',
      name: 'legal',
      component: () => import('../views/LegalView.vue')
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
