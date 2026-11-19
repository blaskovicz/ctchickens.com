/**
 * Posts "this week's Featured Member" to the CT Chickens Facebook Page every
 * Monday morning. Card rendering, breeder selection, and the Graph API call
 * all live in featuredCard.cjs (a copy of scripts/lib/featured-card.cjs —
 * see the prebuild script in package.json; edit the source file, not this
 * generated copy).
 *
 * Facebook has no API for posting or sharing into a Group (Meta removed
 * publish_to_groups in April 2024), so sharing the Page post into the
 * Connecticut Backyard Chickens group stays a manual step — this function
 * emails admin@ctchickens.com the checklist for that after each post.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';
import { Resvg } from '@resvg/resvg-js';
import { Resend } from 'resend';
import * as FeaturedCard from './featuredCard.cjs';
import { renderTemplate, sendGenericEmail } from './emailHelpers';

const facebookPageSystemToken = defineSecret('FACEBOOK_PAGE_SYSTEM_TOKEN');
const resendApiKeyForFeaturedPost = defineSecret('RESEND_API_KEY');

export const postWeeklyFeaturedMember = onSchedule(
  {
    schedule: '30 9 * * 1',
    timeZone: 'America/New_York',
    secrets: [facebookPageSystemToken, resendApiKeyForFeaturedPost],
    memory: '512MiB',
    timeoutSeconds: 120,
  },
  async () => {
    const db = getFirestore();

    // orderBy must match fetchDirectory's query (src/store/index.ts) exactly
    // — the rotation index depends on the pool being in the same order the
    // live site uses, otherwise it picks a different member than what's
    // actually shown as Featured on the site.
    const snap = await db
      .collection('directory_members')
      .where('account.status', '==', 'published')
      .orderBy('account.updatedAt', 'desc')
      .get();
    const breeders = snap.docs.map((d) => FeaturedCard.mapMemberToBreeder(d.data(), d.id));
    if (breeders.length === 0) {
      console.error('[postWeeklyFeaturedMember] No published breeders found in directory_members.');
      return;
    }

    const featured = FeaturedCard.pickFeatured(breeders, null);
    if (!featured) {
      console.error('[postWeeklyFeaturedMember] Could not pick a featured breeder.');
      return;
    }
    console.log(`[postWeeklyFeaturedMember] Featured: ${featured.name} (${featured.id})`);

    const logoDataUri = await FeaturedCard.fetchImageAsDataUri(
      featured.logo || `${FeaturedCard.SITE_URL}/hen.png`,
      `${FeaturedCard.SITE_URL}/hen.png`
    );

    const svg = FeaturedCard.buildSvg({
      name: featured.name,
      location: featured.location,
      category: featured.category,
      blurb: (featured.selling || '').replace(/\s+/g, ' ').trim(),
      logoDataUri,
      verified: featured.verified,
      foundingMember: featured.founding_breeder,
      profilePath: featured.id,
    });

    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 2400 } });
    const png = resvg.render().asPng();

    const caption = FeaturedCard.buildCaption(featured);
    const result = await FeaturedCard.postFeaturedPhoto(png, caption, facebookPageSystemToken.value());
    console.log(`[postWeeklyFeaturedMember] Posted -> ${result.permalink_url}`);

    const resend = new Resend(resendApiKeyForFeaturedPost.value());
    const subject = `Featured Member posted: ${featured.name}`;
    await sendGenericEmail(resend, {
      from: 'CT Chickens <admin@ctchickens.com>',
      to: 'admin@ctchickens.com',
      subject,
      html: renderTemplate('weekly-feature-posted-body.html', {
        subject,
        featuredName: featured.name,
        postUrl: result.permalink_url,
      }),
    });
  }
);
