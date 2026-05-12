<script setup lang="ts">
import FeaturedBreederBanner from '../components/FeaturedBreederBanner.vue';
import BreederPreview from '../components/BreederPreview.vue';
import ClassifiedsPreview from '../components/ClassifiedsPreview.vue';
import FeaturedPartnerBanner from '../components/FeaturedPartnerBanner.vue';
import HaveMoreQuestions from '../components/HaveMoreQuestions.vue';
</script>

<template>
  <section class="featured-partner-section">
    <FeaturedPartnerBanner />
  </section>

  <section class="hero-section">
    <div class="hero-overlay"></div>
    <div class="container position-relative">
      <div class="row align-items-center">
        <div class="col-lg-12 text-center">
          <h1 class="display-4 fw-bold mb-3">Welcome to Connecticut Backyard Chickens</h1>
          <p class="lead mb-4">
            <span class="text-primary fw-bold">Over 12,000 active members</span> in one of Connecticut's largest backyard chicken communities!
          </p>
          <p class="lead mb-0">
            The official sales directory for the group, all of CT, and beyond.
          </p>
        </div>
      </div>
    </div>
  </section>

  <section id="directory" class="py-5 bg-light">
    <div class="container">
      <div class="row align-items-end mb-4">
        <div class="col-lg-9 text-center text-lg-start">
          <h2 class="display-5 fw-bold text-dark">Verified Sellers</h2>
          <p class="lead mb-0">
            Trusted members of the community.
          </p>
        </div>
        <div class="col-lg-3 text-center text-lg-end mt-4 mt-lg-0 d-lg-flex align-items-end justify-content-end">
          <router-link to="/directory" class="btn btn-primary px-4 shadow-sm mb-1">
            View Full Directory <i class="bi bi-arrow-right ms-2"></i>
          </router-link>
        </div>
      </div>
      
      <FeaturedBreederBanner />
      <BreederPreview />

      <div class="text-center mt-4">
        <p class="small text-muted mb-0">
          Showing verified members only · 
          <router-link to="/directory" class="text-primary text-decoration-none fw-bold">
            See all listings, including unverified →
          </router-link>
        </p>
      </div>
    </div>
  </section>

  <ClassifiedsPreview />

  <HaveMoreQuestions />
</template>
