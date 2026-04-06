<script setup lang="ts">
import { computed } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';

const store = useStore();
const router = useRouter();

const isLoggedIn = computed(() => store.getters.isLoggedIn);
const user = computed(() => store.getters.currentUser);
const userData = computed(() => store.state.userData);
const authReady = computed(() => store.getters.authReady);
const myFarms = computed(() => store.getters.myBreeders);

const login = async () => {
  // The store's loginWithFacebook now handles its own errors via the global toast queue.
  await store.dispatch('loginWithFacebook');
};

const logout = async () => {
  await store.dispatch('logout');
  router.push('/');
};

const GROUP_URL = "https://www.facebook.com/groups/1465813350383274";
</script>

<template>
  <div v-if="authReady" class="d-flex align-items-center ms-lg-3 mt-3 mt-lg-0 gap-2">
    
    <!-- LOGGED IN STATE -->
    <div v-if="isLoggedIn" class="dropdown">
      <button 
        class="btn btn-outline-secondary dropdown-toggle d-flex align-items-center gap-2" 
        type="button" 
        data-bs-toggle="dropdown" 
        aria-expanded="false"
      >
        <img 
          v-if="user?.photoURL" 
          :src="user.photoURL" 
          alt="Profile" 
          width="24" 
          height="24" 
          class="rounded-circle"
        >
        <i v-else class="bi bi-person-circle"></i>
        <span class="d-none d-md-inline">{{ user?.displayName?.split(' ')[0] }}</span>
        <span v-if="userData?.isAdmin" class="badge bg-primary ms-1">Admin</span>
      </button>
      <ul class="dropdown-menu dropdown-menu-end shadow border-0 mt-2" style="min-width: 220px;">
        <li><h6 class="dropdown-header text-dark fw-bold">{{ user?.displayName }}</h6></li>
        
        <!-- Community Link (Always visible in dropdown) -->
        <li>
          <a :href="GROUP_URL" target="_blank" class="dropdown-item d-flex align-items-center gap-2 text-primary">
            <i class="bi bi-facebook"></i> Visit FB Group
          </a>
        </li>

        <!-- Admin Tools Section -->
        <li v-if="userData?.isAdmin">
          <hr class="dropdown-divider">
          <router-link to="/admin/inbox" class="dropdown-item d-flex align-items-center gap-2 text-primary fw-bold">
            <i class="bi bi-inbox-fill"></i> Admin Inbox
          </router-link>
        </li>

        <!-- My Farms Section -->
        <li v-if="myFarms.length > 0">
          <hr class="dropdown-divider">
          <h6 class="dropdown-header small text-muted">MY FARMS</h6>
        </li>
        <li v-for="farm in myFarms" :key="farm.id">
          <router-link
            :to="farm.status === 'draft' ? `/get-listed/${farm.id}` : `/directory/${farm.id}`"
            class="dropdown-item d-flex align-items-center justify-content-between gap-2"
          >
            <span class="text-truncate">
              <i class="bi bi-shop small me-1"></i> {{ farm.name }}
            </span>
            <span v-if="farm.status === 'draft'" class="badge bg-warning-subtle text-warning border border-warning-subtle small" style="font-size: 0.65rem;">
              PENDING
            </span>
          </router-link>
        </li>
        <li><hr class="dropdown-divider"></li>
        <li>
          <a class="dropdown-item text-danger d-flex align-items-center gap-2" href="#" @click.prevent="logout">
            <i class="bi bi-box-arrow-right"></i> Sign Out
          </a>
        </li>
      </ul>
    </div>

    <!-- LOGGED OUT STATE: Consolidated Buttons -->
    <template v-else>
      <a :href="GROUP_URL" target="_blank" class="btn btn-outline-primary btn-sm d-flex align-items-center gap-2">
        <i class="bi bi-facebook"></i>
        <span class="d-none d-sm-inline">Join Group</span>
      </a>
      <button @click="login" class="btn btn-facebook btn-sm d-flex align-items-center gap-2 text-white">
        <i class="bi bi-facebook"></i>
        <span>Login</span>
      </button>
    </template>

  </div>

  <!-- Loading Placeholder -->
  <div v-else class="ms-lg-3 mt-3 mt-lg-0">
    <div class="spinner-border spinner-border-sm text-secondary" role="status">
      <span class="visually-hidden">Loading...</span>
    </div>
  </div>
</template>

<style scoped>
.btn-facebook {
  background-color: #1877F2;
  border: none;
  transition: background-color 0.2s;
}
.btn-facebook:hover {
  background-color: #166FE5;
}
.btn-outline-primary {
  border-width: 1px;
}
.dropdown-toggle::after {
  vertical-align: middle;
}
.dropdown-header {
  font-size: 0.7rem;
  letter-spacing: 0.05rem;
}
</style>
