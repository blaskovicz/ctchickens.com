import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { Resend } from 'resend';

initializeApp();
const db = getFirestore();
const resendApiKey = defineSecret('RESEND_API_KEY');

const layoutSource = fs.readFileSync(path.join(__dirname, '../templates/_layout.html'), 'utf-8');
const layoutTemplate = Handlebars.compile(layoutSource);

const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';

function renderTemplate(bodyName: string, vars: Record<string, unknown> & { subject: string }): string {
  const bodySource = fs.readFileSync(path.join(__dirname, '../templates', bodyName), 'utf-8');
  const body = Handlebars.compile(bodySource)(vars);
  return layoutTemplate({ ...vars, body });
}

// Self-heals a missing users doc when a draft_profiles document is created.
// Guards against getRedirectResult failing silently on the client.
export const onDraftProfileCreated = onDocumentCreated(
  { document: 'draft_profiles/{slug}' },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const ownerUid = data.draft_owner_uid as string | undefined;
    if (!ownerUid) {
      console.error('[onDraftProfileCreated] Missing draft_owner_uid', { slug: event.params.slug });
      return;
    }

    const userRef = db.collection('users').doc(ownerUid);
    const userSnap = await userRef.get();
    if (userSnap.exists) return; // users doc already exists, nothing to do

    // users doc is missing — pull data from Auth and create it
    console.error('[onDraftProfileCreated] Missing users doc detected', {
      slug: event.params.slug,
      ownerUid,
    });

    try {
      const authUser = await getAuth().getUser(ownerUid);
      await userRef.set({
        displayName: authUser.displayName ?? null,
        email: authUser.email ?? null,
        photoURL: authUser.photoURL ?? null,
        lastLogin: FieldValue.serverTimestamp(),
      }, { merge: true });
      console.log('[onDraftProfileCreated] users doc created for uid', ownerUid);
    } catch (e) {
      console.error('[onDraftProfileCreated] Failed to create users doc', { ownerUid, error: e });
    }
  }
);

// Sends a welcome email when a new user document is created (first FB OAuth login)
export const onUserCreated = onDocumentCreated(
  { document: 'users/{uid}', secrets: [resendApiKey] },
  async (event) => {
    const data = event.data?.data();
    if (!data?.email) {
      console.log('No email on user doc, skipping welcome email');
      return;
    }

    const firstName = (data.displayName as string)?.split(' ')[0] || 'there';

    if (IS_EMULATOR) {
      console.log(`[emulator] Skipping welcome email to ${data.email}`);
      return;
    }

    const resend = new Resend(resendApiKey.value());

    try {
      await resend.emails.send({
        from: 'CT Chickens <noreply@ctchickens.com>',
        to: data.email as string,
        subject: `Welcome to CT Chickens, ${firstName}!`,
        html: renderTemplate('welcome-body.html', { subject: `Welcome to CT Chickens, ${firstName}!`, firstName }),
      });
      console.log(`Welcome email sent to ${data.email}`);
    } catch (err) {
      console.error('Failed to send welcome email:', err);
    }
  }
);

// Sends a "farm is live" email when a new draft_profile_history doc is created with status 'published'
export const onDraftProfilePublished = onDocumentCreated(
  { document: 'draft_profile_history/{historyId}', secrets: [resendApiKey] },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    // Only fire for published history records
    if (data.draft_meta?.status !== 'published') return;

    const ownerUid = data.draft_meta?.draft_owner_id as string | undefined;
    if (!ownerUid) {
      console.log('No draft_owner_id in history doc, skipping approval email');
      return;
    }

    const slug = data.slug as string;

    let userEmail: string | undefined;
    let displayName: string | undefined;
    try {
      const userDoc = await db.collection('users').doc(ownerUid).get();
      if (!userDoc.exists) {
        console.log(`User doc not found for uid ${ownerUid}`);
        return;
      }
      userEmail = userDoc.data()?.email as string | undefined;
      displayName = userDoc.data()?.displayName as string | undefined;
    } catch (err) {
      console.error('Failed to fetch user doc:', err);
      return;
    }

    if (!userEmail) {
      console.log(`No email for owner uid ${ownerUid}, skipping approval email`);
      return;
    }

    const firstName = displayName?.split(' ')[0] || 'there';
    const businessName = (data.snapshot?.profile?.businessName as string) || 'Your farm';
    const profileUrl = `https://ctchickens.com/#/directory/${slug}`;

    // Check verified status from the live listing
    let isVerified = false;
    try {
      const liveDoc = await db.collection('directory_members').doc(slug).get();
      isVerified = liveDoc.data()?.account?.isVerified === true;
    } catch (err) {
      console.error('Failed to fetch live doc for verified status:', err);
    }

    // Count prior published history docs to distinguish first publish from edits
    let isFirstPublish = true;
    try {
      const historySnap = await db.collection('draft_profile_history')
        .where('slug', '==', slug)
        .where('draft_meta.status', '==', 'published')
        .get();
      isFirstPublish = historySnap.size <= 1;
    } catch (err) {
      console.error('Failed to fetch history count:', err);
    }

    const subject = isFirstPublish ? 'Your farm is live on CT Chickens!' : 'Your updates are live on CT Chickens!';

    if (IS_EMULATOR) {
      console.log(`[emulator] Skipping approval email to ${userEmail} for slug ${slug}`);
      return;
    }

    const resend = new Resend(resendApiKey.value());

    try {
      await resend.emails.send({
        from: 'CT Chickens <noreply@ctchickens.com>',
        to: userEmail,
        subject,
        html: renderTemplate('approval-body.html', { subject, firstName, businessName, profileUrl, isVerified, isFirstPublish }),
      });
      console.log(`Approval email sent to ${userEmail} for slug ${slug}`);
    } catch (err) {
      console.error('Failed to send approval email:', err);
    }
  }
);
