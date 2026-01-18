<script setup lang="ts">
  import FeaturedBreeder from './components/FeaturedBreeder.vue';
  import BreederTable from './components/BreederTable.vue';
  
  // Import global styles
  import 'bootstrap/dist/css/bootstrap.min.css';
  import 'bootstrap-icons/font/bootstrap-icons.css';
  import 'bootstrap/dist/js/bootstrap.bundle.min.js'; // Needed for mobile navbar toggle
  </script>
  
  <template>
    <nav class="navbar navbar-expand-lg navbar-light bg-light shadow-sm">
      <div class="container">
        <a class="navbar-brand fw-bold d-flex align-items-center" href="#">
          <img src="/hen.png" alt="Logo" width="32" height="32" class="me-2">
          Connecticut Backyard Chickens
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav ms-auto">
            <li class="nav-item">
              <a class="nav-link" href="#about">About</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="#directory">Directory</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="#products">Products</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="#resources">Resources</a>
            </li>
            <li class="nav-item">
              <a class="btn btn-primary ms-2" href="https://www.facebook.com/groups/1465813350383274" target="_blank">
                <i class="bi bi-facebook"></i> Join Our Group
              </a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  
    <section class="featured-partner-section">
      <div class="bg-warning py-2 text-center">
        <div class="container">
          <small class="fw-bold text-dark">
            <i class="bi bi-star-fill me-1"></i>
            Featured Partner: Sample Store Name - It could be you! Email us at
            <a href="mailto:marketing@ctchickens.com" class="text-dark fw-bold">marketing@ctchickens.com</a>
            to get your store featured here.
          </small>
        </div>
      </div>
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
            <a href="https://www.facebook.com/groups/1465813350383274" target="_blank" class="btn btn-primary btn-lg me-2">
              <i class="bi bi-facebook"></i> Join the Facebook Group
            </a>
            <a href="#about" class="btn btn-outline-secondary btn-lg">Learn More</a>
          </div>
        </div>
      </div>
    </section>
  
    <section id="about" class="py-5 bg-light">
      <div class="container">
        <div class="row">
          <div class="col-lg-8 mx-auto text-center">
            <h2 class="display-5 fw-bold mb-4">Why Join Our Community?</h2>
            <p class="lead mb-5">
              <span class="text-primary">Connecticut Backyard Chickens</span> is the go-to community for chicken enthusiasts across the state. Whether you're a beginner or an experienced keeper, you'll find support, advice, and friendship here.
            </p>
          </div>
        </div>
  
        <div class="row g-4">
          <div class="col-md-4">
            <div class="card h-100 border-0 shadow-sm">
              <div class="card-body text-center p-4">
                <div class="feature-icon mb-3">
                  <i class="bi bi-people-fill text-primary"></i>
                </div>
                <h3 class="h4 mb-3">Active Community</h3>
                <p>Connect with thousands of fellow chicken keepers in Connecticut. Get answers to your questions quickly from experienced members.</p>
              </div>
            </div>
          </div>
  
          <div class="col-md-4">
            <div class="card h-100 border-0 shadow-sm">
              <div class="card-body text-center p-4">
                <div class="feature-icon mb-3">
                  <i class="bi bi-lightbulb-fill text-warning"></i>
                </div>
                <h3 class="h4 mb-3">Expert Advice</h3>
                <p>Learn from experienced chicken keepers. Get tips on everything from coop building to health issues and egg production.</p>
              </div>
            </div>
          </div>
  
          <div class="col-md-4">
            <div class="card h-100 border-0 shadow-sm">
              <div class="card-body text-center p-4">
                <div class="feature-icon mb-3">
                  <i class="bi bi-cart-fill text-success"></i>
                </div>
                <h3 class="h4 mb-3">Buy & Sell Locally</h3>
                <p>Find supplies, equipment, and other chicken-related products from local members. Support your local chicken-keeping community.</p>
              </div>
            </div>
          </div>
        </div>
  
        <div class="row mt-5">
          <div class="col-lg-10 mx-auto">
            <div class="card border-0 shadow">
              <div class="card-body p-5">
                <h3 class="h4 mb-4">What Our Members Share:</h3>
                <div class="row">
                  <div class="col-md-6">
                    <ul class="list-unstyled">
                      <li class="mb-2"><i class="bi bi-check-circle-fill text-success me-2"></i>Chicken health and care tips</li>
                      <li class="mb-2"><i class="bi bi-check-circle-fill text-success me-2"></i>Coop designs and building advice</li>
                      <li class="mb-2"><i class="bi bi-check-circle-fill text-success me-2"></i>Breed recommendations</li>
                      <li class="mb-2"><i class="bi bi-check-circle-fill text-success me-2"></i>Predator protection strategies</li>
                    </ul>
                  </div>
                  <div class="col-md-6">
                    <ul class="list-unstyled">
                      <li class="mb-2"><i class="bi bi-check-circle-fill text-success me-2"></i>Connecticut-specific regulations</li>
                      <li class="mb-2"><i class="bi bi-check-circle-fill text-success me-2"></i>Winter care in New England</li>
                      <li class="mb-2"><i class="bi bi-check-circle-fill text-success me-2"></i>Local supplier recommendations</li>
                      <li class="mb-2"><i class="bi bi-check-circle-fill text-success me-2"></i>Funny chicken stories and photos!</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  
    <section id="directory" class="py-5 bg-white">
      <div class="container">
        <div class="row mb-4">
          <div class="col-lg-8 mx-auto text-center">
            <h2 class="display-5 fw-bold text-dark">Local Breeder & Supplier Directory</h2>
            <p class="lead">
              Find local CT breeders for chicks, pullets, and hatching eggs. <br>
              <span class="badge bg-danger">Notice</span> Facebook prohibits live animal sales; all listings are moved here for community safety.
              <span><span class="badge bg-success ms-2">Verified</span> listings confirm the breeder is a known member of our community in good standing.</span>
              <span><span class="badge bg-primary ms-2"><i class="bi bi-star-fill text-warning me-1"></i>Founding Breeder</span> is reserved for verified breeders who were the first 10 on our platform.</span>
            </p>
          </div>
        </div>
        
        <FeaturedBreeder />
        <BreederTable />
      </div>
    </section>
  
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
                <a href="https://www.facebook.com/groups/1465813350383274" target="_blank" class="btn btn-primary btn-lg">
                  <i class="bi bi-facebook"></i> Join Connecticut Backyard Chickens
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  
    <footer class="bg-dark text-light py-4">
      <div class="container">
        <div class="row align-items-center">
          <div class="col-md-4 text-center text-md-start mb-3 mb-md-0">
          </div>
          <div class="col-md-8 text-center text-md-end">
            <div class="d-flex flex-column flex-md-row justify-content-md-end align-items-center gap-3">
              <div class="text-light">
                <i class="bi bi-envelope-fill me-1"></i>
                Contact Admin:
                <a href="mailto:admin@ctchickens.com" class="text-light">admin@ctchickens.com</a>
              </div>
              <span class="d-none d-md-inline text-secondary">|</span>
              <div class="text-light">
                <i class="bi bi-megaphone-fill me-1"></i>
                Marketing:
                <a href="mailto:marketing@ctchickens.com" class="text-light">marketing@ctchickens.com</a>
              </div>
            </div>
          </div>
        </div>
        <hr class="my-3 bg-secondary">
        <div class="row">
          <div class="col text-center">
            <small>&copy; 2025 Connecticut Backyard Chickens. All rights reserved.</small>
          </div>
        </div>
      </div>
    </footer>
  </template>
  
  <style>
  /* Paste your styles.css content here */
  :root {
    --primary-color: #1e3a8a;
    --secondary-color: #b91c1c;
    --accent-color: #f59e0b;
    --text-dark: #1f2937;
    --bg-cream: #fefce8;
  }
  
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
    color: var(--text-dark);
  }
  
  /* Navbar Styles */
  .navbar {
    padding: 1rem 0;
  }
  
  .navbar-brand {
    font-size: 1.5rem;
    color: var(--primary-color) !important;
  }
  
  .navbar-brand i {
    font-size: 1.75rem;
    vertical-align: middle;
  }
  
  /* Hero Section */
  .hero-section {
    background-image: url('/ct_backyard_chickens_2025.jpg'); /* Note the leading slash for public assets */
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    padding: 8rem 0;
    position: relative;
    overflow: hidden;
    min-height: 500px;
  }
  
  .hero-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(254, 252, 232, 0.85);
    background: linear-gradient(135deg, rgba(254, 252, 232, 0.9) 0%, rgba(254, 243, 199, 0.85) 100%);
    pointer-events: none;
  }
  
  .hero-section .container {
    z-index: 1;
  }
  
  .hero-section h1 {
    color: var(--primary-color);
    text-shadow: 2px 2px 4px rgba(255, 255, 255, 0.8);
  }
  
  .hero-section .lead {
    text-shadow: 1px 1px 2px rgba(255, 255, 255, 0.8);
  }
  
  /* Feature Cards */
  .feature-icon i {
    font-size: 3rem;
  }
  
  .card {
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }
  
  .card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15) !important;
  }
  
  /* Product Cards */
  .product-card {
    transition: all 0.3s ease;
  }
  
  .product-card:hover {
    transform: translateY(-8px);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2) !important;
  }
  
  .product-icon i {
    font-size: 3rem;
    color: var(--accent-color);
  }
  
  .product-card .btn-sm {
    display: block;
    width: 100%;
    margin-bottom: 0.5rem;
  }
  
  /* Resources Section */
  #resources a:not(.btn) {
    color: var(--primary-color);
    transition: color 0.2s ease;
  }
  
  #resources a:not(.btn):hover {
    color: var(--secondary-color);
  }
  
  /* Buttons */
  .btn-primary {
    background-color: var(--primary-color);
    border-color: var(--primary-color);
    transition: all 0.3s ease;
  }
  
  .btn-primary:hover {
    background-color: #1e40af;
    border-color: #1e40af;
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(30, 58, 138, 0.3);
  }
  
  .btn-outline-primary {
    color: var(--primary-color);
    border-color: var(--primary-color);
    transition: all 0.3s ease;
  }
  
  .btn-outline-primary:hover {
    background-color: var(--primary-color);
    border-color: var(--primary-color);
    transform: translateY(-2px);
  }
  
  /* Smooth Scrolling */
  html {
    scroll-behavior: smooth;
  }
  
  /* Section Spacing */
  section {
    scroll-margin-top: 70px;
  }
  
  /* Footer */
  footer a {
    transition: all 0.3s ease;
  }
  
  footer a:hover {
    transform: translateY(-2px);
  }
  
  footer a.text-light:hover {
    color: var(--accent-color) !important;
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .hero-section {
      padding: 3rem 0;
    }
  
    .hero-logo {
      max-width: 100%;
    }
  
    .display-4 {
      font-size: 2rem;
    }
  
    .display-5 {
      font-size: 1.75rem;
    }
  
    /* Mobile-friendly table */
    .table {
      font-size: 0.85rem;
    }
  
    .table td {
      padding: 0.5rem 0.25rem;
    }
  
    .table th {
      padding: 0.75rem 0.25rem;
      font-size: 0.8rem;
    }
  
    .badge {
      font-size: 0.6rem !important;
    }
  
    .btn-sm {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
    }
  
    .breeds-row td {
      padding: 0.5rem !important;
      font-size: 0.8rem !important;
    }
  }
  
  /* Utility Classes */
  .shadow-sm {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important;
  }
  
  .shadow {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
  }
  
  /* Animation for cards */
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .card {
    animation: fadeInUp 0.6s ease-out;
  }
  </style>