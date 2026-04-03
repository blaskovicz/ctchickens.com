<script setup lang="ts">
  // Import global styles
  import 'bootstrap/dist/css/bootstrap.min.css';
  import 'bootstrap-icons/font/bootstrap-icons.css';
  import 'bootstrap/dist/js/bootstrap.bundle.min.js'; // Needed for mobile navbar toggle
  import { useStore } from 'vuex';
  import { onMounted } from 'vue';
  const store = useStore();
  onMounted(() => {
    store.dispatch('fetchDirectory');
  });
</script>
  
<template>
  <nav class="navbar navbar-expand-lg navbar-light bg-light shadow-sm">
    <div class="container">
      <router-link class="navbar-brand fw-bold d-flex align-items-center" to="/">
        <img src="/hen.png" alt="Logo" width="32" height="32" class="me-2">
        <span class="d-inline d-sm-none">CT Backyard Chickens</span>
        <span class="d-none d-sm-inline">Connecticut Backyard Chickens</span>
      </router-link>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav ms-auto">
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
          <li class="nav-item">
            <a class="btn btn-primary ms-2" href="https://www.facebook.com/groups/1465813350383274" target="_blank">
              <i class="bi bi-facebook"></i> Join Our Group
            </a>
          </li>
        </ul>
      </div>
    </div>
  </nav>

  <router-view />

  <footer class="bg-dark text-light py-4">
    <div class="container">
      <div class="row align-items-center">
        <div class="col-md-4 text-center text-md-start mb-3 mb-md-0">
        </div>
        <div class="col-md-8 text-center text-md-end">
          <div class="d-flex flex-column flex-md-row justify-content-md-end align-items-center gap-3">
            <div class="text-light">
              <i class="bi bi-envelope-fill me-1"></i>
              Contact Admin:
              <a href="mailto:admin@ctchickens.com" class="text-light">admin@ctchickens.com</a>
            </div>
            <span class="d-none d-md-inline text-secondary">|</span>
            <div class="text-light">
              <i class="bi bi-megaphone-fill me-1"></i>
              Marketing:
              <a href="mailto:marketing@ctchickens.com" class="text-light">marketing@ctchickens.com</a>
            </div>
          </div>
        </div>
      </div>
      <hr class="my-3 bg-secondary">
      <div class="row">
        <div class="col text-center">
          <small>&copy; 2026 Connecticut Backyard Chickens. All rights reserved | Owned and Operated by Zachary Joseph Auclair</small>
        </div>
      </div>
    </div>
  </footer>
</template>
  
  <style>
  /* Paste your styles.css content here */
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
  
  /* Navbar Styles */
  .navbar {
    padding: 1rem 0;
  }
  
  .navbar-brand {
    font-size: 1.5rem;
    color: var(--primary-color) !important;
  }
  
  .navbar-brand i {
    font-size: 1.75rem;
    vertical-align: middle;
  }
  
  /* Hero Section */
  .hero-section {
    background-image: url('/ct_backyard_chickens_2025.jpg'); /* Note the leading slash for public assets */
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    padding: 8rem 0;
    position: relative;
    overflow: hidden;
    min-height: 500px;
  }
  
  .hero-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(254, 252, 232, 0.85);
    background: linear-gradient(135deg, rgba(254, 252, 232, 0.9) 0%, rgba(254, 243, 199, 0.85) 100%);
    pointer-events: none;
  }
  
  .hero-section .container {
    z-index: 1;
  }
  
  .hero-section h1 {
    color: var(--primary-color);
    text-shadow: 2px 2px 4px rgba(255, 255, 255, 0.8);
  }
  
  .hero-section .lead {
    text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.8);
  }
  
  /* Feature Cards */
  .feature-icon i {
    font-size: 3rem;
  }
  
  .card {
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }
  
  .card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15) !important;
  }
  
  /* Product Cards */
  .product-card {
    transition: all 0.3s ease;
  }
  
  .product-card:hover {
    transform: translateY(-8px);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2) !important;
  }
  
  .product-icon i {
    font-size: 3rem;
    color: var(--accent-color);
  }
  
  .product-card .btn-sm {
    display: block;
    width: 100%;
    margin-bottom: 0.5rem;
  }
  
  /* Resources Section */
  #resources a:not(.btn) {
    color: var(--primary-color);
    transition: color 0.2s ease;
  }
  
  #resources a:not(.btn):hover {
    color: var(--secondary-color);
  }
  
  /* Buttons */
  .btn-primary {
    background-color: var(--primary-color);
    border-color: var(--primary-color);
    transition: all 0.3s ease;
  }
  
  .btn-primary:hover {
    background-color: #1e40af;
    border-color: #1e40af;
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(30, 58, 138, 0.3);
  }
  
  .btn-outline-primary {
    color: var(--primary-color);
    border-color: var(--primary-color);
    transition: all 0.3s ease;
  }
  
  .btn-outline-primary:hover {
    background-color: var(--primary-color);
    border-color: var(--primary-color);
    transform: translateY(-2px);
  }
  
  /* Smooth Scrolling */
  html {
    scroll-behavior: smooth;
  }
  
  /* Section Spacing */
  section {
    scroll-margin-top: 70px;
  }
  
  /* Footer */
  footer a {
    transition: all 0.3s ease;
  }
  
  footer a:hover {
    transform: translateY(-2px);
  }
  
  footer a.text-light:hover {
    color: var(--accent-color) !important;
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .hero-section {
      padding: 3rem 0;
    }
  
    .hero-logo {
      max-width: 100%;
    }
  
    .display-4 {
      font-size: 2rem;
    }
  
    .display-5 {
      font-size: 1.75rem;
    }
  
    /* Mobile-friendly table */
    .table {
      font-size: 0.85rem;
    }
  
    .table td {
      padding: 0.5rem 0.25rem;
    }
  
    .table th {
      padding: 0.75rem 0.25rem;
      font-size: 0.8rem;
    }
  
    .badge {
      font-size: 0.6rem !important;
    }
  
    .btn-sm {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
    }
  
    .breeds-row td {
      padding: 0.5rem !important;
      font-size: 0.8rem !important;
    }
  }
  
  /* Utility Classes */
  .shadow-sm {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important;
  }
  
  .shadow {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
  }
  
  /* Animation for cards */
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .card {
    animation: fadeInUp 0.6s ease-out;
  }
  </style>
