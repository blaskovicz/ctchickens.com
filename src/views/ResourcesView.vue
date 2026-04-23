<script setup lang="ts">
import AboutGroup from '../components/AboutGroup.vue';
import RecommendProducts from '../components/RecommendProducts.vue';
import HelpfulResources from '../components/HelpfulResources.vue';
import HaveMoreQuestions from '../components/HaveMoreQuestions.vue';
import PageHero from '../components/PageHero.vue';
</script>

<template>
  <div class="resources-view">
    <PageHero
      title="Resources & Community"
      description="Everything you need to succeed with backyard chickens in Connecticut. From community wisdom to essential supplies and state regulations."
      icon="bi-info-circle"
    />

    <AboutGroup />
    <RecommendProducts />
    <HelpfulResources />
    <HaveMoreQuestions />
  </div>
</template>
