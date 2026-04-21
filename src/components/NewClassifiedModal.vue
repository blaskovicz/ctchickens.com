<script setup lang="ts">
import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import { BModal, BButton, BFormGroup, BFormInput, BFormSelect, BFormTextarea, BSpinner, useToast } from 'bootstrap-vue-next';
import type { ClassifiedCategory } from '../types';

const emit = defineEmits<{ submitted: [id: string] }>();

const store = useStore();
const { create } = useToast();

const show = ref(false);
const isSubmitting = ref(false);

const category = ref<ClassifiedCategory>('iso');
const location = ref('');
const description = ref('');

const isLoggedIn = computed(() => store.getters.isLoggedIn);

const categoryOptions = [
  { value: 'iso', text: 'In Search Of' },
  { value: 'for_sale', text: 'For Sale' },
  { value: 'rehoming', text: 'Rehoming' },
  { value: 'hatching_eggs', text: 'Hatching Eggs' },
];

const isValid = computed(() =>
  category.value &&
  location.value.trim().length >= 2 &&
  description.value.trim().length >= 20
);

const open = () => { show.value = true; };
defineExpose({ open });

const reset = () => {
  category.value = 'iso';
  location.value = '';
  description.value = '';
};

const handleSubmit = async () => {
  if (!isValid.value || isSubmitting.value) return;
  isSubmitting.value = true;
  try {
    const id = await store.dispatch('createDraftClassified', {
      category: category.value,
      location: location.value.trim(),
      description: description.value.trim(),
    });
    create?.({ body: 'Your listing has been submitted for review. We\'ll email you when it\'s approved.', variant: 'success' });
    show.value = false;
    reset();
    emit('submitted', id);
  } catch (e: any) {
    create?.({ body: e.message || 'Failed to submit listing.', variant: 'danger' });
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <BModal v-model="show" title="Post a Classified" size="md">
    <div v-if="!isLoggedIn" class="text-center py-4">
      <i class="bi bi-lock-fill fs-2 text-muted mb-3 d-block"></i>
      <p class="text-muted">You must be signed in to post a classified.</p>
      <BButton @click="store.dispatch('loginWithFacebook')" variant="primary">
        <i class="bi bi-facebook me-2"></i> Log in with Facebook
      </BButton>
    </div>

    <form v-else @submit.prevent="handleSubmit" class="d-flex flex-column gap-3">
      <BFormGroup label="Category" label-for="cat">
        <BFormSelect id="cat" v-model="category" :options="categoryOptions" required />
      </BFormGroup>

      <BFormGroup label="Location" label-for="loc" description="Town, state (e.g. Lebanon, CT)">
        <BFormInput id="loc" v-model="location" placeholder="Lebanon, CT" required />
      </BFormGroup>

      <BFormGroup label="Description" label-for="desc" description="Minimum 20 characters — be specific about breed, quantity, age, etc.">
        <BFormTextarea
          id="desc"
          v-model="description"
          rows="4"
          placeholder="Looking for 10 Silkie hens, pullets preferred, within 30 miles of Lebanon CT..."
          required
        />
        <div class="text-end small mt-1" :class="description.length < 20 ? 'text-danger' : 'text-muted'">
          {{ description.length }} / 20 min
        </div>
      </BFormGroup>
    </form>

    <template #footer>
      <div v-if="isLoggedIn" class="d-flex justify-content-end gap-2 w-100">
        <BButton variant="light" @click="show = false" :disabled="isSubmitting">Cancel</BButton>
        <BButton variant="primary" :disabled="!isValid || isSubmitting" @click="handleSubmit">
          <BSpinner v-if="isSubmitting" small class="me-1" />
          Submit for Review
        </BButton>
      </div>
      <div v-else></div>
    </template>
  </BModal>
</template>
