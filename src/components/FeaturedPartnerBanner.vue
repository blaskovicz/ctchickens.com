<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';

interface BannerAd {
  id: number;
  text: string;
  link: string;
  linkText: string;
  icon: string;
  isExternal?: boolean;
}

// --- CONFIGURATION ---
const ROTATION_SPEED_MS = 6000; 

const messages = ref<BannerAd[]>([
  {
    id: 1,
    text: "New to chickens? Join our community for daily advice.",
    link: "https://www.facebook.com/groups/1465813350383274",
    linkText: "Join Facebook Group",
    icon: "bi-facebook",
    isExternal: true
  },
  {
    id: 2,
    text: "Are you a local breeder or supplier? Get verified and listed today.",
    link: "mailto:marketing@ctchickens.com",
    linkText: "Get Listed",
    icon: "bi-patch-check-fill",
    isExternal: false
  },
  {
    id: 3,
    text: "Spring Chick Days are coming! See who has stock.",
    link: "#directory",
    linkText: "View Directory",
    icon: "bi-egg-fill",
    isExternal: false
  }
]);

const currentIndex = ref(0);
const timer = ref<number | undefined>(undefined);
const isPaused = ref(false);

const currentMessage = computed(() => messages.value[currentIndex.value]!);

// --- ROTATION LOGIC ---

const nextSlide = () => {
  currentIndex.value = (currentIndex.value + 1) % messages.value.length;
};

const startRotation = () => {
  // Clear any existing timer just in case
  stopRotation();
  timer.value = window.setInterval(nextSlide, ROTATION_SPEED_MS);
};

const stopRotation = () => {
  clearInterval(timer.value);
  timer.value = undefined;
};

// --- USER INTERACTION ---

// Pause when mouse enters (so they can click the button easily)
const onMouseEnter = () => {
  isPaused.value = true;
  stopRotation();
};

// Resume when mouse leaves
const onMouseLeave = () => {
  isPaused.value = false;
  startRotation();
};

// Manual navigation via dots
const jumpTo = (index: number) => {
  currentIndex.value = index;
  // Reset the timer so it doesn't jump immediately after they click
  startRotation(); 
};

onMounted(() => {
  startRotation();
});

onUnmounted(() => {
  stopRotation();
});
</script>

<template>
  <div 
    class="partner-banner bg-warning text-dark position-relative"
    @mouseenter="onMouseEnter" 
    @mouseleave="onMouseLeave"
  >
    <div class="container py-2 text-center d-flex flex-column justify-content-center" style="min-height: 50px;">
      
      <Transition name="fade" mode="out-in">
        <div :key="currentMessage.id" class="d-flex justify-content-center align-items-center flex-wrap mb-1">
          <i :class="['bi', currentMessage.icon, 'me-2', 'fs-5']"></i>
          
          <span class="fw-bold me-2 message-text">{{ currentMessage.text }}</span>
          
          <a 
            :href="currentMessage.link" 
            :target="currentMessage.isExternal ? '_blank' : '_self'"
            class="badge bg-dark text-decoration-none ms-1 px-3 py-2 rounded-pill shadow-sm"
          >
            {{ currentMessage.linkText }}
            <i v-if="currentMessage.isExternal" class="bi bi-box-arrow-up-right ms-1" style="font-size: 0.75em;"></i>
          </a>
        </div>
      </Transition>

      <div class="d-flex justify-content-center align-items-center gap-2 mt-1">
        <button 
          v-for="(msg, index) in messages" 
          :key="msg.id"
          @click="jumpTo(index)"
          class="indicator-dash border-0"
          :class="{ active: currentIndex === index }"
          :aria-label="'Go to slide ' + (index + 1)"
        ></button>
      </div>

    </div>
  </div>
</template>

<style scoped>
.partner-banner {
  border-bottom: 1px solid rgba(0,0,0,0.1);
}

/* Custom Indicator Styles 
  We use a "dash" style which looks more modern than round dots 
*/
.indicator-dash {
  width: 20px;       /* Length of the dash */
  height: 4px;       /* Thickness */
  border-radius: 2px;
  background-color: rgba(0, 0, 0, 0.2); /* Faded black by default */
  transition: all 0.3s ease;
  padding: 0;
  cursor: pointer;
}

.indicator-dash:hover {
  background-color: rgba(0, 0, 0, 0.5);
}

.indicator-dash.active {
  background-color: #000; /* Solid black for active */
  width: 30px; /* Make the active one slightly longer for effect */
}

/* Transition Animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(10px); /* Slide up effect */
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px); /* Slide up effect */
}
</style>