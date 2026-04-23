<script setup lang="ts">
import { ref, computed } from 'vue';
import { BCarousel, BCarouselSlide } from 'bootstrap-vue-next';

// Accept logo and images as simple props
const props = defineProps<{
  logo?: string | null;
  images?: string[];
}>();

// Modal State
const showModal = ref(false);
const selectedIndex = ref(0);

// Combine logo and images into a single array for the carousel
const allImages = computed(() => {
  const list: string[] = [];
  if (props.logo) list.push(props.logo);
  if (props.images && props.images.length > 0) {
    list.push(...props.images);
  }
  return list;
});

const openGallery = (index: number) => {
  selectedIndex.value = index;
  showModal.value = true;
  document.body.style.overflow = 'hidden'; // Prevent background scrolling
};

const closeModal = () => {
  showModal.value = false;
  document.body.style.overflow = '';
};
</script>

<template>
  <div v-if="allImages.length > 0">
    <div class="d-flex gap-2 overflow-auto pb-2 custom-scrollbar">
      <img
        v-if="logo"
        :src="logo"
        class="rounded border shadow-sm gallery-thumbnail"
        loading="lazy"
        alt="Farm Logo"
        referrerpolicy="no-referrer"
        @click.stop="openGallery(0)"
      />

      <img
        v-for="(img, idx) in images"
        :key="idx"
        :src="img"
        class="rounded border shadow-sm gallery-thumbnail"
        loading="lazy"
        alt="Farm photo"
        referrerpolicy="no-referrer"
        @click.stop="openGallery(logo ? idx + 1 : idx)"
      />
    </div>

    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal-content-wrapper">
          <button class="close-btn" @click.stop="closeModal">&times;</button>
          
          <BCarousel
            controls
            indicators
            background="transparent"
            :interval="0"
            v-model="selectedIndex"
            class="custom-carousel"
          >
            <BCarouselSlide
              v-for="(img, idx) in allImages"
              :key="idx"
            >
              <template #img>
                <div class="carousel-img-container" @click.stop>
                  <img
                    :src="img"
                    alt="Farm image"
                    class="carousel-image"
                    referrerpolicy="no-referrer"
                  >
                </div>
              </template>
            </BCarouselSlide>
          </BCarousel>

        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Scrollbar */
.custom-scrollbar::-webkit-scrollbar { height: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }

.gallery-thumbnail {
  height: 120px;
  min-width: 120px;
  object-fit: cover;
  cursor: pointer;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background-color: rgba(0, 0, 0, 0.9);
  display: flex; justify-content: center; align-items: center;
  z-index: 9999; cursor: zoom-out; animation: fadeIn 0.3s ease;
}

.modal-content-wrapper { 
  position: relative; 
  width: 90%; 
  max-width: 1200px;
  max-height: 90vh; 
}

.custom-carousel {
  width: 100%;
  animation: zoomIn 0.3s ease;
}

.carousel-img-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 85vh;
  cursor: default;
}

.carousel-image {
  max-width: 100%; 
  max-height: 100%; 
  object-fit: contain;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}

.close-btn {
  position: absolute;
  top: 15px;   
  right: 15px; 
  background-color: rgba(0, 0, 0, 0.6); 
  color: white;
  border: none;
  border-radius: 50%; 
  width: 48px;
  height: 48px;
  padding: 0 0 4px 0; /* slight bottom padding to lift the X */
  font-size: 2rem; /* slightly larger for better proportion */
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: background-color 0.2s;
  box-shadow: 0 0 10px rgba(0,0,0,0.3);
}

.close-btn:hover {
  background-color: rgba(0, 0, 0, 0.8);
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes zoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }

/* Enhanced visibility for Carousel Controls on light/white images */
:deep(.carousel-control-prev),
:deep(.carousel-control-next) {
  width: 10%;
  opacity: 1; 
}

:deep(.carousel-control-prev-icon),
:deep(.carousel-control-next-icon) {
  background-color: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  padding: 1.5rem;
  background-size: 50%;
  box-shadow: 0 0 10px rgba(0,0,0,0.3);
}

:deep(.carousel-indicators) {
  margin-bottom: 0.5rem;
  background-color: rgba(0, 0, 0, 0.4);
  padding: 0.5rem 1rem;
  border-radius: 1rem;
  backdrop-filter: blur(4px);
}
</style>