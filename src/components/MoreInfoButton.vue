<script setup lang="ts">
import { ref } from 'vue';
import { BModal } from 'bootstrap-vue-next';

const props = defineProps<{
  link: string | null;
  name: string;
  verified: boolean | string | number | null;
  showLabelOnMobile?: boolean;
}>();

const showWarningModal = ref(false);

const isVerified = (val: any) => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s !== '' && s !== 'false' && s !== '0' && s !== 'null' && s !== 'undefined';
  }
  return !!val;
};

const handleClick = () => {
  if (isVerified(props.verified)) {
    window.open(props.link!, '_blank');
  } else {
    showWarningModal.value = true;
  }
};

const confirmProceed = () => {
  if (props.link) {
    window.open(props.link, '_blank');
  }
  showWarningModal.value = false;
};
</script>

<template>
  <div v-if="link" class="d-inline-block">
    <a
      href="#"
      @click.prevent="handleClick"
      class="btn btn-sm btn-outline-dark text-nowrap d-inline-flex align-items-center justify-content-center"
      style="min-width: 36px;"
    >
      <i class="bi bi-info-circle text-center" :class="showLabelOnMobile ? 'me-2' : 'me-lg-2'"></i>
      <span :class="{ 'd-none d-lg-inline': !showLabelOnMobile }">More Info</span>
    </a>

    <!-- Warning Modal -->
    <BModal
      v-model="showWarningModal"
      title="External Link Warning"
      @ok="confirmProceed"
      ok-title="Continue to Site"
      cancel-title="Cancel"
    >
      <p>You are about to visit <span class="fw-bold text-break">{{ link }}</span></p>
      <p><span class="fw-bold text-break">{{ name }}</span> is community supplied and has not completed the verification procedure for ctchickens.com.</p>
    </BModal>
  </div>
</template>
