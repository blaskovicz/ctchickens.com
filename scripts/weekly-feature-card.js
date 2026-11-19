/**
 * weekly-feature-card.js
 *
 * Builds this week's "Featured Member" Facebook post locally: picks the
 * featured breeder using the same weekly rotation as the featuredBreeder
 * Vuex getter (src/store/index.ts), renders a brand-matched share card PNG,
 * and prints the caption that would go with it. Card/caption/posting logic
 * lives in scripts/lib/featured-card.cjs, shared with the
 * weeklyFeaturedPost Cloud Function — edit that file, not this one, for
 * layout/copy changes.
 *
 * Does NOT post to Facebook unless --post is passed. Posting uses the Page
 * system-user token at ~/.facebook/token.txt.
 *
 * Usage (run from the repo root):
 *   node scripts/weekly-feature-card.js                  # dry run: writes PNG + prints caption
 *   node scripts/weekly-feature-card.js --slug <slug>     # force a specific breeder
 *   node scripts/weekly-feature-card.js --post            # also posts to the Page
 *
 * Auth: uses Application Default Credentials for Firestore (same as the
 * other scripts/ in this repo) — run `firebase login` and
 * `gcloud auth application-default login` first if you haven't.
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  SITE_URL,
  FONT_FILES,
  mapMemberToBreeder,
  pickFeatured,
  fetchImageAsDataUri,
  buildSvg,
  buildCaption,
  postFeaturedPhoto,
} from './lib/featured-card.cjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const SHOULD_POST = args.includes('--post');
function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}
const FORCE_SLUG = getArg('--slug');

if (!getApps().length) {
  initializeApp({ projectId: 'ct-chickens' });
}
const db = getFirestore();

async function main() {
  console.log(FORCE_SLUG ? `Using forced slug: ${FORCE_SLUG}` : "Picking this week's featured breeder...");

  // orderBy must match fetchDirectory's query (src/store/index.ts) exactly —
  // the rotation index depends on the pool being in the same order the live
  // site uses, otherwise it picks a different breeder than what's actually
  // shown as Featured on the site right now.
  const snap = await db
    .collection('directory_members')
    .where('account.status', '==', 'published')
    .orderBy('account.updatedAt', 'desc')
    .get();
  const breeders = snap.docs.map((d) => mapMemberToBreeder(d.data(), d.id));
  if (breeders.length === 0) {
    console.error('No published breeders found in directory_members.');
    process.exit(1);
  }

  const featured = pickFeatured(breeders, FORCE_SLUG);
  if (!featured) {
    console.error(FORCE_SLUG ? `No published breeder with slug "${FORCE_SLUG}".` : 'Could not pick a featured breeder.');
    process.exit(1);
  }

  console.log(`Featured: ${featured.name} (${featured.id})`);

  const logoDataUri = await fetchImageAsDataUri(featured.logo || `${SITE_URL}/hen.png`, `${SITE_URL}/hen.png`);

  const svg = buildSvg({
    name: featured.name,
    location: featured.location,
    category: featured.category,
    blurb: (featured.selling || '').replace(/\s+/g, ' ').trim(),
    logoDataUri,
    verified: featured.verified,
    foundingMember: featured.founding_breeder,
    profilePath: featured.id,
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 2400 },
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Roboto' },
  });
  const png = resvg.render().asPng();

  const outDir = path.join(__dirname, '..', 'tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `featured-${featured.id}-${new Date().toISOString().slice(0, 10)}.png`);
  fs.writeFileSync(outFile, png);
  console.log(`\nCard saved -> ${outFile}`);

  const caption = buildCaption(featured);
  console.log('\n--- Caption ---');
  console.log(caption);
  console.log('---------------');

  if (!SHOULD_POST) {
    console.log('\nDry run only — nothing was sent to Facebook. Pass --post to publish to the Page.');
    return;
  }

  console.log('\nPosting to the Facebook Page...');
  const tokenPath = path.join(os.homedir(), '.facebook', 'token.txt');
  const systemToken = fs.readFileSync(tokenPath, 'utf8').trim();
  const result = await postFeaturedPhoto(png, caption, systemToken);
  console.log(`Posted! ${result.permalink_url || `post_id: ${result.id}`}`);

  console.log(`
Next (manual — Facebook has no API for any of this on a Group):
  1. Open the Connecticut Backyard Chickens group and unpin last week's featured-member post.
  2. Open the new Page post above -> Share -> Share to a Group -> Connecticut Backyard Chickens.
  3. In the group share, optionally @mention the owner or the farm's own Page, if they're a group member.
  4. Pin the new shared post in the group.
`);
}

main().catch((e) => {
  console.error('Failed:', e);
  process.exit(1);
});
