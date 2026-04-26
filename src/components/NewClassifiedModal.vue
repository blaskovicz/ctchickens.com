<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useStore } from 'vuex';
import { BModal, BButton, BFormGroup, BFormInput, BFormSelect, BFormTextarea, BSpinner, useToast, BFormFile } from 'bootstrap-vue-next';
import type { ClassifiedCategory, UserTier } from '../types';
import { TIER_LIMITS } from '../types';
import { storage } from '../firebase';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import type { StorageReference } from 'firebase/storage';
import { compressImage } from '../composables/useImageUtils';
import { useSupport } from '../composables/useSupport';

const emit = defineEmits<{ submitted: [id: string] }>();

const store = useStore();
const { create } = useToast();
const { contactSupport } = useSupport();

const show = ref(false);
const isSubmitting = ref(false);

const category = ref<ClassifiedCategory>('iso');
const location = ref('');
const title = ref('');
const description = ref('');
const price = ref('');
const imageFile = ref<File | null>(null);
const imagePreview = ref<string | null>(null);

const isLoggedIn = computed(() => store.getters.isLoggedIn);
const user = computed(() => store.getters.currentUser);
const userTier = computed(() => store.getters.userTier as UserTier);
const canPost = computed(() => store.getters.canPostClassified);
const tierLimit = computed(() => TIER_LIMITS[userTier.value]);

const categoryOptions = [
  { value: 'iso', text: 'In Search Of' },
  { value: 'for_sale', text: 'For Sale' },
  { value: 'rehoming', text: 'Rehoming' },
  { value: 'hatching_eggs', text: 'Hatching Eggs' },
];

const isValid = computed(() =>
  category.value &&
  location.value.trim().length >= 2 &&
  title.value.trim().length >= 5 &&
  title.value.trim().length <= 100 &&
  description.value.trim().length >= 20
);

const open = () => { show.value = true; };
defineExpose({ open });

const reset = () => {
  category.value = 'iso';
  location.value = '';
  title.value = '';
  description.value = '';
  price.value = '';
  imageFile.value = null;
  imagePreview.value = null;
};

const removeImage = () => {
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value);
  imagePreview.value = null;
  imageFile.value = null;
};

watch(imageFile, (newFile) => {
  if (imagePreview.value) {
    URL.revokeObjectURL(imagePreview.value);
    imagePreview.value = null;
  }
  if (newFile) {
    if (newFile.size > 10 * 1024 * 1024) {
      create?.({ body: 'Image must be smaller than 10MB.', variant: 'danger' });
      imageFile.value = null;
      return;
    }
    if (!newFile.type.startsWith('image/')) {
      create?.({ body: 'File must be an image.', variant: 'danger' });
      imageFile.value = null;
      return;
    }
    imagePreview.value = URL.createObjectURL(newFile);
  }
});

const handleSubmit = async () => {
  if (!isValid.value || isSubmitting.value) return;
  isSubmitting.value = true;
  let uploadedRef: StorageReference | null = null;
  try {
    let imageUrl = undefined;
    if (imageFile.value && user.value) {
      // 1. Compress Image
      const compressedBlob = await compressImage(imageFile.value);
      
      const fileExt = 'jpg'; // We force to jpg in compression
      const fileName = `${Date.now()}.${fileExt}`;
      const path = `classifieds/${user.value.uid}/${fileName}`;
      const fileRef = storageRef(storage, path);
      
      // 2. Upload compressed blob
      const snapshot = await uploadBytes(fileRef, compressedBlob, {
        contentType: 'image/jpeg'
      });
      uploadedRef = snapshot.ref;
      imageUrl = await getDownloadURL(snapshot.ref);
    }

    const id = await store.dispatch('createDraftClassified', {
      category: category.value,
      location: location.value.trim(),
      title: title.value.trim(),
      description: description.value.trim(),
      price: price.value.trim() || undefined,
      image_url: imageUrl,
    });
    create?.({ body: 'Your listing has been submitted for review. We\'ll email you when it\'s approved.', variant: 'success' });
    show.value = false;
    reset();
    emit('submitted', id);
  } catch (e: any) {
    if (uploadedRef) {
      await deleteObject(uploadedRef).catch(() => {});
    }
    create?.({ body: e.message || 'Failed to submit listing.', variant: 'danger' });
    console.warn(e);
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
      <div v-if="!canPost && userTier === 'premium'" class="alert alert-warning mb-0 border-0 shadow-sm d-flex align-items-center gap-3">
        <i class="bi bi-exclamation-triangle-fill fs-4"></i>
        <div>
          <p class="mb-0 fw-bold">Post Limit Reached</p>
          <p class="small mb-0">Premium users are limited to {{ tierLimit }} active posts. Close an existing listing to post a new one.</p>
        </div>
      </div>
      <div v-if="!canPost && userTier === 'freemium'" class="alert alert-warning border-0 shadow-sm d-flex align-items-start gap-3">
        <i class="bi bi-stars fs-4 flex-shrink-0"></i>
        <div>
          <p class="mb-1 fw-bold">Post Limit Reached</p>
          <p class="small mb-1">Free accounts are limited to {{ tierLimit }} active posts. Get verified to unlock up to 10 active posts and more renewals per listing.</p>
          <button class="btn btn-sm btn-warning fw-semibold" @click="contactSupport">Contact support to get verified</button>
        </div>
      </div>

      <fieldset :disabled="!canPost" class="d-flex flex-column gap-3 border-0 p-0 m-0">
        <BFormGroup label="Category" label-for="cat">
          <BFormSelect id="cat" v-model="category" :options="categoryOptions" required />
        </BFormGroup>

        <BFormGroup label="Location" label-for="loc" description="Town, state (e.g. Lebanon, CT)">
          <BFormInput id="loc" v-model="location" placeholder="Lebanon, CT" required />
        </BFormGroup>

        <BFormGroup label="Title" label-for="title" description="Short headline — 5 to 100 characters (e.g. 3 Buff Orpington Hens)">
          <BFormInput
            id="title"
            v-model="title"
            placeholder="e.g. 3 Buff Orpington Hens"
            minlength="5"
            maxlength="100"
            required
          />
          <div class="text-end small mt-1" :class="title.length > 0 && (title.length < 5 || title.length > 100) ? 'text-danger' : 'text-muted'">
            {{ title.length }} / 100
          </div>
        </BFormGroup>

        <BFormGroup label="Price" label-for="price" description="Optional — e.g. $25 each, $10/dozen, Free to good home">
          <BFormInput
            id="price"
            v-model="price"
            placeholder="e.g. $25 each"
            maxlength="60"
          />
          <div v-if="price.length > 0" class="text-end small mt-1 text-muted">
            {{ price.length }} / 60
          </div>
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

        <BFormGroup label="Photo (Optional)" label-for="photo" description="Add 1 photo of your item (max 10MB)">
          <BFormFile
            id="photo"
            v-model="imageFile"
            accept="image/*"
            placeholder="No photo selected"
            browse-text="Choose photo"
            class="classified-file-input"
            :disabled="!canPost"
          />
          <div v-if="imagePreview" class="mt-2 text-center border rounded p-2 bg-light">
            <img :src="imagePreview" class="img-fluid rounded" style="max-height: 200px;" />
            <div class="mt-1">
              <BButton size="sm" variant="outline-danger" @click="removeImage">
                <i class="bi bi-trash me-1"></i> Remove
              </BButton>
            </div>
          </div>
        </BFormGroup>
      </fieldset>
    </form>

    <template #footer>
      <div v-if="isLoggedIn" class="d-flex justify-content-end gap-2 w-100">
        <BButton variant="light" @click="show = false" :disabled="isSubmitting">Cancel</BButton>
        <BButton variant="primary" :disabled="!isValid || isSubmitting || !canPost" @click="handleSubmit">
          <BSpinner v-if="isSubmitting" small class="me-1" />
          Submit for Review
        </BButton>
      </div>
      <div v-else></div>
    </template>
  </BModal>
</template>

<style scoped>
:deep(.classified-file-input .b-form-file-button) {
  background-color: var(--bs-primary);
  color: #fff;
  border: 0;
  border-radius: 0.375rem;
  padding: 0.375rem 0.85rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease-in-out;
}

:deep(.classified-file-input .b-form-file-button:hover) {
  background-color: #0b5ed7;
}

:deep(.classified-file-input .b-form-file-button:disabled),
:deep(.classified-file-input .b-form-file-button[disabled]) {
  opacity: 0.65;
  cursor: not-allowed;
  pointer-events: none;
}
</style>
