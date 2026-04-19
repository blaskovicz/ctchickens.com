import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

const layoutSource = fs.readFileSync(path.join(__dirname, '../templates/_layout.html'), 'utf-8');
const layoutTemplate = Handlebars.compile(layoutSource);

function renderTemplate(bodyName: string, vars: Record<string, unknown> & { subject: string }): string {
  const bodySource = fs.readFileSync(path.join(__dirname, '../templates', bodyName), 'utf-8');
  const body = Handlebars.compile(bodySource)(vars);
  return layoutTemplate({ ...vars, body });
}

export async function sendWelcomeEmail(
  to: string,
  displayName: string,
  resend: Resend
): Promise<void> {
  const firstName = displayName?.split(' ')[0] || 'there';
  const subject = `Welcome to CT Chickens, ${firstName}!`;
  await resend.emails.send({
    from: 'CT Chickens <noreply@ctchickens.com>',
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
  await resend.emails.send({
    from: 'CT Chickens <noreply@ctchickens.com>',
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
  await resend.emails.send({
    from: 'CT Chickens <noreply@ctchickens.com>',
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
  await resend.emails.send({
    from: 'CT Chickens <noreply@ctchickens.com>',
    to,
    subject,
    html: renderTemplate('verification-nudge-body.html', { subject, ...vars }),
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
  await resend.emails.send({
    from: 'CT Chickens <noreply@ctchickens.com>',
    to,
    subject: vars.subject,
    html: renderTemplate('announcement-body.html', { ...vars }),
  });
}
