<script setup lang="ts">
import { ref } from 'vue';

// Accept logo and images as simple props
const props = defineProps<{
  logo?: string | null;
  images?: string[];
}>();

// Modal State
const showModal = ref(false);
const selectedImage = ref('');

const openGallery = (url: string) => {
  selectedImage.value = url;
  showModal.value = true;
  document.body.style.overflow = 'hidden'; // Prevent background scrolling
};

const closeModal = () => {
  showModal.value = false;
  document.body.style.overflow = '';
  setTimeout(() => { selectedImage.value = ''; }, 300);
};
</script>

<template>
  <div v-if="(images && images.length > 0) || logo">
    
    <div class="d-flex gap-2 overflow-auto pb-2 custom-scrollbar">
      
      <img 
        v-if="logo"
        :src="logo"
        class="rounded border shadow-sm"
        style="height: 100px; min-width: 100px; object-fit: contain; background-color: #fff; cursor: pointer;"
        loading="lazy"
        alt="Farm Logo"
        referrerpolicy="no-referrer"
        @click.stop="openGallery(logo)"
      />

      <img 
        v-for="(img, idx) in images" 
        :key="idx" 
        :src="img" 
        class="rounded border shadow-sm"
        style="height: 100px; min-width: 100px; object-fit: cover; cursor: pointer;"
        loading="lazy"
        alt="Farm photo"
        referrerpolicy="no-referrer"
        @click.stop="openGallery(img)" 
      />
    </div>

    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click="closeModal">
        <div class="modal-content-wrapper">
          <button class="close-btn" @click.stop="closeModal">&times;</button>
          <img 
            :src="selectedImage" 
            class="modal-image" 
            referrerpolicy="no-referrer" 
            @click.stop
          >
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

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background-color: rgba(0, 0, 0, 0.85);
  display: flex; justify-content: center; align-items: center;
  z-index: 9999; cursor: zoom-out; animation: fadeIn 0.3s ease;
}

.modal-content-wrapper { position: relative; max-width: 90%; max-height: 90%; }

.modal-image {
  max-width: 100%; max-height: 90vh; object-fit: contain;
  border-radius: 4px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  cursor: default; animation: zoomIn 0.3s ease;
}

.close-btn {
  position: absolute;
  top: 10px;    /* Move it DOWN inside the image */
  right: 10px;  /* Move it LEFT from the edge */
  /*background: rgba(0, 0, 0, 0.5); /* Add a semi-transparent background so it's visible on light photos */
  border-radius: 50%; /* Make it circular */
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  /* ... keep other styles ... */
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes zoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>