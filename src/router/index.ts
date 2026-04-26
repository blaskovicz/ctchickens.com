import { createRouter, createWebHashHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import DirectoryView from '../views/DirectoryView.vue';
import ResourcesView from '../views/ResourcesView.vue';
import { trackEvent } from '../firebase';

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
      redirect: '/resources'
    },
    {
      path: '/directory',
      name: 'directory',
      component: DirectoryView
    },
    {
      path: '/products',
      redirect: '/resources'
    },
    {
      path: '/resources',
      name: 'resources',
      component: ResourcesView
    },
    {
      path: '/get-listed/:slug?',
      name: 'get-listed',
      component: () => import('../views/BreederSignupView.vue')
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
      path: '/classified',
      name: 'classifieds',
      component: () => import('../views/ClassifiedsView.vue')
    },
    {
      path: '/classified/new',
      name: 'classified-new',
      component: () => import('../views/NewClassifiedView.vue')
    },
    {
      path: '/classified/:docId',
      name: 'classified-detail',
      component: () => import('../views/ClassifiedDetailView.vue')
    },
    {
      path: '/inbox/:threadId?',
      name: 'inbox',
      component: () => import('../views/InboxView.vue')
    },
    {
      path: '/admin/inbox',
      name: 'admin-inbox',
      component: () => import('../views/AdminInboxView.vue')
    },
    {
      path: '/admin/email',
      name: 'admin-email',
      component: () => import('../views/AdminEmailView.vue')
    },
    {
      path: '/profile',
      name: 'user-profile',
      component: () => import('../views/UserProfileView.vue')
    },
    {
      path: '/verify-email',
      name: 'verify-email',
      component: () => import('../views/VerifyEmailView.vue')
    }
  ],
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    }
        if (to.hash) {
      return { el: to.hash, behavior: 'smooth' };
    }
    const sections = ['/resources'];
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

router.onError((error, to) => {
  const isChunkLoadError =
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('Importing a module script failed') ||
    error.message.includes('Unable to preload CSS');
  if (isChunkLoadError) {
    try { trackEvent('chunk_load_error_reload', { path: to.fullPath }); } catch (_) {}
    window.location.href = '/#' + to.fullPath;
  }
});

router.afterEach((to) => {
  trackEvent('page_view', {
    page_path: to.fullPath,
    page_title: to.name?.toString() ?? to.path,
  });
});

export default router;