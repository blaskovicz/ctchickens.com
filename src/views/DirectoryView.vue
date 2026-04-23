<script setup lang="ts">
import BreederTable from '../components/BreederTable.vue';
import FeaturedBreeder from '../components/FeaturedBreeder.vue';
import PageHero from '../components/PageHero.vue';
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
      <div class="row mb-5">
        <div class="col-lg-10 mx-auto text-center">
          <p class="lead mb-4">
            Facebook prohibits live animal sales; all listings are moved here for community safety.
            Our directory connects you with trusted local Connecticut suppliers, breeders, and service providers.
          </p>
          <div class="row g-4 justify-content-center">
            <div class="col-md-6">
              <div class="card h-100 border-0 shadow-sm p-3">
                <div class="d-flex align-items-center mb-2">
                  <span class="badge bg-success me-2"><i class="bi bi-check-circle-fill me-1"></i>Verified</span>
                  <h6 class="mb-0 fw-bold">Verified Member</h6>
                </div>
                <p class="small text-muted mb-0 text-start">
                  Confirms the breeder is a known member of our community in good standing with a verified history of safe transactions.
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
                  Reserved for verified members who supported the directory by joining during its first launch year (2025).
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <FeaturedBreeder />
      <BreederTable />
    </div>
  </section>
</template>
