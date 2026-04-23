<script setup lang="ts">
import { useSupport } from '../composables/useSupport';

const { contactSupport: handleContactSupport } = useSupport();
</script>

<template>
  <section id="questions" class="py-5">
    <div class="container">
      <div class="row">
        <div class="col-lg-12">
          <div class="card border-primary shadow-sm">
            <div class="card-body p-4 text-center">
              <h4 class="mb-3">
                <i class="bi bi-chat-dots-fill text-primary me-2"></i>
                Have More Questions?
              </h4>
              <p class="mb-3">Join our Facebook group to ask questions and get advice from experienced chicken keepers in your area!</p>
              <div class="d-flex flex-wrap justify-content-center gap-3">
                <a href="https://www.facebook.com/groups/1465813350383274" target="_blank" class="btn btn-primary btn-lg">
                  <i class="bi bi-facebook"></i> Join the Facebook Group
                </a>
                <button @click="handleContactSupport" class="btn btn-outline-primary btn-lg">
                  <i class="bi bi-headset"></i> Contact Support
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
