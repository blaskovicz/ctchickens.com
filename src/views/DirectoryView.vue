<script setup lang="ts">
import BreederTable from '../components/BreederTable.vue';
import FeaturedBreeder from '../components/FeaturedBreeder.vue';
import PageHero from '../components/PageHero.vue';
import { useSupport } from '../composables/useSupport';

const { contactSupport } = useSupport();
</script>

<template>
  <PageHero 
    title="Breeder & Supplier Directory"
    description="Find local Connecticut suppliers, breeders, and service providers for your backyard farm."
    icon="bi-search"
  >
    <template #actions>
      <router-link to="/get-listed" class="btn btn-light fw-bold shadow-sm px-4">
        <i class="bi bi-plus-lg me-1"></i> Start Your Listing
      </router-link>
    </template>
  </PageHero>

  <section id="directory" class="py-5 bg-light min-vh-100">
    <div class="container">
      <FeaturedBreeder />
      <BreederTable />

      <div class="row mt-5">
        <div class="col-lg-10 mx-auto text-center">
          <div class="row g-4 justify-content-center">
            <div class="col-md-6">
              <div class="card h-100 border-0 shadow-sm p-3">
                <div class="d-flex align-items-center mb-2">
                  <span class="badge bg-success me-2"><i class="bi bi-check-circle-fill me-1"></i>Verified</span>
                  <h6 class="mb-0 fw-bold">Verified Member</h6>
                </div>
                <p class="small text-muted mb-0 text-start">
                  Confirms the listing is from a known member of our community in good standing.
                </p>
              </div>
            </div>
            <div class="col-md-6">
              <div class="card h-100 border-0 shadow-sm p-3">
                <div class="d-flex align-items-center mb-2">
                  <span class="badge bg-primary me-2"><i class="bi bi-award-fill me-1"></i>Founding Member</span>
                  <h6 class="mb-0 fw-bold">Founding Member</h6>
                </div>
                <p class="small text-muted mb-0 text-start">
                  Recognized for supporting the directory in its founding year, 2026.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p class="text-muted small text-center mt-4">
        <i class="bi bi-info-circle me-1"></i>
        Listings are provided by community members. Please contact breeders/suppliers directly to verify availability.
      </p>
      <p class="text-muted small text-center">
        Facebook prohibits live animal sales; all listings are moved here for community safety.
        Our directory connects you with trusted local Connecticut suppliers, breeders, and service providers.
      </p>
      <p class="text-muted small text-center">
        If you need help, please <a href="#" @click.prevent="contactSupport()">contact support</a>.
        To get listed, <router-link to="/get-listed">click here to start your listing</router-link>.
      </p>

    </div>
  </section>
</template>
