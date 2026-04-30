import { describe, it, expect, beforeEach } from 'vitest';
import { clearAuthEmulator } from '../test-helpers';

// Integration test for the verifyFacebookEmailOnCreate beforeUserCreated blocking function.
//
// REQUIRES all emulators running including Functions:
//   npm run emulate   (Auth :9099, Firestore :8080, Storage :9199, Functions :5001)
//   cd functions && npm run build   (must be built before emulators start)
//
// When the Auth emulator starts alongside the Functions emulator, it auto-discovers
// blocking triggers exported from functions/lib/index.js and calls them on sign-in.
// This test verifies the full path: Facebook OAuth sign-in → beforeUserCreated fires
// → user record has emailVerified: true before the first token is issued.

const AUTH_EMULATOR = 'http://localhost:9099';
const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'ct-chickens';
const API_KEY = import.meta.env.VITE_FIREBASE_API_KEY || 'fake-key';

/**
 * Simulates a Facebook OAuth sign-in via the Auth emulator's IdP endpoint.
 * The fake id_token must be a JSON object (not a plain string) — the emulator
 * parses it directly and maps sub→uid, email→email, name→displayName.
 * email_verified is intentionally omitted to mirror real Facebook OAuth tokens.
 */
async function signInWithFacebookEmulator(email: string, uid: string) {
  const fakeIdToken = JSON.stringify({
    sub: uid,
    email,
    name: 'Test Facebook User',
    // email_verified intentionally absent — Facebook's OIDC response omits it,
    // which is exactly why Firebase doesn't auto-set emailVerified for Facebook users.
  });

  const res = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestUri: 'http://localhost',
        postBody: `id_token=${encodeURIComponent(fakeIdToken)}&providerId=facebook.com`,
        returnIdpCredential: true,
        returnSecureToken: true,
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`signInWithIdp failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<{ idToken: string; localId: string; email: string }>;
}

/**
 * Looks up a user's current auth record via their idToken.
 * This is what we check to confirm emailVerified was set by the blocking function.
 */
async function lookupUser(idToken: string) {
  const res = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );
  const body = await res.json() as { users?: { emailVerified?: boolean; providerUserInfo?: { providerId: string }[] }[] };
  return body.users?.[0];
}

describe('beforeUserCreated: Facebook email verification (integration)', () => {
  beforeEach(async () => {
    await clearAuthEmulator();
  });

  it('new Facebook user gets emailVerified: true from the blocking function', async () => {
    const email = `fb-test-${Date.now()}@example.com`;
    const uid = `fb-uid-${Date.now()}`;

    // Sign in via Facebook IdP — beforeUserCreated fires here if the Functions
    // emulator is running and has the blocking trigger registered.
    const { idToken } = await signInWithFacebookEmulator(email, uid);

    // Look up the freshly-created auth record.
    const user = await lookupUser(idToken);

    expect(user).toBeDefined();
    // The blocking function returns { emailVerified: true }, which Firebase applies
    // to the auth record before the first token is issued.
    expect(user?.emailVerified).toBe(true);
  });

  it('new Facebook user has facebook.com in providerUserInfo', async () => {
    const email = `fb-test2-${Date.now()}@example.com`;
    const uid = `fb-uid2-${Date.now()}`;

    const { idToken } = await signInWithFacebookEmulator(email, uid);
    const user = await lookupUser(idToken);

    const providers = user?.providerUserInfo?.map(p => p.providerId) ?? [];
    expect(providers).toContain('facebook.com');
  });
});
