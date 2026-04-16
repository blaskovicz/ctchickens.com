<script setup lang="ts">
  import 'bootstrap/dist/css/bootstrap.min.css';
  import 'bootstrap-icons/font/bootstrap-icons.css';
  import 'bootstrap/dist/js/bootstrap.bundle.min.js';
  import { useStore } from 'vuex';
  import { onMounted, watch, ref, computed, onUnmounted } from 'vue';
  import { BApp, BOrchestrator, useToast, BBadge } from 'bootstrap-vue-next';
  import AuthButton from './components/AuthButton.vue';
  import ClaimBanner from './components/ClaimBanner.vue';
  import InquiryModal from './components/InquiryModal.vue';
  import { db } from './firebase';
  import { collection, query, where, onSnapshot } from 'firebase/firestore';

  const store = useStore();
  const { create } = useToast();
  const gitCommitHash = import.meta.env.VITE_GIT_COMMIT_HASH || '';

  const user = computed(() => store.state.user);
  const totalUnread = ref(0);
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
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav ms-auto align-items-center">
            <li class="nav-item">
              <router-link class="nav-link" to="/about">About</router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/directory">Directory</router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/products">Products</router-link>
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

    <ClaimBanner />

    <router-view />

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
  @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  .card { animation: fadeInUp 0.6s ease-out; }
  </style>
