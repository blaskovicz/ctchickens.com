<script setup lang="ts">
import { computed } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import type { Breeder } from '../types';
import { useBreederUtils } from '../composables/useBreederUtils';
import ViewProfileButton from './ViewProfileButton.vue';
import ContactButton from './ContactButton.vue';
import VerifiedBadge from './VerifiedBadge.vue';
import FoundingBreederBadge from './FoundingBreederBadge.vue';

const store = useStore();
const router = useRouter();
const { splitBreederName, generateSlug } = useBreederUtils();

const featured = computed(() => store.getters.featuredBreeder as Breeder | null);

const businessName = computed(() => {
  if (!featured.value) return '';
  return splitBreederName(featured.value.name).main;
});

const subtext = computed(() => {
  if (!featured.value) return '';
  const parts = [];
  if (featured.value.location) parts.push(featured.value.location);
  if (featured.value.category) parts.push(featured.value.category);
  if (featured.value.selling) parts.push(featured.value.selling);
  const fullText = parts.join(' · ');
  return fullText.length > 128 ? fullText.substring(0, 125) + '...' : fullText;
});

const goToProfile = () => {
  if (featured.value) {
    router.push({ 
      name: 'breeder-profile', 
      params: { slug: generateSlug(featured.value.name) } 
    });
  }
};
</script>

<template>
  <div 
    v-if="featured" 
    class="featured-banner mb-4 shadow-sm clickable-banner"
    @click="goToProfile"
  >
    <div class="container-fluid px-0">
      <div class="banner-card p-3 p-md-4 d-flex flex-column flex-md-row align-items-center gap-3 gap-md-4">
        
        <!-- Left: Logo -->
        <div class="logo-container flex-shrink-0 d-flex align-items-center justify-content-center">
          <img 
            :src="featured.logo || '/hen.png'" 
            :alt="featured.name"
            class="logo-img"
            :class="{ 'is-default': !featured.logo }"
          />
        </div>

        <!-- Center: Info -->
        <div class="info-container flex-grow-1 text-center text-md-start">
          <div class="d-flex flex-wrap justify-content-center justify-content-md-start gap-1 mb-2 badge-container">
            <span class="badge d-inline-flex align-items-center bg-white text-primary">
              <i class="bi bi-star-fill me-1"></i>Featured
            </span><VerifiedBadge :verified="featured.verified" variant="white text-primary" /><FoundingBreederBadge :count="featured.founding_breeder" variant="warning text-dark" />
          </div>
          
          <h5 class="business-name fw-bold text-white mb-1">
            {{ businessName }}
          </h5>
          
          <p class="subtext mb-0 text-white-50 small text-truncate-mobile">
            {{ subtext }}
          </p>
        </div>

        <!-- Right: CTA -->
        <div 
          class="cta-container flex-shrink-0 ms-md-auto d-flex flex-wrap justify-content-center gap-2"
          @click.stop
        >
          <ContactButton 
            :link="featured.contact_link" 
            :breeder="featured" 
            :show-label-on-mobile="true"
            :force-secure-only="true"
            variant="outline-light"
            size="md"
            class="shadow-sm"
          />
          <ViewProfileButton 
            :breeder-name="featured.name" 
            :show-label-on-mobile="true"
            variant="outline-light" 
            size="md" 
            class="px-4 shadow-sm"
          />
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.featured-banner {
  border-radius: 1rem;
  overflow: hidden;
  background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
  position: relative;
  transition: all 0.25s ease-in-out;
  cursor: pointer;
}

.featured-banner:hover {
  transform: translateY(-4px);
  box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.2) !important;
}

.banner-card {
  position: relative;
  z-index: 1;
}

/* Subtle pattern overlay similar to PageHero */
.banner-card::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2v-4h4v-2H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  pointer-events: none;
  opacity: 0.5;
}

.logo-container {
  width: 100px;
  height: 100px;
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 0.75rem;
  padding: 10px;
  backdrop-filter: blur(4px);
  position: relative;
  z-index: 1;
}

.logo-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 4px;
}

.logo-img.is-default {
  filter: grayscale(100%);
  opacity: 0.8;
}

.info-container {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.badge-container {
  position: relative;
}

/* Hide BootstrapVueNext tooltip placeholders that cause extra gaps in flexbox */
.badge-container :deep(span[id*="popover____placeholder"]) {
  display: none !important;
}

.business-name {
  font-size: 1.25rem;
  letter-spacing: -0.01em;
}

.subtext {
  font-weight: 400;
}

.cta-container {
  position: relative;
  z-index: 1;
}

@media (max-width: 767.98px) {
  .text-truncate-mobile {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: normal;
  }
}
</style>
