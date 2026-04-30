<script setup lang="ts">
import { ref } from 'vue';
import { BSpinner } from 'bootstrap-vue-next';
import { useToast } from 'bootstrap-vue-next';
import { storage } from '../firebase';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { compressImage } from '../composables/useImageUtils';

export interface ProfileMedia {
  logoUrl: string;
  galleryUrls: string[];
  logoStoragePath: string | null;
  galleryStoragePaths: (string | null)[];
}

export interface ProfileImageEditorExposed {
  flushUploads(): Promise<void>;
  commitDeletes(): Promise<void>;
  discardPending(): void;
}

const props = defineProps<{
  modelValue: ProfileMedia;
  ownerUid: string;
  slug: string;
  locked: boolean;
  isVerified: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [media: ProfileMedia];
}>();

const { create } = useToast();

const logoInputEl = ref<HTMLInputElement | null>(null);
const galleryInputEl = ref<HTMLInputElement | null>(null);
const galleryReplaceInputEl = ref<HTMLInputElement | null>(null);
const replacingGalleryIdx = ref<number | null>(null);
const dragOverLogo = ref(false);
const dragOverAdd = ref(false);
const draggedIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);
const isFlushing = ref(false);
const viewingUrl = ref<string | null>(null);

function onViewerKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeViewer();
}

function openViewer(url: string) {
  viewingUrl.value = url;
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onViewerKeydown);
}

function closeViewer() {
  viewingUrl.value = null;
  document.body.style.overflow = '';
  document.removeEventListener('keydown', onViewerKeydown);
}

const MAX_GALLERY = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Maps blob URL → File for pending (not-yet-uploaded) images.
// Blob URLs are stored in modelValue as placeholders until flushUploads() is called.
const pendingFiles = new Map<string, File>();

// Storage paths queued for deletion after the parent's Firestore write succeeds.
// Deletions are deferred so a failed save doesn't leave Firestore referencing a missing file.
const pendingDeletes = new Set<string>();

function isBlobUrl(url: string) {
  return url.startsWith('blob:');
}

function validateFile(file: File): boolean {
  if (!file.type.startsWith('image/')) {
    create?.({ body: 'File must be an image.', variant: 'danger' });
    return false;
  }
  if (file.size > MAX_FILE_SIZE) {
    create?.({ body: 'Image must be smaller than 10MB.', variant: 'danger' });
    return false;
  }
  return true;
}

async function uploadImage(file: File, path: string, isLogo: boolean): Promise<{ url: string; storagePath: string }> {
  const blob = await compressImage(file, isLogo ? 800 : 1200, isLogo ? 0.85 : 0.75);
  const ref = storageRef(storage, path);
  const snapshot = await uploadBytes(ref, blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(snapshot.ref);
  return { url, storagePath: path };
}

async function deleteStoragePath(path: string | null | undefined) {
  if (!path) return;
  try {
    await deleteObject(storageRef(storage, path));
  } catch {
    // Ignore — file may already be gone
  }
}

function stageLogo(file: File) {
  // Revoke any existing pending logo blob
  if (isBlobUrl(props.modelValue.logoUrl)) {
    pendingFiles.delete(props.modelValue.logoUrl);
    URL.revokeObjectURL(props.modelValue.logoUrl);
  }
  const blobUrl = URL.createObjectURL(file);
  pendingFiles.set(blobUrl, file);
  emit('update:modelValue', { ...props.modelValue, logoUrl: blobUrl, logoStoragePath: null });
}

function stageGalleryFiles(files: FileList | File[]) {
  const available = MAX_GALLERY - props.modelValue.galleryUrls.length;
  if (available <= 0) {
    create?.({ body: `Gallery is full (${MAX_GALLERY} photos max).`, variant: 'warning' });
    return;
  }
  const toStage = Array.from(files).slice(0, available).filter(validateFile);
  if (Array.from(files).length > available) {
    create?.({ body: `Only ${available} slot(s) remaining. Extra files were skipped.`, variant: 'warning' });
  }
  if (toStage.length === 0) return;

  const newUrls = [...props.modelValue.galleryUrls];
  const newPaths = [...props.modelValue.galleryStoragePaths];
  for (const file of toStage) {
    const blobUrl = URL.createObjectURL(file);
    pendingFiles.set(blobUrl, file);
    newUrls.push(blobUrl);
    newPaths.push(null);
  }
  emit('update:modelValue', { ...props.modelValue, galleryUrls: newUrls, galleryStoragePaths: newPaths });
}

function removeLogo() {
  const oldUrl = props.modelValue.logoUrl;
  const oldPath = props.modelValue.logoStoragePath;
  if (isBlobUrl(oldUrl)) {
    pendingFiles.delete(oldUrl);
    URL.revokeObjectURL(oldUrl);
  } else if (oldPath) {
    pendingDeletes.add(oldPath);
  }
  emit('update:modelValue', { ...props.modelValue, logoUrl: '', logoStoragePath: null });
}

function removeGallery(idx: number) {
  const oldUrl = props.modelValue.galleryUrls[idx]!;
  const oldPath = props.modelValue.galleryStoragePaths[idx];
  if (isBlobUrl(oldUrl)) {
    pendingFiles.delete(oldUrl);
    URL.revokeObjectURL(oldUrl);
  } else if (oldPath) {
    pendingDeletes.add(oldPath);
  }
  const newUrls = props.modelValue.galleryUrls.filter((_, i) => i !== idx);
  const newPaths = props.modelValue.galleryStoragePaths.filter((_, i) => i !== idx);
  emit('update:modelValue', { ...props.modelValue, galleryUrls: newUrls, galleryStoragePaths: newPaths });
}

// Uploads all pending (blob URL) images and emits the final modelValue with real Firebase URLs.
// Must be called by the parent before writing to Firestore.
defineExpose<ProfileImageEditorExposed>({
  async flushUploads() {
    if (pendingFiles.size === 0 || isFlushing.value) return;
    isFlushing.value = true;
    try {
      let { logoUrl, galleryUrls, logoStoragePath, galleryStoragePaths } = props.modelValue;
      const toRevoke: string[] = [];

      if (isBlobUrl(logoUrl)) {
        const file = pendingFiles.get(logoUrl);
        if (!file) throw new Error('Missing file for pending logo');
        const path = `profiles/${props.ownerUid}/${props.slug}/logo.jpg`;
        const result = await uploadImage(file, path, true);
        toRevoke.push(logoUrl);
        logoUrl = result.url;
        logoStoragePath = result.storagePath;
      }

      const newGalleryUrls = [...galleryUrls];
      const newGalleryPaths = [...galleryStoragePaths];
      // Upload pending gallery items in parallel
      await Promise.all(
        newGalleryUrls.map(async (url, i) => {
          if (!isBlobUrl(url)) return;
          const file = pendingFiles.get(url);
          if (!file) throw new Error(`Missing file for pending gallery[${i}]`);
          const path = `profiles/${props.ownerUid}/${props.slug}/gallery_${crypto.randomUUID()}.jpg`;
          const result = await uploadImage(file, path, false);
          toRevoke.push(url);
          newGalleryUrls[i] = result.url;
          newGalleryPaths[i] = result.storagePath;
        })
      );

      emit('update:modelValue', { logoUrl, galleryUrls: newGalleryUrls, logoStoragePath, galleryStoragePaths: newGalleryPaths });
      toRevoke.forEach(url => URL.revokeObjectURL(url));
    } finally {
      pendingFiles.clear();
      isFlushing.value = false;
    }
  },

  // Executes deferred Storage deletes. Call after the parent's Firestore write succeeds
  // so a failed save never leaves Firestore referencing a deleted file.
  async commitDeletes() {
    const paths = [...pendingDeletes];
    pendingDeletes.clear();
    await Promise.all(paths.map(p => deleteStoragePath(p)));
  },

  // Clears all local pending state without touching Storage. Call on discard so blob
  // object URLs are revoked and deferred deletes are abandoned.
  discardPending() {
    for (const url of pendingFiles.keys()) URL.revokeObjectURL(url);
    pendingFiles.clear();
    pendingDeletes.clear();
  },

});

function onLogoDrop(e: DragEvent) {
  dragOverLogo.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file && validateFile(file)) stageLogo(file);
}

function onAddDrop(e: DragEvent) {
  dragOverAdd.value = false;
  const files = e.dataTransfer?.files;
  if (files?.length) stageGalleryFiles(files);
}

function onLogoFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file && validateFile(file)) stageLogo(file);
  (e.target as HTMLInputElement).value = '';
}

function openGalleryReplace(idx: number) {
  replacingGalleryIdx.value = idx;
  galleryReplaceInputEl.value?.click();
}

function onGalleryReplaceChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = '';
  if (!file || replacingGalleryIdx.value === null || !validateFile(file)) return;
  const idx = replacingGalleryIdx.value;
  replacingGalleryIdx.value = null;

  const oldUrl = props.modelValue.galleryUrls[idx]!;
  const oldPath = props.modelValue.galleryStoragePaths[idx];
  if (isBlobUrl(oldUrl)) {
    pendingFiles.delete(oldUrl);
    URL.revokeObjectURL(oldUrl);
  }
  const blobUrl = URL.createObjectURL(file);
  pendingFiles.set(blobUrl, file);
  const newUrls = [...props.modelValue.galleryUrls];
  const newPaths = [...props.modelValue.galleryStoragePaths];
  newUrls[idx] = blobUrl;
  newPaths[idx] = null;
  if (!isBlobUrl(oldUrl) && oldPath) pendingDeletes.add(oldPath);
  emit('update:modelValue', { ...props.modelValue, galleryUrls: newUrls, galleryStoragePaths: newPaths });
}

function onGalleryFileChange(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (files?.length) stageGalleryFiles(files);
  (e.target as HTMLInputElement).value = '';
}

function onDragStart(idx: number) {
  draggedIndex.value = idx;
}

function onDragOver(idx: number) {
  dragOverIndex.value = idx;
}

function onDrop(targetIdx: number) {
  if (draggedIndex.value === null || draggedIndex.value === targetIdx) {
    draggedIndex.value = null;
    dragOverIndex.value = null;
    return;
  }
  const urls = [...props.modelValue.galleryUrls];
  const paths = [...props.modelValue.galleryStoragePaths];
  const movedUrl = urls.splice(draggedIndex.value, 1)[0]!;
  const movedPath = paths.splice(draggedIndex.value, 1)[0]!;
  urls.splice(targetIdx, 0, movedUrl);
  paths.splice(targetIdx, 0, movedPath);
  emit('update:modelValue', { ...props.modelValue, galleryUrls: urls, galleryStoragePaths: paths });
  draggedIndex.value = null;
  dragOverIndex.value = null;
}

function onDragEnd() {
  draggedIndex.value = null;
  dragOverIndex.value = null;
}
</script>

<template>
  <div>
    <!-- Unverified gate -->
    <div v-if="!isVerified" class="unverified-gate d-flex align-items-center gap-3 p-3 rounded border-dashed bg-light-subtle">
      <i class="bi bi-images fs-3 text-muted"></i>
      <div>
        <div class="fw-semibold text-muted small">Photo management is for verified members</div>
        <div class="text-muted smaller">Get verified to upload your logo and gallery photos.</div>
      </div>
    </div>

    <!-- Editor -->
    <div v-else class="d-flex gap-3 flex-wrap align-items-start">

      <!-- Logo slot -->
      <div>
        <div class="form-label small mb-1">Logo</div>
        <div
          class="image-slot logo-slot position-relative"
          :class="{ 'drag-over': dragOverLogo, 'is-locked': locked }"
          @dragover.prevent="dragOverLogo = true"
          @dragleave="dragOverLogo = false"
          @drop.prevent="!locked && onLogoDrop($event)"
          @click="!locked && !modelValue.logoUrl && logoInputEl?.click()"
        >
          <img v-if="modelValue.logoUrl" :src="modelValue.logoUrl" class="slot-img" alt="Logo" referrerpolicy="no-referrer" />
          <div v-else class="slot-placeholder text-muted">
            <i class="bi bi-person-bounding-box fs-4"></i>
            <span class="smaller">Logo</span>
          </div>

          <div v-if="modelValue.logoUrl && isBlobUrl(modelValue.logoUrl)" class="pending-badge">
            <i class="bi bi-clock-fill"></i>
          </div>

          <div v-if="modelValue.logoUrl" class="slot-overlay">
            <button type="button" class="slot-action-btn" @click.stop="openViewer(modelValue.logoUrl)" title="View full size">
              <i class="bi bi-arrows-fullscreen"></i>
            </button>
            <template v-if="!locked">
              <button type="button" class="slot-action-btn" @click.stop="logoInputEl?.click()" title="Replace">
                <i class="bi bi-pencil"></i>
              </button>
              <button type="button" class="slot-action-btn slot-action-danger" @click.stop="removeLogo()" title="Remove">
                <i class="bi bi-trash"></i>
              </button>
            </template>
          </div>
        </div>
        <input ref="logoInputEl" type="file" accept="image/*" class="d-none" @change="onLogoFileChange" />
      </div>

      <!-- Gallery -->
      <div class="flex-grow-1">
        <div class="form-label small mb-1">Gallery <span class="text-muted fw-normal">({{ modelValue.galleryUrls.length }}/{{ MAX_GALLERY }})</span></div>
        <div class="d-flex flex-wrap gap-2">

          <div
            v-for="(url, idx) in modelValue.galleryUrls"
            :key="url"
            class="image-slot gallery-slot position-relative"
            :class="{
              'drag-over': !locked && dragOverIndex === idx,
              'is-dragging': !locked && draggedIndex === idx,
              'is-locked': locked,
            }"
            :draggable="!locked"
            @dragstart="!locked && onDragStart(idx)"
            @dragover.prevent="!locked && onDragOver(idx)"
            @drop.prevent="!locked && onDrop(idx)"
            @dragend="!locked && onDragEnd()"
          >
            <img :src="url" class="slot-img" alt="Gallery photo" referrerpolicy="no-referrer" />

            <div v-if="isBlobUrl(url)" class="pending-badge">
              <i class="bi bi-clock-fill"></i>
            </div>

            <div class="slot-overlay">
              <button type="button" class="slot-action-btn" @click.stop="openViewer(url)" title="View full size">
                <i class="bi bi-arrows-fullscreen"></i>
              </button>
              <template v-if="!locked">
                <button type="button" class="slot-action-btn" @click.stop="openGalleryReplace(idx)" title="Replace">
                  <i class="bi bi-pencil"></i>
                </button>
                <button type="button" class="slot-action-btn slot-action-danger" @click.stop="removeGallery(idx)" title="Remove">
                  <i class="bi bi-trash"></i>
                </button>
              </template>
            </div>
          </div>

          <!-- Add slot -->
          <div
            v-if="!locked && modelValue.galleryUrls.length < MAX_GALLERY"
            class="image-slot gallery-slot add-slot"
            :class="{ 'drag-over': dragOverAdd }"
            @click="galleryInputEl?.click()"
            @dragover.prevent="dragOverAdd = true"
            @dragleave="dragOverAdd = false"
            @drop.prevent="onAddDrop($event)"
          >
            <div class="slot-placeholder text-muted">
              <i class="bi bi-plus-lg fs-4"></i>
              <span class="smaller">Add photo</span>
            </div>
          </div>

        </div>
        <input ref="galleryInputEl" type="file" accept="image/*" multiple class="d-none" @change="onGalleryFileChange" />
        <input ref="galleryReplaceInputEl" type="file" accept="image/*" class="d-none" @change="onGalleryReplaceChange" />
        <div v-if="pendingFiles.size > 0 && !isFlushing" class="text-muted smaller mt-2">
          <i class="bi bi-clock me-1"></i>{{ pendingFiles.size }} photo{{ pendingFiles.size > 1 ? 's' : '' }} will upload when you save
        </div>
        <div v-if="isFlushing" class="text-muted smaller mt-2">
          <BSpinner small class="me-1" />Uploading photos...
        </div>
      </div>

    </div>
  </div>

  <Teleport to="body">
    <div v-if="viewingUrl" class="viewer-overlay" @click.self="closeViewer">
      <div class="viewer-content">
        <button class="viewer-close-btn" @click="closeViewer">&times;</button>
        <img :src="viewingUrl" class="viewer-img" alt="Full size" referrerpolicy="no-referrer" />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.border-dashed { border-style: dashed !important; }
.smaller { font-size: 0.72rem; }

.image-slot {
  width: 110px;
  height: 110px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #e2e8f0;
  background: #f8fafc;
  transition: border-color 0.15s, opacity 0.15s;
  flex-shrink: 0;
}

.logo-slot { cursor: pointer; }
.gallery-slot { cursor: grab; }

.add-slot {
  cursor: pointer;
  border-style: dashed;
}

.add-slot:hover,
.image-slot.drag-over {
  border-color: #3b82f6;
  background: #eff6ff;
}

.image-slot.is-dragging { opacity: 0.4; }
.image-slot.is-locked { cursor: default; }

.slot-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.slot-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.slot-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.15s;
}

.image-slot:hover .slot-overlay { opacity: 1; }

.slot-action-btn {
  background: rgba(255, 255, 255, 0.85);
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.85rem;
  color: #374151;
  transition: background 0.1s;
}

.slot-action-btn:hover { background: #fff; }
.slot-action-danger { color: #dc2626; }
.slot-action-danger:hover { background: #fee2e2; }

.pending-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.55);
  color: #fbbf24;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
}

.unverified-gate { min-height: 80px; border: 1px dashed #cbd5e1; }

.viewer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  cursor: zoom-out;
  animation: fadeIn 0.2s ease;
}

.viewer-content {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  cursor: default;
}

.viewer-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  display: block;
  border-radius: 4px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.viewer-close-btn {
  position: absolute;
  top: -14px;
  right: -14px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  font-size: 1.4rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: background 0.15s;
}

.viewer-close-btn:hover { background: rgba(0, 0, 0, 0.85); }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>
