import { describe, it, expect, beforeEach } from 'vitest';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { functions, db, auth } from '../../firebase';
import { clearFirestoreEmulator, clearAuthEmulator, createTestUser } from '../test-helpers';

const HMAC_SECRET = 'local-dev-secret';

/**
 * Probe the Functions emulator at module load time (top-level await).
 * If the emulator is not running, every test in this module is skipped so
 * that `npm run test` without `npm run emulate` does not produce failures.
 */
let functionsEmulatorAvailable = false;
try {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'ct-chickens';
  // POST to the actual function — 404 means not deployed, any other status means running
  const res = await fetch(`http://127.0.0.1:5001/${projectId}/us-central1/setLocalEmail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: {} }),
    signal: AbortSignal.timeout(2000),
  });
  functionsEmulatorAvailable = res.status !== 404;
} catch {
  /* emulator not running */
}

const maybeIt = functionsEmulatorAvailable ? it : it.skip;

async function makeToken(uid: string, email: string, ts: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(HMAC_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${uid}:${email}:${ts}`));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function seedUserFields(uid: string, fields: Record<string, string | null>) {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const fieldPaths = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&');
  const url = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?${fieldPaths}`;
  const payload = {
    fields: Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, v === null ? { nullValue: null } : { stringValue: v }])
    ),
  };
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer owner' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to seed user fields: ${await res.text()}`);
}

describe('setLocalEmail callable', () => {
  beforeEach(async () => {
    await clearFirestoreEmulator();
    await clearAuthEmulator();
    await signOut(auth);
  });

  maybeIt('sets pendingLocalEmail and returns verification_sent for a valid email', async () => {
    const fbEmail = `user-${Date.now()}@example.com`;
    const user = await createTestUser(fbEmail, 'Test User');
    // Ensure localEmail is not seeded by createTestUser
    await seedUserFields(user.uid, { localEmail: null });
    await signInWithEmailAndPassword(auth, fbEmail, 'password123');

    const result = await httpsCallable(functions, 'setLocalEmail')({ email: 'notify@example.com' });
    expect((result.data as any).action).toBe('verification_sent');

    const snap = await getDoc(doc(db, 'users', user.uid));
    expect(snap.data()?.pendingLocalEmail).toBe('notify@example.com');
    expect(snap.data()?.localEmail).toBeUndefined();
  });

  maybeIt('clears both localEmail and pendingLocalEmail when email is empty', async () => {
    const fbEmail = `user-${Date.now()}@example.com`;
    const user = await createTestUser(fbEmail, 'Test User');
    await seedUserFields(user.uid, { localEmail: 'old@example.com', pendingLocalEmail: 'pending@example.com' });
    await signInWithEmailAndPassword(auth, fbEmail, 'password123');

    const result = await httpsCallable(functions, 'setLocalEmail')({ email: '' });
    expect((result.data as any).action).toBe('cleared');

    const snap = await getDoc(doc(db, 'users', user.uid));
    expect(snap.data()?.localEmail).toBeUndefined();
    expect(snap.data()?.pendingLocalEmail).toBeUndefined();
  });

  maybeIt('rejects an invalid email format', async () => {
    const fbEmail = `user-${Date.now()}@example.com`;
    await createTestUser(fbEmail, 'Test User');
    await signInWithEmailAndPassword(auth, fbEmail, 'password123');

    await expect(httpsCallable(functions, 'setLocalEmail')({ email: 'not-an-email' }))
      .rejects.toThrow(/invalid/i);
  });

  maybeIt('rejects unauthenticated calls', async () => {
    await expect(httpsCallable(functions, 'setLocalEmail')({ email: 'test@example.com' }))
      .rejects.toThrow(/unauthenticated|must be signed in/i);
  });
});

describe('verifyLocalEmail callable', () => {
  beforeEach(async () => {
    await clearFirestoreEmulator();
    await clearAuthEmulator();
    await signOut(auth);
  });

  maybeIt('promotes pendingLocalEmail to localEmail on a valid token', async () => {
    const fbEmail = `user-${Date.now()}@example.com`;
    const user = await createTestUser(fbEmail, 'Test User');
    await seedUserFields(user.uid, { localEmail: null, pendingLocalEmail: 'notify@example.com' });

    const ts = String(Date.now());
    const token = await makeToken(user.uid, 'notify@example.com', ts);

    const result = await httpsCallable(functions, 'verifyLocalEmail')({ uid: user.uid, email: 'notify@example.com', ts, token });
    expect((result.data as any).ok).toBe(true);

    const snap = await getDoc(doc(db, 'users', user.uid));
    expect(snap.data()?.localEmail).toBe('notify@example.com');
    expect(snap.data()?.pendingLocalEmail).toBeUndefined();
  });

  maybeIt('rejects an expired token and leaves pending email unchanged', async () => {
    const fbEmail = `user-${Date.now()}@example.com`;
    const user = await createTestUser(fbEmail, 'Test User');
    await seedUserFields(user.uid, { localEmail: null, pendingLocalEmail: 'notify@example.com' });

    const expiredTs = String(Date.now() - 25 * 60 * 60 * 1000);
    const token = await makeToken(user.uid, 'notify@example.com', expiredTs);

    await expect(httpsCallable(functions, 'verifyLocalEmail')({ uid: user.uid, email: 'notify@example.com', ts: expiredTs, token }))
      .rejects.toThrow(/expired/i);

    const snap = await getDoc(doc(db, 'users', user.uid));
    expect(snap.data()?.localEmail).toBeUndefined();
    expect(snap.data()?.pendingLocalEmail).toBe('notify@example.com');
  });

  maybeIt('rejects a tampered token and leaves pending email unchanged', async () => {
    const fbEmail = `user-${Date.now()}@example.com`;
    const user = await createTestUser(fbEmail, 'Test User');
    await seedUserFields(user.uid, { localEmail: null, pendingLocalEmail: 'notify@example.com' });

    const ts = String(Date.now());
    const badToken = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

    await expect(httpsCallable(functions, 'verifyLocalEmail')({ uid: user.uid, email: 'notify@example.com', ts, token: badToken }))
      .rejects.toThrow(/invalid|tampered/i);

    const snap = await getDoc(doc(db, 'users', user.uid));
    expect(snap.data()?.localEmail).toBeUndefined();
  });

  maybeIt('rejects when pending email no longer matches the token', async () => {
    const fbEmail = `user-${Date.now()}@example.com`;
    const user = await createTestUser(fbEmail, 'Test User');

    const ts = String(Date.now());
    const token = await makeToken(user.uid, 'notify@example.com', ts);

    // User changed their mind — pending is now a different address
    await seedUserFields(user.uid, { localEmail: null, pendingLocalEmail: 'different@example.com' });

    await expect(httpsCallable(functions, 'verifyLocalEmail')({ uid: user.uid, email: 'notify@example.com', ts, token }))
      .rejects.toThrow();

    const snap = await getDoc(doc(db, 'users', user.uid));
    expect(snap.data()?.localEmail).toBeUndefined();
    expect(snap.data()?.pendingLocalEmail).toBe('different@example.com');
  });
});
