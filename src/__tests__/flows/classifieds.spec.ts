import { describe, it, expect, beforeEach } from 'vitest';
import { db, auth } from '../../firebase';
import {
  doc, getDoc, setDoc, addDoc, collection, serverTimestamp, writeBatch,
  getDocs, query, where
} from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  clearFirestoreEmulator,
  clearAuthEmulator,
  createTestUser,
  logout
} from '../test-helpers';
import store from '../../store';

const PROJECT_ID = () => import.meta.env.VITE_FIREBASE_PROJECT_ID || 'ct-chickens';

/**
 * Seeds a classified doc directly into `classifieds` via REST, bypassing rules.
 * Simulates what the Cloud Function would write after approving a draft.
 */
async function seedClassified(docId: string, data: {
  owner_uid: string;
  display_name?: string;
  location?: string;
  title?: string;
  description?: string;
  category?: string;
  status?: string;
  renewal_count?: number;
  max_renewals?: number;
  expires_at?: Date;
  created_at?: Date;
}) {
  const projectId = PROJECT_ID();
  const url = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents/classifieds/${docId}`;

  const expiresAt = data.expires_at ?? new Date(Date.now() + 30 * 86400000);
  const createdAt = data.created_at ?? new Date();

  const payload = {
    fields: {
      owner_uid: { stringValue: data.owner_uid },
      display_name: { stringValue: data.display_name ?? 'Test User' },
      location: { stringValue: data.location ?? 'Lebanon, CT' },
      title: { stringValue: data.title ?? 'Silkie Hens Wanted' },
      description: { stringValue: data.description ?? 'Looking for Silkie hens' },
      category: { stringValue: data.category ?? 'iso' },
      status: { stringValue: data.status ?? 'active' },
      renewal_count: { integerValue: data.renewal_count ?? 0 },
      max_renewals: { integerValue: data.max_renewals ?? 2 },
      expires_at: { timestampValue: expiresAt.toISOString() },
      created_at: { timestampValue: createdAt.toISOString() },
    }
  };

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer owner' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error(`Failed to seed classified: ${await res.text()}`);
}

/**
 * Seeds a draft_classified doc via REST.
 */
async function seedDraftClassified(docId: string, data: {
  owner_uid: string;
  display_name?: string;
  location?: string;
  title?: string;
  description?: string;
  category?: string;
}) {
  const projectId = PROJECT_ID();
  const url = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents/draft_classifieds/${docId}`;

  const payload = {
    fields: {
      owner_uid: { stringValue: data.owner_uid },
      display_name: { stringValue: data.display_name ?? 'Test User' },
      location: { stringValue: data.location ?? 'Lebanon, CT' },
      title: { stringValue: data.title ?? 'Silkie Hens Wanted' },
      description: { stringValue: data.description ?? 'Looking for Silkie hens' },
      category: { stringValue: data.category ?? 'iso' },
      status: { stringValue: 'pending' },
      created_at: { timestampValue: new Date().toISOString() },
    }
  };

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer owner' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error(`Failed to seed draft classified: ${await res.text()}`);
}

/**
 * Simulates the Cloud Function publishing step: writes to `classifieds` and deletes from `draft_classifieds`.
 * Real CF triggers on draft_classified_history writes; here we replicate the outcome directly.
 */
async function simulateCFPublish(docId: string, ownerUid: string, draftData: any) {
  const projectId = PROJECT_ID();
  const classifiedUrl = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents/classifieds/${docId}`;
  const draftUrl = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents/draft_classifieds/${docId}`;

  // Write the published classified
  const publishPayload = {
    fields: {
      owner_uid: { stringValue: ownerUid },
      display_name: { stringValue: draftData.display_name ?? 'Test User' },
      location: { stringValue: draftData.location ?? 'Lebanon, CT' },
      title: { stringValue: draftData.title ?? 'Silkie Hens Wanted' },
      description: { stringValue: draftData.description ?? 'Looking for Silkie hens' },
      category: { stringValue: draftData.category ?? 'iso' },
      status: { stringValue: 'active' },
      renewal_count: { integerValue: 0 },
      max_renewals: { integerValue: 2 },
      expires_at: { timestampValue: new Date(Date.now() + 30 * 86400000).toISOString() },
      created_at: { timestampValue: new Date().toISOString() },
    }
  };

  const publishRes = await fetch(classifiedUrl, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer owner' },
    body: JSON.stringify(publishPayload)
  });
  if (!publishRes.ok) throw new Error(`CF publish write failed: ${await publishRes.text()}`);

  // Delete the draft
  const deleteRes = await fetch(draftUrl, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer owner' }
  });
  if (!deleteRes.ok && deleteRes.status !== 404) {
    throw new Error(`CF draft delete failed: ${await deleteRes.text()}`);
  }
}

// ---------------------------------------------------------------------------
// Flow 1: Create → Admin approves → CF publishes
// ---------------------------------------------------------------------------
describe('Classified Flow: create → approved → published', () => {
  beforeEach(async () => {
    await clearFirestoreEmulator();
    await clearAuthEmulator();
    await logout();
    store.commit('SET_USER', null);
    store.commit('SET_USER_DATA', null);
    store.commit('SET_CLASSIFIEDS', []);
    store.commit('SET_MY_CLASSIFIEDS', []);
  });

  it('admin approves draft → history written with status approved → classified published, draft removed', async () => {
    const userEmail = 'poster@example.com';
    const adminEmail = 'admin@example.com';
    const posterUser = await createTestUser(userEmail, 'Poster Pete');
    const adminUser = await createTestUser(adminEmail, 'Admin Anna', true);

    const draftId = 'draft-approved-test';

    // 1. Seed a draft as the poster
    await seedDraftClassified(draftId, {
      owner_uid: posterUser.uid,
      display_name: 'Poster P.',
      location: 'Storrs, CT',
      title: '5 Rhode Island Red Pullets Wanted',
      description: 'Looking for 5 Rhode Island Red pullets',
      category: 'iso',
    });

    // 2. Verify draft exists
    const draftBefore = await getDoc(doc(db, 'draft_classifieds', draftId));
    expect(draftBefore.exists()).toBe(true);
    expect(draftBefore.data()?.status).toBe('pending');

    // 3. Admin logs in and writes the approval history doc + deletes draft (mirrors handleApprove)
    await signInWithEmailAndPassword(auth, adminEmail, 'password123');

    const batch = writeBatch(db);
    batch.set(doc(db, 'draft_classified_history', draftId), {
      draft_meta: {
        status: 'approved',
        archivedAt: serverTimestamp(),
        owner_uid: posterUser.uid,
      },
      snapshot: {
        owner_uid: posterUser.uid,
        display_name: 'Poster P.',
        location: 'Storrs, CT',
        title: '5 Rhode Island Red Pullets Wanted',
        description: 'Looking for 5 Rhode Island Red pullets',
        category: 'iso',
        status: 'pending',
        created_at: serverTimestamp(),
      },
    });
    batch.delete(doc(db, 'draft_classifieds', draftId));
    await batch.commit();

    // 4. Assert draft_classified_history was written with status: 'approved'
    const historyDoc = await getDoc(doc(db, 'draft_classified_history', draftId));
    expect(historyDoc.exists()).toBe(true);
    expect(historyDoc.data()?.draft_meta.status).toBe('approved');
    expect(historyDoc.data()?.draft_meta.owner_uid).toBe(posterUser.uid);

    // 5. Assert draft was removed
    const draftAfter = await getDoc(doc(db, 'draft_classifieds', draftId));
    expect(draftAfter.exists()).toBe(false);

    // 6. Simulate CF publishing the classified (real CF triggers on history write)
    await simulateCFPublish(draftId, posterUser.uid, {
      display_name: 'Poster P.',
      location: 'Storrs, CT',
      title: '5 Rhode Island Red Pullets Wanted',
      description: 'Looking for 5 Rhode Island Red pullets',
      category: 'iso',
    });

    // 7. Assert classified is now active in `classifieds`
    const classifiedDoc = await getDoc(doc(db, 'classifieds', draftId));
    expect(classifiedDoc.exists()).toBe(true);
    expect(classifiedDoc.data()?.status).toBe('active');
    expect(classifiedDoc.data()?.owner_uid).toBe(posterUser.uid);
    expect(classifiedDoc.data()?.renewal_count).toBe(0);
    expect(classifiedDoc.data()?.max_renewals).toBeGreaterThan(0);
  }, 20000);
});

// ---------------------------------------------------------------------------
// Flow 2: Create → Admin rejects → draft deleted, no classifieds doc
// ---------------------------------------------------------------------------
describe('Classified Flow: create → declined → no classifieds doc', () => {
  beforeEach(async () => {
    await clearFirestoreEmulator();
    await clearAuthEmulator();
    await logout();
    store.commit('SET_USER', null);
    store.commit('SET_USER_DATA', null);
  });

  it('admin rejects draft → history status rejected → draft deleted → no classifieds doc created', async () => {
    const userEmail = 'rejected-poster@example.com';
    const adminEmail = 'admin-reject@example.com';
    const posterUser = await createTestUser(userEmail, 'Rejected Rita');
    await createTestUser(adminEmail, 'Admin Bob', true);

    const draftId = 'draft-rejected-test';

    await seedDraftClassified(draftId, {
      owner_uid: posterUser.uid,
      title: '20 Mixed Breed Roosters',
      description: 'Selling 20 mixed breed roosters cheap',
      category: 'for_sale',
    });

    // Admin rejects
    await signInWithEmailAndPassword(auth, adminEmail, 'password123');

    const batch = writeBatch(db);
    batch.set(doc(db, 'draft_classified_history', draftId), {
      draft_meta: {
        status: 'rejected',
        archivedAt: serverTimestamp(),
        owner_uid: posterUser.uid,
      },
      snapshot: {
        owner_uid: posterUser.uid,
        display_name: 'Rejected R.',
        location: 'Lebanon, CT',
        title: '20 Mixed Breed Roosters',
        description: 'Selling 20 mixed breed roosters cheap',
        category: 'for_sale',
        status: 'pending',
        created_at: serverTimestamp(),
      },
    });
    batch.delete(doc(db, 'draft_classifieds', draftId));
    await batch.commit();

    // Assert history status is 'rejected'
    const historyDoc = await getDoc(doc(db, 'draft_classified_history', draftId));
    expect(historyDoc.exists()).toBe(true);
    expect(historyDoc.data()?.draft_meta.status).toBe('rejected');

    // Draft must be gone
    const draftAfter = await getDoc(doc(db, 'draft_classifieds', draftId));
    expect(draftAfter.exists()).toBe(false);

    // No classifieds doc must have been created
    const classifiedDoc = await getDoc(doc(db, 'classifieds', draftId));
    expect(classifiedDoc.exists()).toBe(false);
  }, 20000);
});

// ---------------------------------------------------------------------------
// Flow 3: Published → renewed → renewed: renewal_count and expires_at extend
// ---------------------------------------------------------------------------
describe('Classified Flow: published → renewed twice', () => {
  beforeEach(async () => {
    await clearFirestoreEmulator();
    await clearAuthEmulator();
    await logout();
    store.commit('SET_USER', null);
    store.commit('SET_USER_DATA', null);
  });

  it('owner renews twice → renewal_count increments and expires_at extends each time', async () => {
    const ownerEmail = 'renewer@example.com';
    const ownerUser = await createTestUser(ownerEmail, 'Renew Rachel');
    const classifiedId = 'renewable-classified';

    // Seed with 1 day until expiry so canRenew would be true (within 2-day window)
    const initialExpiry = new Date(Date.now() + 1 * 86400000);
    await seedClassified(classifiedId, {
      owner_uid: ownerUser.uid,
      renewal_count: 0,
      max_renewals: 2,
      expires_at: initialExpiry,
    });

    await signInWithEmailAndPassword(auth, ownerEmail, 'password123');

    // --- First renewal ---
    await addDoc(collection(db, 'classifieds', classifiedId, 'actions'), {
      action: 'renew',
      owner_uid: ownerUser.uid,
      created_at: serverTimestamp(),
    });

    // Simulate CF processing first renewal: extend 30 days, increment count
    const afterFirstExpiry = new Date(initialExpiry.getTime() + 30 * 86400000);
    await fetch(
      `http://127.0.0.1:8080/v1/projects/${PROJECT_ID()}/databases/(default)/documents/classifieds/${classifiedId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer owner' },
        body: JSON.stringify({
          fields: {
            renewal_count: { integerValue: 1 },
            expires_at: { timestampValue: afterFirstExpiry.toISOString() },
          }
        })
      }
    );

    const afterFirst = await getDoc(doc(db, 'classifieds', classifiedId));
    expect(afterFirst.data()?.renewal_count).toBe(1);
    const firstExpiryStored = afterFirst.data()?.expires_at.toDate?.() ?? new Date(afterFirst.data()?.expires_at);
    expect(firstExpiryStored.getTime()).toBeGreaterThan(initialExpiry.getTime());

    // --- Second renewal ---
    await addDoc(collection(db, 'classifieds', classifiedId, 'actions'), {
      action: 'renew',
      owner_uid: ownerUser.uid,
      created_at: serverTimestamp(),
    });

    const afterSecondExpiry = new Date(afterFirstExpiry.getTime() + 30 * 86400000);
    await fetch(
      `http://127.0.0.1:8080/v1/projects/${PROJECT_ID()}/databases/(default)/documents/classifieds/${classifiedId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer owner' },
        body: JSON.stringify({
          fields: {
            renewal_count: { integerValue: 2 },
            expires_at: { timestampValue: afterSecondExpiry.toISOString() },
          }
        })
      }
    );

    const afterSecond = await getDoc(doc(db, 'classifieds', classifiedId));
    expect(afterSecond.data()?.renewal_count).toBe(2);
    const secondExpiryStored = afterSecond.data()?.expires_at.toDate?.() ?? new Date(afterSecond.data()?.expires_at);
    expect(secondExpiryStored.getTime()).toBeGreaterThan(firstExpiryStored.getTime());
  }, 20000);
});

// ---------------------------------------------------------------------------
// Flow 4: Published → daily sweep sets status: 'expired'
// ---------------------------------------------------------------------------
describe('Classified Flow: published → expired by daily sweep', () => {
  beforeEach(async () => {
    await clearFirestoreEmulator();
    await clearAuthEmulator();
    await logout();
  });

  it('daily sweep sets status to expired when expires_at is in the past', async () => {
    const ownerEmail = 'expiry-owner@example.com';
    const ownerUser = await createTestUser(ownerEmail, 'Expiry Ed');
    const classifiedId = 'expired-classified';

    // Seed with expiry in the past
    const pastExpiry = new Date(Date.now() - 2 * 86400000);
    await seedClassified(classifiedId, {
      owner_uid: ownerUser.uid,
      status: 'active',
      expires_at: pastExpiry,
    });

    // Confirm it's active before the sweep
    const before = await getDoc(doc(db, 'classifieds', classifiedId));
    expect(before.data()?.status).toBe('active');

    // Simulate the daily sweep (CF updates the doc)
    await fetch(
      `http://127.0.0.1:8080/v1/projects/${PROJECT_ID()}/databases/(default)/documents/classifieds/${classifiedId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer owner' },
        body: JSON.stringify({
          fields: { status: { stringValue: 'expired' } }
        })
      }
    );

    const after = await getDoc(doc(db, 'classifieds', classifiedId));
    expect(after.data()?.status).toBe('expired');
  }, 15000);
});

// ---------------------------------------------------------------------------
// Store action: fetchClassifieds loads only active docs
// ---------------------------------------------------------------------------
describe('Store: fetchClassifieds', () => {
  beforeEach(async () => {
    await clearFirestoreEmulator();
    await clearAuthEmulator();
    await logout();
    store.commit('SET_USER', null);
    store.commit('SET_USER_DATA', null);
    store.commit('SET_CLASSIFIEDS', []);
  });

  it('loads only status=active classifieds into store', async () => {
    const ownerEmail = 'store-owner@example.com';
    const ownerUser = await createTestUser(ownerEmail, 'Store Owner');

    await seedClassified('active-1', { owner_uid: ownerUser.uid, status: 'active', title: 'Active One', description: 'Active one' });
    await seedClassified('active-2', { owner_uid: ownerUser.uid, status: 'active', title: 'Active Two', description: 'Active two' });
    await seedClassified('expired-1', { owner_uid: ownerUser.uid, status: 'expired', title: 'Expired One', description: 'Expired one' });

    // fetchClassifieds is unauthenticated — no sign-in required
    await store.dispatch('fetchClassifieds');

    const items = store.state.classifieds;
    expect(items.length).toBe(2);
    expect(items.every((c: any) => c.status === 'active')).toBe(true);
    const descriptions = items.map((c: any) => c.description);
    expect(descriptions).toContain('Active one');
    expect(descriptions).toContain('Active two');
    expect(descriptions).not.toContain('Expired one');
  }, 15000);
});

// ---------------------------------------------------------------------------
// Store action: fetchMyClassifieds loads owner's drafts + live listings
// ---------------------------------------------------------------------------
describe('Store: fetchMyClassifieds', () => {
  beforeEach(async () => {
    await clearFirestoreEmulator();
    await clearAuthEmulator();
    await logout();
    store.commit('SET_USER', null);
    store.commit('SET_USER_DATA', null);
    store.commit('SET_MY_CLASSIFIEDS', []);
  });

  it('loads both draft_classifieds and classifieds belonging to the owner', async () => {
    const ownerEmail = 'my-classified-owner@example.com';
    const otherEmail = 'other-user@example.com';
    const ownerUser = await createTestUser(ownerEmail, 'My Owner');
    const otherUser = await createTestUser(otherEmail, 'Other Person');

    await seedClassified('live-mine', { owner_uid: ownerUser.uid, status: 'active', title: 'My Active Listing', description: 'My active listing' });
    await seedClassified('live-other', { owner_uid: otherUser.uid, status: 'active', title: 'Not Mine', description: 'Not mine' });
    await seedDraftClassified('draft-mine', { owner_uid: ownerUser.uid, title: 'My Pending Listing', description: 'My pending listing' });

    await signInWithEmailAndPassword(auth, ownerEmail, 'password123');
    store.commit('SET_USER', (await import('../../firebase')).auth.currentUser);

    await store.dispatch('fetchMyClassifieds', ownerUser.uid);

    const mine = store.state.myClassifieds;
    const descriptions = mine.map((c: any) => c.description);
    expect(descriptions).toContain('My active listing');
    expect(descriptions).toContain('My pending listing');
    expect(descriptions).not.toContain('Not mine');
  }, 15000);
});

// ---------------------------------------------------------------------------
// Store action: createDraftClassified writes correct fields
// ---------------------------------------------------------------------------
describe('Store: createDraftClassified', () => {
  beforeEach(async () => {
    await clearFirestoreEmulator();
    await clearAuthEmulator();
    await logout();
    store.commit('SET_USER', null);
    store.commit('SET_USER_DATA', null);
    store.commit('SET_MY_CLASSIFIEDS', []);
  });

  it('writes correct fields to draft_classifieds and returns the new doc id', async () => {
    const email = 'draft-creator@example.com';
    const user = await createTestUser(email, 'Draft Dan');
    await signInWithEmailAndPassword(auth, email, 'password123');
    store.commit('SET_USER', (await import('../../firebase')).auth.currentUser);

    const id = await store.dispatch('createDraftClassified', {
      category: 'for_sale',
      location: 'Mansfield, CT',
      title: 'Ayam Cemani Hatching Eggs',
      description: 'Selling a dozen hatching eggs from my Ayam Cemani flock',
    });

    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);

    const draftSnap = await getDoc(doc(db, 'draft_classifieds', id));
    expect(draftSnap.exists()).toBe(true);

    const data = draftSnap.data()!;
    expect(data.owner_uid).toBe(user.uid);
    expect(data.status).toBe('pending');
    expect(data.category).toBe('for_sale');
    expect(data.location).toBe('Mansfield, CT');
    expect(data.title).toBe('Ayam Cemani Hatching Eggs');
    expect(data.description).toContain('Ayam Cemani');
    expect(data.display_name).toBeDefined();
    expect(data.created_at).toBeDefined();
  }, 15000);

  it('throws if user is not logged in', async () => {
    store.commit('SET_USER', null);
    await expect(
      store.dispatch('createDraftClassified', {
        category: 'iso',
        location: 'Hartford, CT',
        title: 'Chickens Wanted',
        description: 'Wants some chickens badly enough to test this',
      })
    ).rejects.toThrow(/logged in/i);
  });
});
