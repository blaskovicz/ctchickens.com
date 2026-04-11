<template>
  <div class="container py-5 mt-4">
    <div class="row">
      <div class="col-lg-8 mx-auto">
        <div class="mb-5">
          <h1 class="mb-4 fw-bold">Terms of Service</h1>
          <p class="text-muted small mb-4 text-uppercase">Effective Date: April 3, 2026</p>

          <section class="mb-5">
            <h3>1. ACCEPTANCE OF TERMS</h3>
            <p>
              By accessing and using ctchickens.com ("the Site"), you agree to be bound by these Terms of Service. These Terms constitute a legally binding agreement between you and Zachary Joseph Auclair ("the Owner"). <strong>IF YOU DO NOT AGREE TO THESE TERMS, DO NOT USE THE SITE.</strong>
            </p>
          </section>

          <section class="mb-5">
            <h3>2. DIRECTORY LISTINGS AND "VERIFIED" STATUS</h3>
            <p>
              The Site provides a directory of third-party breeders and suppliers. 
              <strong>"Verified"</strong> listings confirm the breeder is a known member of our community in good standing. This "Verified" status is for community identification purposes only and <strong>DOES NOT</strong> constitute an endorsement, inspection, or guarantee of the breeder's business practices, livestock health, or egg quality.
            </p>
          </section>

          <section class="mb-5">
            <h3>3. NO WARRANTY AND "AS-IS" SERVICE</h3>
            <p class="text-uppercase fw-bold border p-3 bg-light">
              THE SITE AND ALL CONTENT, LISTINGS, AND SERVICES PROVIDED THROUGH THE SITE ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. THE OWNER DISCLAIMS ALL WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. THE OWNER MAKES NO WARRANTY AS TO THE QUALITY, HEALTH, OR SAFETY OF ANY LIVESTOCK (INCLUDING EGGS, CHICKS, OR ADULT BIRDS) OR PRODUCTS PURCHASED FROM THIRD-PARTY VENDORS LISTED ON THE SITE.
            </p>
          </section>

          <section class="mb-5">
            <h3>3. LIMITATION OF LIABILITY</h3>
            <p class="text-uppercase fw-bold border p-3 bg-light">
              IN NO EVENT SHALL THE OWNER BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO DAMAGES FOR LOSS OF PROFITS, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM YOUR USE OF THE SITE OR YOUR TRANSACTIONS WITH THIRD-PARTY BREEDERS OR SUPPLIERS. THE OWNER'S TOTAL LIABILITY TO YOU FOR ALL CLAIMS SHALL NOT EXCEED $100.00 USD.
            </p>
          </section>

          <section class="mb-5">
            <h3>4. BINDING ARBITRATION AND CLASS ACTION WAIVER</h3>
            <p>
              <strong>PLEASE READ THIS SECTION CAREFULLY. IT AFFECTS YOUR LEGAL RIGHTS.</strong>
            </p>
            <p>
              Any dispute, claim, or controversy arising out of or relating to these Terms or the Site shall be settled by <strong>BINDING ARBITRATION</strong> administered by the American Arbitration Association (AAA) in accordance with its Consumer Arbitration Rules. 
            </p>
            <ul>
              <li><strong>WAIVER OF JURY TRIAL:</strong> You and the Owner waive the right to a trial by jury or to participate in a class action.</li>
              <li><strong>NO CLASS ACTIONS:</strong> All claims must be brought in the parties' individual capacity, and not as a plaintiff or class member in any purported class or representative proceeding.</li>
              <li><strong>LOCATION:</strong> The arbitration shall take place in Fairfield County, Connecticut, unless otherwise agreed.</li>
            </ul>
          </section>

          <section class="mb-5">
            <h3>5. INDEMNIFICATION</h3>
            <p>
              You agree to indemnify, defend, and hold harmless the Owner from and against any and all claims, damages, obligations, losses, liabilities, costs, or debt, and expenses (including but not limited to attorney's fees) arising from your use of the Site or your violation of these Terms.
            </p>
          </section>

          <section class="mb-5">
            <h3>6. GOVERNING LAW</h3>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State of Connecticut, without regard to its conflict of law provisions.
            </p>
          </section>
        </div>

        <hr class="my-5">

        <div>
          <h1 class="mb-4 fw-bold">Privacy Policy</h1>
          <p class="text-muted small mb-4 text-uppercase">Effective Date: April 3, 2026</p>

          <section class="mb-5">
            <h3>Data Collection and Usage</h3>
            <p>We use Facebook Login to simplify authentication. When you log in, we collect your <strong>Public Profile Information</strong> (Name, Picture) and <strong>Email Address</strong>. We do not sell your data. Data is stored securely via Firebase (Google Cloud).</p>
          </section>

          <section class="mb-5" id="data-deletion">
            <h3>Data Deletion</h3>
            <p>
              To delete your data, remove the app via your Facebook "Apps and Websites" settings or email 
              <a href="mailto:admin@ctchickens.com">admin@ctchickens.com</a>.
            </p>
          </section>

          <section class="mb-5">
            <h3>Contact</h3>
            <p>
              Questions? Email <a href="mailto:admin@ctchickens.com">admin@ctchickens.com</a> or <a href="#" @click.prevent="contactSupport">message us</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSupport } from '../composables/useSupport';

const { contactSupport } = useSupport();
</script>

<style scoped>
h3 {
  font-weight: 700;
  margin-top: 2rem;
  margin-bottom: 1rem;
}
p, li {
  line-height: 1.6;
  color: #4b5563;
}
.border {
  border-left: 4px solid var(--primary-color) !important;
}
</style>
