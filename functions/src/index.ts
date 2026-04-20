import * as crypto from 'crypto';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { Resend } from 'resend';
import {
  sendWelcomeEmail,
  sendApprovalEmail,
  sendClaimReminderEmail,
  sendVerificationNudgeEmail,
  sendAnnouncementEmail,
  sendVerificationEmail,
  sendLocalEmailSetNotification,
  sendAdminDraftReviewEmail,
  sendClaimApprovedEmail,
  sendInquiryBuyerEmail,
  sendInquirySellerEmail,
  sendInquiryAdminUnclaimedEmail,
  sendSupportThreadUserEmail,
  sendSupportThreadAdminEmail,
  formatDisplayName,
} from './emailHelpers';

initializeApp();
const db = getFirestore();
const resendApiKey = defineSecret('RESEND_API_KEY');
const hmacSecret = defineSecret('HMAC_SECRET');

function resolveEmail(userData: FirebaseFirestore.DocumentData): string | null {
  if (userData.localEmail) return userData.localEmail;
  return userData.email ?? null;
}


// Self-heals a missing users doc when a draft_profiles document is created.
// Guards against getRedirectResult failing silently on the client.
async function healUserProfileIfRequired(
  slug: string,
  ownerUid: string
): Promise<FirebaseFirestore.DocumentSnapshot | null> {
  const userRef = db.collection('users').doc(ownerUid);
  const userSnap = await userRef.get();
  if (userSnap.exists) return userSnap;

  // users doc is missing — pull data from Auth and create it
  console.error('[healUserProfileIfRequired] Missing users doc detected', { slug, ownerUid });
  try {
    const authUser = await getAuth().getUser(ownerUid);
    await userRef.set({
      displayName: authUser.displayName ?? null,
      email: authUser.email ?? null,
      photoURL: authUser.photoURL ?? null,
      lastLogin: FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log('[healUserProfileIfRequired] users doc created for uid', ownerUid);
    return await userRef.get();
  } catch (e) {
    console.error('[healUserProfileIfRequired] Failed to create users doc', { ownerUid, error: e });
    return null;
  }
}

// Emails admins when a new draft profile is submitted for review.
async function emailAdminsNewDraftIfRequired(
  slug: string,
  draftData: FirebaseFirestore.DocumentData,
  userSnap: FirebaseFirestore.DocumentSnapshot | null,
  resend: InstanceType<typeof Resend>
): Promise<void> {
  const businessName = (draftData.profile?.businessName as string) || slug;
  const town = (draftData.profile?.town as string) || 'Unknown';
  const memberType = (draftData.profile?.memberType as string) || 'breeder';
  const ownerName = (userSnap?.data()?.displayName as string) || 'Unknown';
  const reviewUrl = `https://ctchickens.com/#/directory/${slug}/edit`;

  try {
    await sendAdminDraftReviewEmail(
      'admin@ctchickens.com',
      { businessName, ownerName, town, memberType, reviewUrl },
      resend
    );
    console.log(`[emailAdminsNewDraftIfRequired] Admin review email sent for slug ${slug}`);
  } catch (err) {
    console.error('[emailAdminsNewDraftIfRequired] Failed to send admin review email', { slug, err });
  }
}

export const onDraftProfileCreated = onDocumentCreated(
  { document: 'draft_profiles/{slug}', secrets: [resendApiKey] },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const slug = event.params.slug;
    const ownerUid = data.draft_owner_uid as string | undefined;
    if (!ownerUid) {
      console.error('[onDraftProfileCreated] Missing draft_owner_uid', { slug });
      return;
    }

    const resend = new Resend(resendApiKey.value());
    const userSnap = await healUserProfileIfRequired(slug, ownerUid);
    await emailAdminsNewDraftIfRequired(slug, data, userSnap, resend);
  }
);

// Sends a welcome email when a new user document is created (first FB OAuth login)
export const onUserCreated = onDocumentCreated(
  { document: 'users/{uid}', secrets: [resendApiKey] },
  async (event) => {
    const data = event.data?.data();
    if (!data) {
      console.log('No data on user doc, skipping welcome email');
      return;
    }

    const displayName = (data.displayName as string) || '';
    const effectiveEmail = resolveEmail(data);

    if (!effectiveEmail) {
      console.log('No effective email on user doc, skipping welcome email');
      return;
    }

    const resend = new Resend(resendApiKey.value());
    try {
      await sendWelcomeEmail(effectiveEmail, displayName, resend);
      console.log(`Welcome email sent to ${effectiveEmail}`);
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

    let userEmail: string | null = null;
    let displayName: string | undefined;
    try {
      const userDoc = await db.collection('users').doc(ownerUid).get();
      if (!userDoc.exists) {
        console.log(`User doc not found for uid ${ownerUid}`);
        return;
      }
      userEmail = resolveEmail(userDoc.data()!);
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

    const resend = new Resend(resendApiKey.value());
    try {
      await sendApprovalEmail(userEmail, { firstName, businessName, profileUrl, isVerified, isFirstPublish }, resend);
      console.log(`Approval email sent to ${userEmail} for slug ${slug}`);
    } catch (err) {
      console.error('Failed to send approval email:', err);
    }
  }
);

// Admin callable: send bulk emails to users and/or farms
type Recipient =
  | { type: 'user'; uid: string }
  | { type: 'farm'; slug: string };

interface AdminSendEmailPayload {
  recipients: Recipient[];
  template: 'welcome' | 'claim-reminder' | 'verification-nudge' | 'announcement';
  subject: string;
  customBodyHtml?: string;
}

export const adminSendEmail = onCall(
  { secrets: [resendApiKey] },
  async (request) => {
    // Verify caller is authenticated
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in.');
    }

    // Verify caller is admin
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (callerDoc.data()?.isAdmin !== true) {
      throw new HttpsError('permission-denied', 'Admin access required.');
    }

    const { recipients, template, subject, customBodyHtml } = request.data as AdminSendEmailPayload;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      throw new HttpsError('invalid-argument', 'recipients must be a non-empty array.');
    }
    if (!template) {
      throw new HttpsError('invalid-argument', 'template is required.');
    }
    if (!subject) {
      throw new HttpsError('invalid-argument', 'subject is required.');
    }

    let sent = 0;
    let skipped = 0;

    const resend = new Resend(resendApiKey.value());

    for (const recipient of recipients) {
      let email: string | undefined;
      let firstName = 'there';
      let businessName = '';

      try {
        if (recipient.type === 'user') {
          const userDoc = await db.collection('users').doc(recipient.uid).get();
          if (!userDoc.exists) {
            console.log(`[adminSendEmail] Skipping user ${recipient.uid}: doc not found`);
            skipped++;
            continue;
          }
          const userData = userDoc.data()!;
          email = resolveEmail(userData) ?? undefined;
          const displayName = (userData.displayName as string) || '';
          firstName = displayName.split(' ')[0] || 'there';
          businessName = displayName;
        } else if (recipient.type === 'farm') {
          const farmDoc = await db.collection('directory_members').doc(recipient.slug).get();
          if (!farmDoc.exists) {
            console.log(`[adminSendEmail] Skipping farm ${recipient.slug}: doc not found`);
            skipped++;
            continue;
          }
          const farmData = farmDoc.data()!;
          businessName = farmData.profile?.businessName || recipient.slug;
          firstName = businessName.split(' ')[0] || 'there';

          const ownerUid = farmData.account?.ownerUid as string | null;
          if (ownerUid) {
            const ownerDoc = await db.collection('users').doc(ownerUid).get();
            if (ownerDoc.exists) {
              const ownerData = ownerDoc.data()!;
              email = resolveEmail(ownerData) ?? undefined;
              const displayName = (ownerData.displayName as string) || '';
              firstName = displayName.split(' ')[0] || firstName;
            }
          }
          // Fall back to contactEmail if no owner email
          if (!email) {
            email = farmData.profile?.contactEmail as string | undefined;
          }
        }

        if (!email) {
          console.log(`[adminSendEmail] Skipping recipient: no email resolved`, recipient);
          skipped++;
          continue;
        }

        const farmSlug = recipient.type === 'farm' ? recipient.slug : '';

        if (template === 'welcome') {
          await sendWelcomeEmail(email, firstName, resend);
        } else if (template === 'claim-reminder') {
          await sendClaimReminderEmail(email, { firstName, businessName, slug: farmSlug }, resend);
        } else if (template === 'verification-nudge') {
          await sendVerificationNudgeEmail(email, { firstName, businessName, slug: farmSlug }, resend);
        } else if (template === 'announcement') {
          await sendAnnouncementEmail(email, {
            firstName,
            businessName,
            subject,
            customBody: customBodyHtml || '',
          }, resend);
        }

        console.log(`[adminSendEmail] Sent ${template} to ${email}`);
        sent++;
      } catch (err) {
        console.error(`[adminSendEmail] Failed to send to recipient`, { recipient, err });
        skipped++;
      }
    }

    return { sent, skipped };
  }
);

// Sets or clears a user's local notification email.
// Empty string → clears both pendingLocalEmail and localEmail.
// Valid email → writes pendingLocalEmail and sends a verification email.
export const setLocalEmail = onCall(
  { secrets: [resendApiKey, hmacSecret] },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Must be signed in.');
    }

    const { email } = request.data as { email: string };

    if (email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpsError('invalid-argument', 'Invalid email address.');
    }

    const uid = request.auth.uid;
    const userRef = db.collection('users').doc(uid);

    if (!email) {
      await userRef.update({
        pendingLocalEmail: FieldValue.delete(),
        localEmail: FieldValue.delete(),
      });
      console.log(`localEmail cleared for uid ${uid}`);
      return { ok: true, action: 'cleared' };
    }

    const userDoc = await userRef.get();
    const firstName = (userDoc.data()?.displayName as string || '').split(' ')[0] || 'there';

    const ts = String(Date.now());
    const token = crypto
      .createHmac('sha256', hmacSecret.value())
      .update(`${uid}:${email}:${ts}`)
      .digest('hex');

    const verifyUrl = `https://ctchickens.com/#/verify-email?uid=${uid}&email=${encodeURIComponent(email)}&ts=${ts}&token=${token}`;

    const resend = new Resend(resendApiKey.value());
    await sendVerificationEmail(email, { firstName, verifyUrl }, resend);

    await userRef.update({ pendingLocalEmail: email });
    console.log(`Verification email sent to ${email} for uid ${uid}`);

    return { ok: true, action: 'verification_sent' };
  }
);

async function notifyLocalEmailUpdated(
  uid: string,
  newEmail: string,
  userData: FirebaseFirestore.DocumentData | undefined
): Promise<void> {
  try {
    const firstName = (userData?.displayName as string | undefined)?.split(' ')[0] || 'there';
    const resend = new Resend(resendApiKey.value());

    await sendLocalEmailSetNotification(newEmail, { firstName, localEmail: newEmail }, resend);

    const oldLocalEmail = userData?.localEmail as string | undefined;
    const authUser = await getAuth().getUser(uid);
    const previousEmail = oldLocalEmail || authUser.email;
    if (previousEmail && previousEmail !== newEmail) {
      await sendLocalEmailSetNotification(previousEmail, { firstName, localEmail: newEmail }, resend);
    }
  } catch (err) {
    console.error('Failed to send localEmail set notification:', err);
  }
}

// Verifies the token from the email link and marks localEmailVerified = true.
// Does NOT require auth — uid comes from the URL params.
export const verifyLocalEmail = onCall(
  { secrets: [hmacSecret, resendApiKey] },
  async (request) => {
    const { uid, email, ts, token } = request.data as {
      uid: string;
      email: string;
      ts: string;
      token: string;
    };

    if (!uid || !email || !ts || !token) {
      throw new HttpsError('invalid-argument', 'uid, email, ts, and token are all required.');
    }

    const tsNum = parseInt(ts, 10);
    if (!Number.isFinite(tsNum) || tsNum <= 0 || Date.now() - tsNum > 3_600_000) {
      throw new HttpsError('deadline-exceeded', 'Verification link has expired. Please request a new one.');
    }

    // Re-derive and constant-time compare
    const expected = crypto
      .createHmac('sha256', hmacSecret.value())
      .update(`${uid}:${email}:${ts}`)
      .digest('hex');

    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(token);
    if (
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw new HttpsError('unauthenticated', 'Invalid or tampered verification token.');
    }

    // Confirm the email matches what we stored
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'User not found.');
    }

    const pending = userSnap.data()?.pendingLocalEmail as string | undefined;
    if (pending !== email) {
      throw new HttpsError('failed-precondition', 'Email address does not match the pending verification.');
    }

    await userRef.update({ localEmail: email, pendingLocalEmail: FieldValue.delete() });
    console.log(`localEmail verified for uid ${uid}: ${email}`);

    await notifyLocalEmailUpdated(uid, email, userSnap.data());

    return { ok: true };
  }
);

// Fires when a directory_members doc is updated. Detects the moment a claim is approved
// by checking if ownerUid just changed from null/missing to a real UID, then emails the
// new owner. Ignores all other updates (profile edits, status changes, etc.).
export const onDirectoryMemberUpdated = onDocumentUpdated(
  { document: 'directory_members/{slug}', secrets: [resendApiKey] },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const ownerBefore = before.account?.ownerUid as string | null | undefined;
    const ownerAfter = after.account?.ownerUid as string | null | undefined;

    // Only proceed if this update is a claim approval: null → real UID
    if (ownerBefore || !ownerAfter) return;

    const slug = event.params.slug;
    const businessName = (after.profile?.businessName as string) || slug;
    const profileUrl = `https://ctchickens.com/#/directory/${slug}`;
    const editUrl = `https://ctchickens.com/#/directory/${slug}/edit`;

    let ownerEmail: string | null = null;
    let firstName = 'there';
    try {
      const ownerDoc = await db.collection('users').doc(ownerAfter).get();
      if (ownerDoc.exists) {
        ownerEmail = resolveEmail(ownerDoc.data()!);
        firstName = (ownerDoc.data()?.displayName as string || '').split(' ')[0] || firstName;
      }
    } catch (err) {
      console.error('[onDirectoryMemberUpdated] Failed to fetch new owner doc', { ownerAfter, err });
    }

    if (!ownerEmail) {
      console.log(`[onDirectoryMemberUpdated] No email for new owner ${ownerAfter}, skipping claim approval email`);
      return;
    }

    const resend = new Resend(resendApiKey.value());
    try {
      await sendClaimApprovedEmail(ownerEmail, { firstName, businessName, profileUrl, editUrl }, resend);
      console.log(`[onDirectoryMemberUpdated] Claim approved email sent to ${ownerEmail} for slug ${slug}`);
    } catch (err) {
      console.error('[onDirectoryMemberUpdated] Failed to send claim approved email', { ownerEmail, slug, err });
    }
  }
);

// Sends email notifications when an inquiry_thread is created for the first time.
// onDocumentCreated fires exactly once per document, so this naturally handles "first contact only".
//
// inquiry type  → email buyer + email seller (or admins if listing is unclaimed)
// support type  → email the user + email admin@ctchickens.com
export const onInquiryThreadCreated = onDocumentCreated(
  { document: 'inquiry_threads/{threadId}', secrets: [resendApiKey] },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const threadId = event.params.threadId;
    const type = data.type as string | undefined;
    const userUid = data.userUid as string;
    const userName = (data.userName as string) || '';
    const inboxUrl = `https://ctchickens.com/#/inbox/${threadId}`;
    const resend = new Resend(resendApiKey.value());

    if (type === 'support') {
      const senderName = formatDisplayName(userName);

      // Look up user's email and first name
      let userEmail: string | null = null;
      let firstName = userName.split(' ')[0] || 'there';
      try {
        const userDoc = await db.collection('users').doc(userUid).get();
        if (userDoc.exists) {
          userEmail = resolveEmail(userDoc.data()!);
          firstName = (userDoc.data()?.displayName as string || userName).split(' ')[0] || firstName;
        }
      } catch (err) {
        console.error('[onInquiryThreadCreated] Failed to fetch user doc for support thread', { userUid, err });
      }

      if (userEmail) {
        try {
          await sendSupportThreadUserEmail(userEmail, { firstName, inboxUrl }, resend);
          console.log(`[onInquiryThreadCreated] Support user email sent to ${userEmail}`);
        } catch (err) {
          console.error('[onInquiryThreadCreated] Failed to send support user email', { userEmail, err });
        }
      } else {
        console.log(`[onInquiryThreadCreated] No email for support user ${userUid}, skipping user notification`);
      }

      try {
        await sendSupportThreadAdminEmail(
          'admin@ctchickens.com',
          { senderName, inboxUrl, adminInboxUrl: 'https://ctchickens.com/#/admin/inbox' },
          resend
        );
        console.log(`[onInquiryThreadCreated] Support admin email sent for thread ${threadId}`);
      } catch (err) {
        console.error('[onInquiryThreadCreated] Failed to send support admin email', { threadId, err });
      }

    } else if (type === 'inquiry') {
      const breederName = data.breederName as string;
      const participants = data.participants as string[];
      const senderName = formatDisplayName(userName);

      // Email the buyer
      let buyerEmail: string | null = null;
      let buyerFirstName = userName.split(' ')[0] || 'there';
      try {
        const buyerDoc = await db.collection('users').doc(userUid).get();
        if (buyerDoc.exists) {
          buyerEmail = resolveEmail(buyerDoc.data()!);
          buyerFirstName = (buyerDoc.data()?.displayName as string || userName).split(' ')[0] || buyerFirstName;
        }
      } catch (err) {
        console.error('[onInquiryThreadCreated] Failed to fetch buyer doc', { userUid, err });
      }

      if (buyerEmail) {
        try {
          await sendInquiryBuyerEmail(buyerEmail, { firstName: buyerFirstName, breederName, inboxUrl }, resend);
          console.log(`[onInquiryThreadCreated] Inquiry buyer email sent to ${buyerEmail}`);
        } catch (err) {
          console.error('[onInquiryThreadCreated] Failed to send inquiry buyer email', { buyerEmail, err });
        }
      } else {
        console.log(`[onInquiryThreadCreated] No email for buyer ${userUid}, skipping buyer notification`);
      }

      // Determine if listing is claimed by inspecting participants.
      // InquiryModal sets participants to [userUid, ownerUid || 'admin'], so any non-buyer
      // participant that isn't the literal string 'admin' is the real owner UID.
      const sellerUid = participants.find(p => p !== userUid && p !== 'admin') ?? null;

      if (sellerUid) {
        // Claimed — email the seller
        let sellerEmail: string | null = null;
        try {
          const sellerDoc = await db.collection('users').doc(sellerUid).get();
          if (sellerDoc.exists) {
            sellerEmail = resolveEmail(sellerDoc.data()!);
          }
        } catch (err) {
          console.error('[onInquiryThreadCreated] Failed to fetch seller doc', { sellerUid, err });
        }

        if (sellerEmail) {
          try {
            await sendInquirySellerEmail(sellerEmail, { senderName, breederName, inboxUrl }, resend);
            console.log(`[onInquiryThreadCreated] Inquiry seller email sent to ${sellerEmail}`);
          } catch (err) {
            console.error('[onInquiryThreadCreated] Failed to send inquiry seller email', { sellerEmail, err });
          }
        } else {
          console.log(`[onInquiryThreadCreated] No email for seller ${sellerUid}, skipping seller notification`);
        }
      } else {
        // Unclaimed listing — notify admins and the farm's contact email if one exists
        const recipients: string[] = ['admin@ctchickens.com'];
        try {
          const listingDoc = await db.collection('directory_members').doc(data.breederSlug as string).get();
          const contactEmail = listingDoc.data()?.profile?.contactEmail as string | undefined;
          if (contactEmail && contactEmail !== 'admin@ctchickens.com') {
            recipients.push(contactEmail);
          }
        } catch (err) {
          console.error('[onInquiryThreadCreated] Failed to fetch listing contact email', { threadId, err });
        }

        for (const to of recipients) {
          try {
            await sendInquiryAdminUnclaimedEmail(to, { senderName, breederName, inboxUrl }, resend);
            console.log(`[onInquiryThreadCreated] Unclaimed listing email sent to ${to} for thread ${threadId}`);
          } catch (err) {
            console.error('[onInquiryThreadCreated] Failed to send unclaimed email', { to, threadId, err });
          }
        }
      }
    } else {
      console.log(`[onInquiryThreadCreated] Unknown thread type "${type}" for ${threadId}, skipping`);
    }
  }
);

