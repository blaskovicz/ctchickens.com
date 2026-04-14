<script setup lang="ts">
import { computed } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import FeaturedBreeder from '../components/FeaturedBreeder.vue';
import BreederTable from '../components/BreederTable.vue';
import FeaturedPartnerBanner from '../components/FeaturedPartnerBanner.vue';
import HowItWorks from '../components/HowItWorks.vue';
import WhyJoin from '../components/WhyJoin.vue';

const store = useStore();
const router = useRouter();
const user = computed(() => store.state.user);

const handleContactSupport = async () => {
  if (!user.value) {
    store.commit('PUSH_TOAST', {
      title: 'Authentication Required',
      message: 'Please log in to contact support.',
      variant: 'warning'
    });
    return;
  }
  
  const threadId = `support_${user.value.uid}`;
  const threadRef = doc(db, 'inquiry_threads', threadId);

  try {
    const threadSnap = await getDoc(threadRef);
    if (!threadSnap.exists()) {
      await setDoc(threadRef, {
        participants: [user.value.uid, 'admin'],
        type: 'support',
        userUid: user.value.uid,
        userName: user.value.displayName || 'User',
        breederSlug: 'support',
        breederName: 'Site Support',
        lastMessage: 'Started support chat',
        updatedAt: serverTimestamp(),
        unreadCount: { 'admin': 0 }
      });
    }
    router.push({ name: 'inbox', params: { threadId } });
  } catch (err: any) {
    store.commit('PUSH_TOAST', {
      title: 'Error',
      message: `Could not start support chat: ${err.message}`,
      variant: 'danger'
    });
  }
};
</script>

<template>
  <section class="featured-partner-section">
    <FeaturedPartnerBanner />
  </section>

  <section class="hero-section">
    <div class="hero-overlay"></div>
    <div class="container position-relative">
      <div class="row align-items-center">
        <div class="col-lg-12 text-center">
          <h1 class="display-4 fw-bold mb-3">Welcome to Connecticut Backyard Chickens</h1>
          <p class="lead mb-4">
            <span class="text-primary fw-bold">Over 12,000 active members</span> in one of Connecticut's largest backyard chicken communities!
          </p>
          <p class="lead mb-4">
            The official sales directory for the group, all of CT, and beyond.
          </p>
          <div class="d-flex flex-wrap justify-content-center gap-3">
            <router-link to="/directory" class="btn btn-primary btn-lg">
              <i class="bi bi-search"></i> View Directory
            </router-link>
            <router-link to="/get-listed" class="btn btn-light btn-lg">
              <i class="bi bi-plus-circle"></i> Start Your Listing
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </section>

  <HowItWorks />

  <section id="directory" class="py-5 bg-light">
    <div class="container">
      <div class="row mb-4">
        <div class="col-lg-8 mx-auto text-center">
          <h2 class="display-5 fw-bold text-dark">Local Breeder & Supplier Directory</h2>
          <p class="lead">
            Find local Connecticut suppliers, breeders, and service providers for your backyard farm.
            Facebook prohibits live animal sales; all listings are moved here for community safety.
            <br>
            <span><span class="badge bg-success ms-2"><i class="bi bi-check-circle-fill me-1"></i>Verified</span> listings confirm the breeder is a known member of our community in good standing.</span>
            <br>
            <span><span class="badge bg-primary ms-2"><i class="bi bi-award-fill me-1"></i>Founding Member</span> is reserved for verified members who joined the directory during the first launch year.</span>
          </p>
        </div>
      </div>
      
      <FeaturedBreeder />
      <BreederTable />
    </div>
  </section>

  <WhyJoin />

  <section id="products" class="py-5">
    <div class="container">
      <div class="row">
        <div class="col-lg-8 mx-auto text-center mb-5">
          <h2 class="display-5 fw-bold mb-3">Recommended Products</h2>
          <p class="lead">
            Essential supplies recommended by our community members to help you get started or improve your chicken-keeping setup.
            Some trusted brands like <span class="text-secondary">Omlet</span>, <span class="text-secondary">RentACoop</span>, and <span class="text-secondary">Premier1</span> are recommended by the community.
          </p>
        </div>
      </div>

      <div class="row g-4">
        <div class="col-md-6 col-lg-4">
          <div class="card h-100 shadow-sm product-card">
            <div class="card-body">
              <div class="product-icon mb-3">
                <i class="bi bi-house-door-fill"></i>
              </div>
              <h5 class="card-title">Chicken Coops</h5>
              <p class="card-text">Quality coops suitable for Connecticut weather. Insulated options available for cold winters.</p>
              <a href="https://www.omlet.us/chicken-coops/" target="_blank" class="btn btn-sm btn-outline-primary mb-2">
                Omlet Coops <i class="bi bi-box-arrow-up-right"></i>
              </a>
              <a href="https://www.tractorsupply.com/tsc/search/chicken%20coop?isIntSrch=written" target="_blank" class="btn btn-sm btn-outline-primary mb-2">
                Search Tractor Supply <i class="bi bi-box-arrow-up-right"></i>
              </a>
              <a href="https://www.amazon.com/s?k=chicken+coop" target="_blank" class="btn btn-sm btn-outline-primary mb-2">
                Search Amazon <i class="bi bi-box-arrow-up-right"></i>
              </a>
            </div>
          </div>
        </div>

        <div class="col-md-6 col-lg-4">
          <div class="card h-100 shadow-sm product-card">
            <div class="card-body">
              <div class="product-icon mb-3">
                <i class="bi bi-droplet-fill"></i>
              </div>
              <h5 class="card-title">Heated Waterers</h5>
              <p class="card-text">Essential for Connecticut winters. Keep your flock hydrated even in freezing temperatures.</p>
              <a href="https://www.premier1supplies.com/p/heated-poultry-waterer" target="_blank" class="btn btn-sm btn-outline-primary mb-2">
                Premier1 Heated Poultry Waterer <i class="bi bi-box-arrow-up-right"></i>
              </a>
              <a href="https://www.amazon.com/gp/product/B0FQ8W9BS2/" target="_blank" class="btn btn-sm btn-outline-primary mb-2">
                RentACoop Thermo Bucket Belt (Small) <i class="bi bi-box-arrow-up-right"></i>
              </a>
              <a href="https://www.amazon.com/s?k=heated+chicken+waterer" target="_blank" class="btn btn-sm btn-outline-primary mb-2">
                Search Amazon <i class="bi bi-box-arrow-up-right"></i>
              </a>
            </div>
          </div>
        </div>

        <div class="col-md-6 col-lg-4">
          <div class="card h-100 shadow-sm product-card">
            <div class="card-body">
              <div class="product-icon mb-3">
                <i class="bi bi-bucket-fill"></i>
              </div>
              <h5 class="card-title">Feeders</h5>
              <p class="card-text">Automatic and manual feeders to reduce waste and keep your chickens well-fed.</p>
              <a href="https://grandpasfeeders.com/" target="_blank" class="btn btn-sm btn-outline-primary mb-2">
                Grandpa's Feeders <i class="bi bi-box-arrow-up-right"></i>
              </a>
              <a href="https://www.amazon.com/s?k=chicken+feeder" target="_blank" class="btn btn-sm btn-outline-primary mb-2">
                Search Amazon <i class="bi bi-box-arrow-up-right"></i>
              </a>
            </div>
          </div>
        </div>

        <div class="col-md-6 col-lg-4">
          <div class="card h-100 shadow-sm product-card">
            <div class="card-body">
              <div class="product-icon mb-3">
                <i class="bi bi-egg-fried"></i>
              </div>
              <h5 class="card-title">Chicken Feed</h5>
              <p class="card-text">High-quality feed to keep your hens healthy and producing delicious eggs.</p>
              <a href="https://www.chewy.com/kalmbach-feeds-all-natural-17-protein/dp/226624" target="_blank" class="btn btn-sm btn-outline-primary mb-2">
                Kalmback 17% Layer Pellets (50lb) <i class="bi bi-box-arrow-up-right"></i>
              </a>
              <a href="https://www.amazon.com/s?k=chicken+layer+feed" target="_blank" class="btn btn-sm btn-outline-primary mb-2">
                Search Amazon <i class="bi bi-box-arrow-up-right"></i>
              </a>
            </div>
          </div>
        </div>

        <div class="col-md-6 col-lg-4">
          <div class="card h-100 shadow-sm product-card">
            <div class="card-body">
              <div class="product-icon mb-3">
                <i class="bi bi-shield-fill-check"></i>
              </div>
              <h5 class="card-title">Predator Protection</h5>
              <p class="card-text">Hardware cloth, locks, and other supplies to keep your flock safe from predators. Chicken wire is often not enough.</p>
              <a href="https://www.lowes.com/search?searchTerm=hardware+cloth" target="_blank" class="btn btn-sm btn-outline-primary mb-2">
                Search Lowes <i class="bi bi-box-arrow-up-right"></i>
              </a>
              <a href="https://www.amazon.com/s?k=chicken+predator+protection" target="_blank" class="btn btn-sm btn-outline-primary mb-2">
                Search Amazon <i class="bi bi-box-arrow-up-right"></i>
              </a>
            </div>
          </div>
        </div>

        <div class="col-md-6 col-lg-4">
          <div class="card h-100 shadow-sm product-card">
            <div class="card-body">
              <div class="product-icon mb-3">
                <i class="bi bi-door-open"></i>
              </div>
              <h5 class="card-title">Automatic Coop Doors</h5>
              <p class="card-text">Keep your chickens safe and happy by automatically opening and closing the coop door.</p>
              <a href="https://www.amazon.com/dp/B08CR3H8NQ" target="_blank" class="btn btn-sm btn-outline-primary mb-2">
                JVR Automatic WiFi Coop Door <i class="bi bi-box-arrow-up-right"></i>
              </a>
              <a href="https://www.omlet.us/smart-automatic-chicken-coop-door/" target="_blank" class="btn btn-sm btn-outline-primary mb-2">
                Omlet Smart Automatic Chicken Coop Door <i class="bi bi-box-arrow-up-right"></i>
              </a>
              <a href="https://www.amazon.com/s?k=chicken+coop+door" target="_blank" class="btn btn-sm btn-outline-primary mb-2">
                Search Amazon <i class="bi bi-box-arrow-up-right"></i>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section id="resources" class="py-5 bg-light">
    <div class="container">
      <div class="row">
        <div class="col-lg-8 mx-auto text-center mb-5">
          <h2 class="display-5 fw-bold mb-3">Helpful Resources</h2>
          <p class="lead">Curated links and information to help you become a successful chicken keeper in Connecticut.</p>
        </div>
      </div>

      <div class="row g-4">
        <div class="col-lg-6">
          <div class="card h-100 border-0 shadow">
            <div class="card-body p-4">
              <h4 class="card-title mb-3">
                <i class="bi bi-book-fill text-primary me-2"></i>
                Getting Started Guides
              </h4>
              <ul class="list-unstyled">
                <li class="mb-3">
                  <a href="https://www.chewy.com/education/farm-animal/chicken/how-to-raise-backyard-chickens-a-beginners-guide" target="_blank" class="text-decoration-none">
                    <strong>Beginner's Guide to Raising Chickens</strong>
                    <br><small class="text-muted">Comprehensive introduction to chicken keeping</small>
                  </a>
                </li>
                <li class="mb-3">
                  <a href="https://www.mypetchicken.com/backyard-chickens/chicken-help/How-many-chickens-should-I-get-H113.aspx" target="_blank" class="text-decoration-none">
                    <strong>How Many Chickens Should You Get?</strong>
                    <br><small class="text-muted">Planning your flock size</small>
                  </a>
                </li>
                <li class="mb-3">
                  <a href="https://www.chewy.com/education/farm-animal/chicken/best-backyard-chicken-breeds" target="_blank" class="text-decoration-none">
                    <strong>Best Chicken Breeds for Beginners</strong>
                    <br><small class="text-muted">Choosing the right breeds for your setup</small>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div class="col-lg-6">
          <div class="card h-100 border-0 shadow">
            <div class="card-body p-4">
              <h4 class="card-title mb-3">
                <i class="bi bi-file-earmark-text-fill text-success me-2"></i>
                Connecticut Regulations
              </h4>
              <ul class="list-unstyled">
                <li class="mb-3">
                  <a href="https://portal.ct.gov/DOAG" target="_blank" class="text-decoration-none">
                    <strong>CT Department of Agriculture</strong>
                    <br><small class="text-muted">Official state agricultural resources</small>
                  </a>
                </li>
                <li class="mb-3">
                  <a href="https://www.cga.ct.gov/" target="_blank" class="text-decoration-none">
                    <strong>Connecticut General Assembly</strong>
                    <br><small class="text-muted">State laws and regulations</small>
                  </a>
                </li>
                <li class="mb-3">
                  <p class="mb-1"><strong>Local Zoning Laws</strong></p>
                  <small class="text-muted">Check with your town hall for specific chicken-keeping ordinances in your area</small>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div class="col-lg-6">
          <div class="card h-100 border-0 shadow">
            <div class="card-body p-4">
              <h4 class="card-title mb-3">
                <i class="bi bi-heart-pulse-fill text-danger me-2"></i>
                Health & Care
              </h4>
              <ul class="list-unstyled">
                <li class="mb-3">
                  <a href="https://the-chicken-chick.com/whats-scoop-on-chicken-poop-digestive/" target="_blank" class="text-decoration-none">
                    <strong>Chicken Digestive Guide</strong>
                    <br><small class="text-muted">Common digestive issues and solutions</small>
                  </a>
                </li>
                <li class="mb-3">
                  <a href="https://www.tractorsupply.com/tsc/cms/life-out-here/the-coop/chick-care/prepare-your-chickens-for-winter" target="_blank" class="text-decoration-none">
                    <strong>Winter Care Guide</strong>
                    <br><small class="text-muted">Keeping chickens safe in cold weather</small>
                  </a>
                </li>
                <li class="mb-3">
                  <a href="https://www.fresheggsdaily.blog/" target="_blank" class="text-decoration-none">
                    <strong>Fresh Eggs Daily Blog</strong>
                    <br><small class="text-muted">Excellent resource for chicken care tips</small>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div class="col-lg-6">
          <div class="card h-100 border-0 shadow">
            <div class="card-body p-4">
              <h4 class="card-title mb-3">
                <i class="bi bi-hammer text-warning me-2"></i>
                Coop Building & Design
              </h4>
              <ul class="list-unstyled">
                <li class="mb-3">
                  <a href="https://www.youtube.com/results?search_query=chicken+coop+build" target="_blank" class="text-decoration-none">
                    <strong>Coop Building Videos</strong>
                    <br><small class="text-muted">Step-by-step construction tutorials</small>
                  </a>
                </li>

                <li class="mb-3">
                  <a href="https://morningchores.com/chicken-coop-plans/" target="_blank" class="text-decoration-none">
                    <strong>Coop Building Plans</strong>
                    <br><small class="text-muted">Step-by-step construction guides</small>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div class="row mt-4">
        <div class="col-lg-12">
          <div class="card border-primary">
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