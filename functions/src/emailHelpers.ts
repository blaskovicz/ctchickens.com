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
