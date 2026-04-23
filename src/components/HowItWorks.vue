<script setup lang="ts">
import { computed } from 'vue';
import { useStore } from 'vuex';

const store = useStore();
const isLoggedIn = computed(() => store.getters.isLoggedIn);
const myBreeders = computed(() => store.getters.myBreeders);
const hasApplied = computed(() => myBreeders.value.length > 0);
const hasSelling = computed(() => myBreeders.value.some((b: any) => b.status === 'published'));
const login = () => store.dispatch('loginWithFacebook');
</script>

<template>
  <section id="how-it-works" class="py-5">
    <div class="container">
      <div class="row mb-5">
        <div class="col-lg-8 mx-auto text-center">
          <h2 class="display-5 fw-bold mb-3">How It Works</h2>
          <p class="lead">Getting listed is simple. Here's how to go from sign-up to selling.</p>
        </div>
      </div>

      <div class="row g-4 justify-content-center">
        <div class="col-md-3">
          <div class="card h-100 border-0 shadow-sm text-center p-4 d-flex flex-column">
            <div class="feature-icon mb-3">
              <i class="bi bi-person-plus-fill text-primary"></i>
            </div>
            <h3 class="h5 fw-bold mb-2">1. Create an Account</h3>
            <p v-if="!isLoggedIn" class="flex-grow-1">Sign up on this site. The directory is open to any local seller, breeder, or supplier.</p>
            <div v-if="isLoggedIn" class="mt-auto text-success fw-semibold">
              <i class="bi bi-check-circle-fill"></i> You're logged in
            </div>
            <button v-else @click="login" class="btn btn-sm btn-outline-primary mt-auto">
              <i class="bi bi-facebook"></i> Log In
            </button>
          </div>
        </div>

        <div class="col-md-3">
          <div class="card h-100 border-0 shadow-sm text-center p-4 d-flex flex-column">
            <div class="feature-icon mb-3">
              <i class="bi bi-pencil-square text-warning"></i>
            </div>
            <h3 class="h5 fw-bold mb-2">2. Start Your Listing</h3>
            <p v-if="!hasApplied" class="flex-grow-1">Fill out a short application with your products, location, and contact info. Listings are reviewed and approved by our admins.</p>
            <div v-if="hasApplied" class="mt-auto text-success fw-semibold">
              <i class="bi bi-check-circle-fill"></i> Applied
            </div>
            <router-link v-else to="/get-listed" class="btn btn-sm btn-outline-primary mt-auto">
              <i class="bi bi-plus-lg"></i> Start Your Listing
            </router-link>
          </div>
        </div>

        <div class="col-md-3">
          <div class="card h-100 border-0 shadow-sm text-center p-4 d-flex flex-column">
            <div class="feature-icon mb-3">
              <i class="bi bi-shop text-success"></i>
            </div>
            <h3 class="h5 fw-bold mb-2">3. Start Selling</h3>
            <p v-if="!hasSelling" class="flex-grow-1">Your listing goes live and buyers can reach you directly — a dedicated, safe place to connect outside of Facebook.</p>
            <div v-if="hasSelling" class="mt-auto text-success fw-semibold">
              <i class="bi bi-check-circle-fill"></i> You're live
            </div>
            <router-link v-else to="/directory" class="btn btn-sm btn-outline-primary mt-auto">
              <i class="bi bi-search"></i> View Directory
            </router-link>
          </div>
        </div>

        <div class="col-md-3">
          <div class="card h-100 border-0 shadow-sm text-center p-4 d-flex flex-column">
            <div class="feature-icon mb-3">
              <i class="bi bi-facebook text-primary"></i>
            </div>
            <h3 class="h5 fw-bold mb-2">4. Join the Community</h3>
            <p class="flex-grow-1">Want more? Our Facebook group has thousands of local enthusiasts to connect with, ask questions, and share your experience.</p>
            <a href="https://www.facebook.com/groups/1465813350383274" target="_blank" class="btn btn-sm btn-outline-primary mt-auto">
              <i class="bi bi-facebook"></i> Join Group
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
