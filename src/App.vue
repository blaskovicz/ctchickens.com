<script setup lang="ts">
  import 'bootstrap/dist/css/bootstrap.min.css';
  import 'bootstrap-icons/font/bootstrap-icons.css';
  import 'bootstrap/dist/js/bootstrap.bundle.min.js';
  import { useStore } from 'vuex';
  import { onMounted, watch, ref, computed, onUnmounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { BApp, BOrchestrator, useToast, BBadge } from 'bootstrap-vue-next';
  import AuthButton from './components/AuthButton.vue';
  import ClaimBanner from './components/ClaimBanner.vue';
  import InquiryModal from './components/InquiryModal.vue';
  import { db } from './firebase';
  import { collection, query, where, onSnapshot } from 'firebase/firestore';

  const store = useStore();
  const { create } = useToast();
  const gitCommitHash = import.meta.env.VITE_GIT_COMMIT_HASH || '';

  const router = useRouter();
  const user = computed(() => store.state.user);
  const isLoggedIn = computed(() => store.getters.isLoggedIn);
  const userData = computed(() => store.state.userData);
  const myFarms = computed(() => store.getters.myBreeders);
  const authReady = computed(() => store.getters.authReady);
  const totalUnread = ref(0);
  const mobileNavOpen = ref(false);
  const GROUP_URL = "https://www.facebook.com/groups/1465813350383274";

  const login = async () => { await store.dispatch('loginWithFacebook'); };
  const logout = async () => { await store.dispatch('logout'); router.push('/'); };

  router.afterEach(() => {
    mobileNavOpen.value = false;
  });

  watch(mobileNavOpen, (open) => {
    document.body.style.overflow = open ? 'hidden' : '';
  });
  let unreadUnsubscribe: (() => void) | null = null;
  
  const setupUnreadListener = (uid: string) => {
    if (unreadUnsubscribe) unreadUnsubscribe();
    
    const q = query(
      collection(db, 'inquiry_threads'),
      where('participants', 'array-contains', uid)
    );

    unreadUnsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        count += data.unreadCount?.[uid] || 0;
      });
      totalUnread.value = count;
    });
  };

  // Watch for global toasts from the store
  watch(() => store.state.toasts, (newToasts) => {
    if (newToasts.length > 0) {
      newToasts.forEach((t: any) => {
        create?.({
          body: t.message,
          title: t.title,
          variant: t.variant || 'info',
          pos: 'top-center',
          ...(t.duration ? { modelValue: t.duration } : {})
        });
      });
      store.commit('CLEAR_TOASTS');
    }
  }, { deep: true });

  watch(user, (newUser) => {
    if (newUser) {
      setupUnreadListener(newUser.uid);
    } else {
      if (unreadUnsubscribe) unreadUnsubscribe();
      totalUnread.value = 0;
    }
  });

  function onPageShow(event: PageTransitionEvent) {
    if (event.persisted) {
      const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
      const pendingKey = `firebase:pendingRedirect:${apiKey}:[DEFAULT]`;
      if (sessionStorage.getItem(pendingKey) !== null) {
        store.dispatch('initAuth');
      }
    }
  }

  onMounted(async () => {
    await store.dispatch('initAuth');
    if (user.value) {
      setupUnreadListener(user.value.uid);
    }

    // When the browser restores this page from bfcache (back/forward cache),
    // Vue does not re-mount — treat it like a fresh mount if a Firebase redirect
    // was in flight so getRedirectResult() can process the auth result.
    window.addEventListener('pageshow', onPageShow);
  });

  onUnmounted(() => {
    if (unreadUnsubscribe) unreadUnsubscribe();
    window.removeEventListener('pageshow', onPageShow);
    document.body.style.overflow = '';
  });
</script>
  
<template>
  <BApp>
    <BOrchestrator />
    <nav class="navbar navbar-expand-lg navbar-light bg-light shadow-sm">
      <div class="container">
        <router-link class="navbar-brand fw-bold d-flex align-items-center" to="/">
          <img src="/hen.png" alt="Logo" width="32" height="32" class="me-2">
          <span class="d-inline d-sm-none">CT Chickens</span>
          <span class="d-none d-sm-inline">Connecticut Backyard Chickens</span>
        </router-link>
        <button class="navbar-toggler" type="button" @click="mobileNavOpen = true" aria-label="Open navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav ms-auto align-items-center">
            <li class="nav-item">
              <router-link class="nav-link" to="/directory">Directory</router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/classified">Classifieds</router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/resources">Resources</router-link>
            </li>
            <li v-if="user" class="nav-item">
              <router-link class="nav-link position-relative px-3" to="/inbox">
                <i class="bi bi-chat-right-text"></i>
                <span class="ms-2 d-lg-none">Inbox</span>
                <BBadge 
                  v-if="totalUnread > 0" 
                  pill 
                  variant="danger" 
                  class="position-absolute top-0 start-100 translate-middle"
                  style="font-size: 0.65rem;"
                >
                  {{ totalUnread }}
                </BBadge>
              </router-link>
            </li>
            <li class="nav-item">
              <AuthButton />
            </li>
          </ul>
        </div>
      </div>
    </nav>

    <!-- Mobile nav backdrop -->
    <Transition name="mobile-fade">
      <div v-if="mobileNavOpen" class="mobile-nav-backdrop" @click="mobileNavOpen = false"></div>
    </Transition>

    <!-- Mobile nav drawer -->
    <Transition name="mobile-slide">
      <div v-if="mobileNavOpen" class="mobile-nav-drawer" role="dialog" aria-modal="true">

        <div class="mobile-nav-header">
          <span class="fw-bold" style="color: var(--primary-color); font-size: 1.1rem;">Navigation</span>
          <button type="button" class="btn-close" @click="mobileNavOpen = false" aria-label="Close"></button>
        </div>

        <!-- Nav links -->
        <ul class="list-unstyled m-0">
          <li>
            <router-link class="mobile-nav-link" to="/">
              <i class="bi bi-house me-2 text-secondary"></i>Home
            </router-link>
          </li>
          <li>
            <router-link class="mobile-nav-link" to="/directory">
              <i class="bi bi-map me-2 text-secondary"></i>Directory
            </router-link>
          </li>
          <li>
            <router-link class="mobile-nav-link" to="/classified">
              <i class="bi bi-tag me-2 text-secondary"></i>Classifieds
            </router-link>
          </li>
          <li>
            <router-link class="mobile-nav-link" to="/resources">
              <i class="bi bi-book me-2 text-secondary"></i>Resources
            </router-link>
          </li>
          <li v-if="user">
            <router-link class="mobile-nav-link d-flex align-items-center" to="/inbox">
              <i class="bi bi-chat-right-text me-2 text-secondary"></i>
              Inbox
              <BBadge v-if="totalUnread > 0" pill variant="danger" class="ms-2">{{ totalUnread }}</BBadge>
            </router-link>
          </li>
        </ul>

        <!-- Logged in user section -->
        <template v-if="isLoggedIn && user">
          <div class="mobile-nav-user-header">
            <img v-if="user.photoURL" :src="user.photoURL" width="40" height="40" class="rounded-circle">
            <i v-else class="bi bi-person-circle fs-3 text-secondary"></i>
            <div>
              <div class="fw-semibold">{{ user.displayName }}</div>
              <span v-if="userData?.isAdmin" class="badge bg-primary" style="font-size: 0.65rem;">Admin</span>
            </div>
          </div>
          <ul class="list-unstyled m-0">
            <li>
              <router-link to="/profile" class="mobile-nav-link">
                <i class="bi bi-person-gear me-2 text-secondary"></i>My Profile
              </router-link>
            </li>
            <li v-if="userData?.isAdmin">
              <router-link to="/admin/inbox" class="mobile-nav-link" style="color: var(--primary-color);">
                <i class="bi bi-inbox-fill me-2"></i>Admin Inbox
              </router-link>
            </li>
            <li v-if="userData?.isAdmin">
              <router-link to="/admin/email" class="mobile-nav-link" style="color: var(--primary-color);">
                <i class="bi bi-envelope-fill me-2"></i>Admin Email
              </router-link>
            </li>
            <template v-if="myFarms.length > 0">
              <li class="px-4 pt-3 pb-1">
                <small class="text-muted fw-bold text-uppercase" style="font-size: 0.7rem; letter-spacing: 0.05rem;">My Farms</small>
              </li>
              <li v-for="farm in myFarms" :key="farm.id">
                <router-link
                  :to="farm.status === 'draft' ? `/get-listed/${farm.id}` : `/directory/${farm.id}`"
                  class="mobile-nav-link d-flex align-items-center justify-content-between"
                >
                  <span class="text-truncate"><i class="bi bi-shop small me-2 text-secondary"></i>{{ farm.name }}</span>
                  <span v-if="farm.status === 'draft'" class="badge bg-warning-subtle text-warning border border-warning-subtle ms-2 flex-shrink-0" style="font-size: 0.65rem;">PENDING</span>
                </router-link>
              </li>
            </template>
            <li>
              <a href="#" class="mobile-nav-link text-danger" @click.prevent="logout">
                <i class="bi bi-box-arrow-right me-2"></i>Sign Out
              </a>
            </li>
          </ul>
        </template>

        <!-- Logged out section -->
        <div v-else-if="authReady" class="px-4 py-4 border-top">
          <a :href="GROUP_URL" target="_blank" class="btn btn-outline-primary w-100 mb-2 d-flex align-items-center justify-content-center gap-2">
            <i class="bi bi-facebook"></i> Join FB Group
          </a>
          <button @click="login" class="btn btn-facebook w-100 d-flex align-items-center justify-content-center gap-2 text-white">
            <i class="bi bi-facebook"></i> Login with Facebook
          </button>
        </div>

      </div>
    </Transition>

    <ClaimBanner />

    <router-view :key="$route.fullPath" />

    <InquiryModal />

    <footer class="bg-dark text-light py-4 mt-3 mb-3">
      <div class="container">
        <div class="row">
          <div class="col text-center">
            <small>
              &copy; 2026 Connecticut Backyard Chickens | 
              Owned and Operated by Zachary Joseph Auclair | 
              <router-link to="/legal" class="text-light ms-1" style="text-decoration: underline;">Site Terms Agreement</router-link>
            </small>
            <div class="mt-2" v-if="gitCommitHash">
              <a 
                :href="`https://github.com/blaskovicz/ctchickens.com/commit/${gitCommitHash}`" 
                target="_blank" 
                class="text-secondary small text-decoration-none hover-underline"
              >
                <i class="bi bi-git me-1"></i>
                rev: {{ gitCommitHash.substring(0, 7) }}
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  </BApp>
</template>
  
  <style>
  :root {
    --primary-color: #1e3a8a;
    --secondary-color: #b91c1c;
    --accent-color: #f59e0b;
    --text-dark: #1f2937;
    --bg-cream: #fefce8;
  }
  
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
    color: var(--text-dark);
  }
  
  .navbar { padding: 1rem 0; }
  .navbar-brand { font-size: 1.5rem; color: var(--primary-color) !important; }
  
  .hero-section {
    background-image: url('/ct_backyard_chickens_2025.jpg');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    padding: 4rem 0;
    position: relative;
    overflow: hidden;
    min-height: 400px;
  }

  @media (max-width: 767.98px) {
    .hero-section {
      min-height: 0;
      padding: 1.25rem 0;
    }
  }
  
  .hero-overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(254, 252, 232, 0.85);
    background: linear-gradient(135deg, rgba(254, 252, 232, 0.9) 0%, rgba(254, 243, 199, 0.85) 100%);
    pointer-events: none;
  }
  
  .hero-section .container { z-index: 1; }
  .hero-section h1 { color: var(--primary-color); text-shadow: 2px 2px 4px rgba(255, 255, 255, 0.8); }
  
  .card { transition: transform 0.3s ease, box-shadow 0.3s ease; }
  .card:hover { transform: translateY(-5px); box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15) !important; }
  
  .btn-primary { background-color: var(--primary-color); border-color: var(--primary-color); }
  .btn-primary:hover { background-color: #1e40af; transform: translateY(-2px); }
  
  .shadow-sm { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important; }
  /* Mobile nav drawer */
  .mobile-nav-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 1040;
  }
  .mobile-nav-drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 320px;
    max-width: 85vw;
    background: #fff;
    z-index: 1045;
    overflow-y: auto;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.12);
    display: flex;
    flex-direction: column;
  }
  .mobile-nav-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.85rem 1.25rem;
    border-bottom: 1px solid #dee2e6;
    flex-shrink: 0;
  }
  .mobile-nav-user-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.85rem 1.25rem;
    background: #f8f9fa;
    border-top: 1px solid #dee2e6;
    border-bottom: 1px solid #dee2e6;
  }
  .mobile-nav-link {
    display: block;
    padding: 0.85rem 1.25rem;
    color: #212529;
    text-decoration: none;
    border-bottom: 1px solid #f0f0f0;
  }
  .mobile-nav-link:hover { background: #f8f9fa; color: #212529; }

  /* Transitions */
  .mobile-fade-enter-active, .mobile-fade-leave-active { transition: opacity 0.25s ease; }
  .mobile-fade-enter-from, .mobile-fade-leave-to { opacity: 0; }

  .mobile-slide-enter-active, .mobile-slide-leave-active { transition: transform 0.3s cubic-bezier(0.23, 1, 0.32, 1); }
  .mobile-slide-enter-from, .mobile-slide-leave-to { transform: translateX(100%); }

  .btn-facebook { background-color: #1877F2; border: none; }
  .btn-facebook:hover { background-color: #166FE5; }

  @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  .card { animation: fadeInUp 0.6s ease-out; }
  </style>
