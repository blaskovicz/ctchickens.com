import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

const layoutSource = fs.readFileSync(path.join(__dirname, '../templates/_layout.html'), 'utf-8');
const layoutTemplate = Handlebars.compile(layoutSource);

export function renderTemplate(bodyName: string, vars: Record<string, unknown> & { subject: string }): string {
  const bodySource = fs.readFileSync(path.join(__dirname, '../templates', bodyName), 'utf-8');
  const body = Handlebars.compile(bodySource)(vars);
  return layoutTemplate({ ...vars, body });
}

const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';
const PREVIEW_DIR = path.join(__dirname, '../../email-previews');

export async function sendGenericEmail(
  resend: Resend,
  params: { from: string; to: string; subject: string; html: string }
): Promise<void> {
  if (IS_EMULATOR) {
    fs.mkdirSync(PREVIEW_DIR, { recursive: true });
    const slug = params.to.replace(/[^a-z0-9]/gi, '-');
    const file = path.join(PREVIEW_DIR, `${slug}-${Date.now()}.html`);
    fs.writeFileSync(file, params.html, 'utf-8');
    console.log(`[emulator] Email preview written: ${file} (to: ${params.to}, subject: ${params.subject})`);
    return;
  }
  await resend.emails.send(params);
}

export async function sendWelcomeEmail(
  to: string,
  displayName: string,
  resend: Resend
): Promise<void> {
  const firstName = displayName?.split(' ')[0] || 'there';
  const subject = `Welcome to CT Chickens, ${firstName}!`;
  await sendGenericEmail(resend, {
    from: 'CT Chickens <admin@ctchickens.com>',
    to,
    subject,
    html: renderTemplate('welcome-body.html', { subject, firstName }),
  });
}

export async function sendApprovalEmail(
  to: string,
  vars: {
    firstName: string;
    businessName: string;
    profileUrl: string;
    isVerified: boolean;
    isFirstPublish: boolean;
  },
  resend: Resend
): Promise<void> {
  const subject = vars.isFirstPublish
    ? 'Your farm is live on CT Chickens!'
    : 'Your updates are live on CT Chickens!';
  await sendGenericEmail(resend, {
    from: 'CT Chickens <admin@ctchickens.com>',
    to,
    subject,
    html: renderTemplate('approval-body.html', { subject, ...vars }),
  });
}

export async function sendClaimReminderEmail(
  to: string,
  vars: {
    firstName: string;
    businessName: string;
    slug: string;
  },
  resend: Resend
): Promise<void> {
  const subject = `${vars.businessName} is listed on CT Chickens — claim your profile`;
  await sendGenericEmail(resend, {
    from: 'CT Chickens <admin@ctchickens.com>',
    to,
    subject,
    html: renderTemplate('claim-reminder-body.html', { subject, ...vars }),
  });
}

export async function sendVerificationNudgeEmail(
  to: string,
  vars: {
    firstName: string;
    businessName: string;
    slug: string;
  },
  resend: Resend
): Promise<void> {
  const subject = `Get verified on CT Chickens — ${vars.businessName}`;
  await sendGenericEmail(resend, {
    from: 'CT Chickens <admin@ctchickens.com>',
    to,
    subject,
    html: renderTemplate('verification-nudge-body.html', { subject, ...vars }),
  });
}

export async function sendVerificationEmail(
  to: string,
  vars: { firstName: string; verifyUrl: string },
  resend: Resend
): Promise<void> {
  const subject = 'Verify your notification email — CT Chickens';
  await sendGenericEmail(resend, {
    from: 'CT Chickens <admin@ctchickens.com>',
    to,
    subject,
    html: renderTemplate('verify-email-body.html', { subject, ...vars }),
  });
}

export async function sendLocalEmailSetNotification(
  to: string,
  vars: { firstName: string; localEmail: string },
  resend: Resend
): Promise<void> {
  const subject = 'Notification email added to your CT Chickens account';
  await sendGenericEmail(resend, {
    from: 'CT Chickens <admin@ctchickens.com>',
    to,
    subject,
    html: renderTemplate('local-email-set-body.html', { subject, ...vars }),
  });
}

// Mirrors the client-side formatDisplayName in src/composables/useBreederUtils.ts
export function formatDisplayName(fullName: string): string {
  if (!fullName) return 'User';
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastPart = parts[parts.length - 1];
  const lastInitial = lastPart ? lastPart.substring(0, 1).toUpperCase() : '';
  return `${first} ${lastInitial}.`;
}

export async function sendInquiryBuyerEmail(
  to: string,
  vars: { firstName: string; breederName: string; inboxUrl: string },
  resend: Resend
): Promise<void> {
  const subject = `You messaged ${vars.breederName} on CT Chickens`;
  await sendGenericEmail(resend, {
    from: 'CT Chickens <admin@ctchickens.com>',
    to,
    subject,
    html: renderTemplate('inquiry-first-contact-buyer-body.html', { subject, ...vars }),
  });
}

export async function sendInquirySellerEmail(
  to: string,
  vars: { senderName: string; breederName: string; inboxUrl: string },
  resend: Resend
): Promise<void> {
  const subject = `${vars.senderName} sent you a message on CT Chickens`;
  await sendGenericEmail(resend, {
    from: 'CT Chickens <admin@ctchickens.com>',
    to,
    subject,
    html: renderTemplate('inquiry-first-contact-seller-body.html', { subject, ...vars }),
  });
}

export async function sendInquiryAdminUnclaimedEmail(
  to: string,
  vars: { senderName: string; breederName: string; inboxUrl: string },
  resend: Resend
): Promise<void> {
  const subject = `New message sent to unclaimed listing: ${vars.breederName}`;
  await sendGenericEmail(resend, {
    from: 'CT Chickens <admin@ctchickens.com>',
    to,
    subject,
    html: renderTemplate('inquiry-first-contact-admin-body.html', { subject, ...vars }),
  });
}

export async function sendSupportThreadUserEmail(
  to: string,
  vars: { firstName: string; inboxUrl: string },
  resend: Resend
): Promise<void> {
  const subject = 'Your support thread — CT Chickens';
  await sendGenericEmail(resend, {
    from: 'CT Chickens <admin@ctchickens.com>',
    to,
    subject,
    html: renderTemplate('support-thread-user-body.html', { subject, ...vars }),
  });
}

export async function sendSupportThreadAdminEmail(
  to: string,
  vars: { senderName: string; inboxUrl: string; adminInboxUrl: string },
  resend: Resend
): Promise<void> {
  const subject = `${vars.senderName} opened a support thread`;
  await sendGenericEmail(resend, {
    from: 'CT Chickens <admin@ctchickens.com>',
    to,
    subject,
    html: renderTemplate('support-thread-admin-body.html', { subject, ...vars }),
  });
}

export async function sendAdminDraftReviewEmail(
  to: string,
  vars: { businessName: string; ownerName: string; town: string; memberType: string; reviewUrl: string },
  resend: Resend
): Promise<void> {
  const subject = `New draft profile needs review: ${vars.businessName}`;
  await sendGenericEmail(resend, {
    from: 'CT Chickens <admin@ctchickens.com>',
    to,
    subject,
    html: renderTemplate('admin-draft-review-body.html', { subject, ...vars }),
  });
}

export async function sendClaimApprovedEmail(
  to: string,
  vars: { firstName: string; businessName: string; profileUrl: string; editUrl: string },
  resend: Resend
): Promise<void> {
  const subject = `Your claim was approved — ${vars.businessName} is now yours to manage`;
  await sendGenericEmail(resend, {
    from: 'CT Chickens <admin@ctchickens.com>',
    to,
    subject,
    html: renderTemplate('claim-approved-body.html', { subject, ...vars }),
  });
}

export async function sendClassifiedSubmittedAdminEmail(
  to: string,
  vars: { ownerName: string; category: string; location: string; title: string; description: string; reviewUrl: string },
  resend: Resend
): Promise<void> {
  const subject = `New classified needs review — ${vars.title || vars.category} by ${vars.ownerName}`;
  await sendGenericEmail(resend, {
    from: 'CT Chickens <admin@ctchickens.com>',
    to,
    subject,
    html: renderTemplate('classified-submitted-admin-body.html', { subject, ...vars }),
  });
}

export async function sendClassifiedSubmittedUserEmail(
  to: string,
  vars: { firstName: string; category: string; location: string; title: string; description: string },
  resend: Resend
): Promise<void> {
  const label = vars.title || vars.category;
  const subject = `We've received your classified submission: ${label} — CT Chickens`;
  await sendGenericEmail(resend, {
    from: 'CT Chickens <admin@ctchickens.com>',
    to,
    subject,
    html: renderTemplate('classified-submitted-user-body.html', { subject, ...vars }),
  });
}

export async function sendClassifiedRejectedEmail(
  to: string,
  vars: { firstName: string; categoryLabel: string; title?: string },
  resend: Resend
): Promise<void> {
  const label = vars.title || vars.categoryLabel;
  const subject = `Listing update: ${label} — CT Chickens`;
  await sendGenericEmail(resend, {
    from: 'CT Chickens <admin@ctchickens.com>',
    to,
    subject,
    html: renderTemplate('classified-rejected-body.html', { subject, ...vars }),
  });
}

export async function sendClassifiedApprovedEmail(
  to: string,
  vars: { firstName: string; categoryLabel: string; expiresAt: string; maxRenewals: number; classifiedUrl: string; title?: string },
  resend: Resend
): Promise<void> {
  const label = vars.title || vars.categoryLabel;
  const subject = `Your classified is live: ${label} — CT Chickens`;
  await sendGenericEmail(resend, {
    from: 'CT Chickens <admin@ctchickens.com>',
    to,
    subject,
    html: renderTemplate('classified-approved-body.html', { subject, ...vars }),
  });
}

export async function sendClassifiedExpiryWarningEmail(
  to: string,
  vars: { firstName: string; categoryLabel: string; expiresAt: string; classifiedUrl: string; title?: string },
  resend: Resend
): Promise<void> {
  const label = vars.title || vars.categoryLabel;
  const subject = `Listing expiring soon: ${label} — CT Chickens`;
  await sendGenericEmail(resend, {
    from: 'CT Chickens <admin@ctchickens.com>',
    to,
    subject,
    html: renderTemplate('classified-expiry-warning-body.html', { subject, ...vars }),
  });
}

export async function sendClassifiedExpiredEmail(
  to: string,
  vars: { firstName: string; categoryLabel: string; expiresAt: string; title?: string },
  resend: Resend
): Promise<void> {
  const label = vars.title || vars.categoryLabel;
  const subject = `Listing expired: ${label} — CT Chickens`;
  await sendGenericEmail(resend, {
    from: 'CT Chickens <admin@ctchickens.com>',
    to,
    subject,
    html: renderTemplate('classified-expired-body.html', { subject, ...vars }),
  });
}

export async function sendClassifiedRenewedEmail(
  to: string,
  vars: { firstName: string; categoryLabel: string; newExpiresAt: string; renewalsRemaining: number; classifiedUrl: string; title?: string },
  resend: Resend
): Promise<void> {
  const label = vars.title || vars.categoryLabel;
  const subject = `Listing renewed: ${label} — CT Chickens`;
  await sendGenericEmail(resend, {
    from: 'CT Chickens <admin@ctchickens.com>',
    to,
    subject,
    html: renderTemplate('classified-renewed-body.html', { subject, ...vars }),
  });
}

export async function sendClassifiedClosedEmail(
  to: string,
  vars: { firstName: string; categoryLabel: string; title?: string },
  resend: Resend
): Promise<void> {
  const label = vars.title || vars.categoryLabel;
  const subject = `Listing closed: ${label} — CT Chickens`;
  await sendGenericEmail(resend, {
    from: 'CT Chickens <admin@ctchickens.com>',
    to,
    subject,
    html: renderTemplate('classified-closed-body.html', { subject, ...vars }),
  });
}

export async function sendAnnouncementEmail(
  to: string,
  vars: {
    firstName: string;
    businessName: string;
    subject: string;
    customBody: string;
  },
  resend: Resend
): Promise<void> {
  await sendGenericEmail(resend, {
    from: 'CT Chickens <admin@ctchickens.com>',
    to,
    subject: vars.subject,
    html: renderTemplate('announcement-body.html', { ...vars }),
  });
}
