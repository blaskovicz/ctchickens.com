import { describe, it, expect, beforeEach } from 'vitest';
import { db, auth } from '../../firebase';
import { 
  signInWithEmailAndPassword 
} from 'firebase/auth';
import {
  doc, setDoc, serverTimestamp
} from 'firebase/firestore';
import {
  clearFirestoreEmulator,
  clearAuthEmulator,
  createTestUser,
  logout
} from '../test-helpers';

describe('Security: Directory Publishing', () => {
  beforeEach(async () => {
    await clearFirestoreEmulator();
    await clearAuthEmulator();
    await logout();
  });

  it('prevents a non-admin user from publishing to the live directory', async () => {
    // 1. Setup a normal user
    const email = 'farmer@test.com';
    await createTestUser(email, 'Normal Farmer');
    await signInWithEmailAndPassword(auth, email, 'password123');

    // 2. Attempt to write to directory_members directly (bypass draft flow)
    const slug = 'malicious-farm';
    const liveRef = doc(db, 'directory_members', slug);
    
    const maliciousPayload = {
      profile: {
        businessName: 'Malicious Farm',
        town: 'Anytown, CT',
        memberType: 'farm'
      },
      account: {
        status: 'published',
        ownerUid: auth.currentUser?.uid,
        updatedAt: serverTimestamp()
      }
    };

    // This should fail due to 'allow write: if isUserAdmin'
    await expect(setDoc(liveRef, maliciousPayload)).rejects.toThrow(/permission-denied|insufficient|PERMISSION_DENIED/i);
  });

  it('prevents an unauthenticated user from publishing to the live directory', async () => {
    const slug = 'anonymous-farm';
    const liveRef = doc(db, 'directory_members', slug);
    
    const anonymousPayload = {
      profile: { businessName: 'Anonymous Farm' },
      account: { status: 'published' }
    };

    await expect(setDoc(liveRef, anonymousPayload)).rejects.toThrow(/permission-denied|insufficient|PERMISSION_DENIED/i);
  });
});
