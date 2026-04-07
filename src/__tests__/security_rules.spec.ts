import { describe, it, expect, beforeEach } from 'vitest';
import { db, auth } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { clearFirestoreEmulator, clearAuthEmulator } from './test-helpers';

describe('Security Rules: Users Collection', () => {
  beforeEach(async () => {
    await clearFirestoreEmulator();
    await clearAuthEmulator();
    await signOut(auth);
  });

  it('successfully creates a new user document (fix for broken login)', async () => {
    // 1. Create a user in Auth
    const email = `newuser-${Date.now()}@example.com`;
    const { user } = await createUserWithEmailAndPassword(auth, email, 'password123');
    
    // 2. Attempt to create the user document in Firestore (as done in initAuth)
    const userDocRef = doc(db, 'users', user.uid);
    const userData = {
      displayName: 'New User',
      email: email,
      photoURL: null,
      lastLogin: new Date()
    };

    // This should now SUCCEED
    await expect(setDoc(userDocRef, userData)).resolves.not.toThrow();
    
    // 3. Verify it was created
    const snap = await getDoc(userDocRef);
    expect(snap.exists()).toBe(true);
    expect(snap.data()?.isAdmin).toBeFalsy();
  });

  it('prevents a user from setting isAdmin to true on creation', async () => {
    const email = `hacker-${Date.now()}@example.com`;
    const { user } = await createUserWithEmailAndPassword(auth, email, 'password123');
    
    const userDocRef = doc(db, 'users', user.uid);
    const maliciousData = {
      displayName: 'Hacker',
      email: email,
      isAdmin: true, // Maliciously trying to become admin
      lastLogin: new Date()
    };

    await expect(setDoc(userDocRef, maliciousData)).rejects.toThrow();
  });
});
