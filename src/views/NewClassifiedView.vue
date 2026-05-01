<script setup lang="ts">
import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { BButton, BSpinner, useToast } from 'bootstrap-vue-next';
import type { ClassifiedCategory, UserTier } from '../types';
import { TIER_LIMITS, CATEGORY_LABELS, CATEGORY_VARIANTS } from '../types';
import { storage } from '../firebase';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import type { StorageReference } from 'firebase/storage';
import { compressImage } from '../composables/useImageUtils';
import { useSupport } from '../composables/useSupport';
import PageHero from '../components/PageHero.vue';

const store = useStore();
const router = useRouter();
const { create } = useToast();
const { contactSupport } = useSupport();

const isSubmitting = ref(false);
const category = ref<ClassifiedCategory>('for_sale');
const location = ref('');
const title = ref('');
const description = ref('');
const price = ref('');
const imageFile = ref<File | null>(null);
const imagePreview = ref<string | null>(null);
const fileInputEl = ref<HTMLInputElement | null>(null);

const isLoggedIn = computed(() => store.getters.isLoggedIn);
const user = computed(() => store.getters.currentUser);
const userTier = computed(() => store.getters.userTier as UserTier);
const canPost = computed(() => store.getters.canPostClassified);
const tierLimit = computed(() => TIER_LIMITS[userTier.value]);

const categoryOptions = Object.entries(CATEGORY_LABELS).map(([value, text]) => ({ value, text }));

const categoryBadgeClass = computed(() => `bg-${CATEGORY_VARIANTS[category.value]}`);

const isValid = computed(() =>
  category.value &&
  location.value.trim().length >= 2 &&
  title.value.trim().length >= 5 &&
  title.value.trim().length <= 100 &&
  description.value.trim().length >= 20
);

const onFileChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    create?.({ body: 'Image must be smaller than 10MB.', variant: 'danger' });
    (e.target as HTMLInputElement).value = '';
    return;
  }
  if (!file.type.startsWith('image/')) {
    create?.({ body: 'File must be an image.', variant: 'danger' });
    (e.target as HTMLInputElement).value = '';
    return;
  }
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value);
  imageFile.value = file;
  imagePreview.value = URL.createObjectURL(file);
};

const removeImage = () => {
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value);
  imagePreview.value = null;
  imageFile.value = null;
  if (fileInputEl.value) fileInputEl.value.value = '';
};

const handleSubmit = async () => {
  if (!isValid.value || isSubmitting.value) return;
  isSubmitting.value = true;
  let uploadedRef: StorageReference | null = null;
  try {
    let imageUrl = undefined;
    if (imageFile.value && user.value) {
      const compressedBlob = await compressImage(imageFile.value);
      const path = `classifieds/${user.value.uid}/${crypto.randomUUID()}.jpg`;
      const fileRef = storageRef(storage, path);
      const snapshot = await uploadBytes(fileRef, compressedBlob, { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' });
      uploadedRef = snapshot.ref;
      imageUrl = await getDownloadURL(snapshot.ref);
    }
    await store.dispatch('createDraftClassified', {
      category: category.value,
      location: location.value.trim(),
      title: title.value.trim(),
      description: description.value.trim(),
      price: price.value.trim() || undefined,
      image_url: imageUrl,
    });
    create?.({ body: "Your listing has been submitted for review. We'll email you when it's approved.", variant: 'success' });
    router.push('/classified');
  } catch (e: any) {
    if (uploadedRef) await deleteObject(uploadedRef).catch(() => {});
    create?.({ body: e.message || 'Failed to submit listing.', variant: 'danger' });
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div>
    <PageHero
      title="Post a Classified"
      description="Reach the whole CT Backyard Chickens community with your listing."
      icon="bi-megaphone-fill"
    />

    <div class="container py-4">
      <div class="row justify-content-center">
        <div class="col-md-9 col-lg-7 col-xl-6">
          <div class="mb-4">
            <BButton variant="outline-secondary" size="sm" @click="router.push('/classified')">
              <i class="bi bi-arrow-left me-1"></i> All Classifieds
            </BButton>
          </div>

          <div v-if="!isLoggedIn" class="text-center py-5">
            <i class="bi bi-lock-fill fs-2 text-muted mb-3 d-block"></i>
            <p class="text-muted">You must be signed in to post a classified.</p>
            <BButton @click="store.dispatch('loginWithFacebook')" variant="primary">
              <i class="bi bi-facebook me-2"></i> Log in with Facebook
            </BButton>
          </div>

          <form v-else @submit.prevent="handleSubmit" class="card border-0 shadow-sm overflow-hidden">

            <!-- Image area -->
            <div
              class="image-area"
              :class="{ 'image-placeholder': !imagePreview, 'image-disabled': !canPost }"
              @click="!imagePreview && canPost && fileInputEl?.click()"
            >
              <img v-if="imagePreview" :src="imagePreview" class="image-preview" alt="Preview" />
              <div v-else class="image-hint">
                <i class="bi bi-camera fs-3 mb-1"></i>
                <span class="small">Add a photo</span>
                <span class="smaller text-muted">Optional, but recommended</span>
              </div>
              <button v-if="imagePreview && canPost" type="button" class="remove-btn" @click.stop="removeImage">
                <i class="bi bi-x-lg"></i>
              </button>
            </div>
            <input ref="fileInputEl" type="file" accept="image/*" class="d-none" :disabled="!canPost" @change="onFileChange" />

            <div class="card-body d-flex flex-column gap-3">

              <!-- Tier warnings -->
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
                  <button type="button" class="btn btn-sm btn-warning fw-semibold" @click="contactSupport">Contact support to get verified</button>
                </div>
              </div>

              <fieldset :disabled="!canPost" class="d-flex flex-column gap-3 border-0 p-0 m-0">

                <!-- Category + Price — mirrors card header row -->
                <div class="d-flex justify-content-between align-items-start gap-2">
                  <div>
                    <label class="form-label small fw-semibold text-muted mb-1">Category</label>
                    <div class="category-select-wrapper">
                      <select v-model="category" class="category-select" :class="categoryBadgeClass" required>
                        <option v-for="opt in categoryOptions" :key="opt.value" :value="opt.value">{{ opt.text }}</option>
                      </select>
                      <i class="bi bi-chevron-down category-chevron"></i>
                    </div>
                  </div>
                  <div>
                    <label class="form-label small fw-semibold text-muted mb-1 d-block text-end">Price</label>
                    <input v-model="price" type="text" class="price-input" placeholder="e.g. $25 each" maxlength="60" />
                  </div>
                </div>

                <!-- Title — mirrors card-title -->
                <div>
                  <label class="form-label small fw-semibold text-muted mb-1">Title</label>
                  <input
                    v-model="title"
                    type="text"
                    class="title-input w-100"
                    placeholder="e.g. 3 Buff Orpington Hens"
                    minlength="5"
                    maxlength="100"
                    required
                  />
                  <div class="text-end small mt-1" :class="title.length > 0 && (title.length < 5 || title.length > 100) ? 'text-danger' : 'text-muted'">
                    {{ title.length }} / 100
                  </div>
                </div>

                <!-- Description — mirrors card-text -->
                <div>
                  <label class="form-label small fw-semibold text-muted mb-1">Description</label>
                  <textarea
                    v-model="description"
                    class="description-input w-100"
                    rows="4"
                    placeholder="Be specific — breed, quantity, age, health status..."
                    required
                  />
                  <div class="text-end small mt-1" :class="description.length > 0 && description.length < 20 ? 'text-danger' : 'text-muted'">
                    {{ description.length }} / 20 min
                  </div>
                </div>

                <!-- Location — mirrors card footer -->
                <div>
                  <label class="form-label small fw-semibold text-muted mb-1">Town</label>
                  <div class="d-flex align-items-center gap-2 text-muted small">
                    <i class="bi bi-geo-alt flex-shrink-0"></i>
                    <input
                      v-model="location"
                      type="text"
                      class="location-input"
                      placeholder="e.g. Norwalk, CT"
                      minlength="2"
                      required
                    />
                  </div>
                </div>

              </fieldset>

              <div class="d-flex justify-content-end gap-2 pt-1 border-top">
                <BButton variant="light" @click="router.push('/classified')" :disabled="isSubmitting">Cancel</BButton>
                <BButton type="submit" variant="primary" :disabled="!isValid || isSubmitting || !canPost">
                  <BSpinner v-if="isSubmitting" small class="me-1" />
                  Submit for Review
                </BButton>
              </div>

            </div>
          </form>

        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.image-area {
  position: relative;
  height: 200px;
  overflow: hidden;
  background: #f8f9fa;
}

.image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-bottom: 2px dashed #dee2e6;
  cursor: pointer;
  color: #adb5bd;
  transition: background 0.15s;
}

.image-placeholder:hover {
  background: #e9ecef;
  color: #6c757d;
}

.image-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.image-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.smaller {
  font-size: 0.75rem;
}

.image-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.75rem;
  line-height: 1;
}

.category-select-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.category-select {
  appearance: none;
  background-image: none;
  border: none;
  color: #fff;
  border-radius: 50rem;
  padding: 0.25rem 1.5rem 0.25rem 0.75rem;
  margin-left: 0.5rem;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
}

.category-select option {
  background-color: #fff;
  color: #212529;
}

.category-select.bg-warning { color: #212529; }

.category-select:disabled,
fieldset:disabled .category-select {
  background-color: #adb5bd !important;
  color: #fff !important;
  cursor: not-allowed;
}

.category-chevron {
  position: absolute;
  right: 0.5rem;
  font-size: 0.65rem;
  pointer-events: none;
  color: inherit;
}

.category-select-wrapper .category-select.bg-warning ~ .category-chevron { color: #212529; }
.category-select-wrapper .category-select:not(.bg-warning) ~ .category-chevron { color: #fff; }

.price-input {
  border: none;
  border-bottom: 1px dashed #dee2e6;
  background: transparent;
  color: #198754;
  font-weight: 600;
  font-size: 0.875rem;
  text-align: right;
  width: 130px;
  outline: none;
  padding: 2px 0;
}

.price-input::placeholder { color: #adb5bd; font-weight: 400; }

.title-input {
  border: none;
  border-bottom: 1px dashed #dee2e6;
  background: transparent;
  font-weight: 600;
  font-size: 1rem;
  color: #212529;
  outline: none;
  padding: 2px 0;
}

.title-input::placeholder { color: #adb5bd; font-weight: 400; }

.description-input {
  border: none;
  border-bottom: 1px dashed #dee2e6;
  background: transparent;
  color: #6c757d;
  font-size: 0.875rem;
  resize: none;
  outline: none;
  padding: 2px 0;
}

.description-input::placeholder { color: #adb5bd; }

.location-input {
  border: none;
  background: transparent;
  font-size: 0.875rem;
  color: #6c757d;
  outline: none;
  flex: 1;
  min-width: 0;
}

.location-input::placeholder { color: #adb5bd; }
</style>
