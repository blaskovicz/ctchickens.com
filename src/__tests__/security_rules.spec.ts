import { describe, it, expect, beforeEach } from 'vitest';
import { db, auth } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { 
  clearFirestoreEmulator, 
  clearAuthEmulator, 
  createTestUser, 
  blockUser,
  seedInquiryThread
} from './test-helpers';

describe('Security Rules: Users Collection', () => {
  beforeEach(async () => {
    await clearFirestoreEmulator();
    await clearAuthEmulator();
    await signOut(auth);
  });

  it('successfully creates a new user document (fix for broken login)', async () => {
    const email = `newuser-${Date.now()}@example.com`;
    const { user } = await createUserWithEmailAndPassword(auth, email, 'password123');
    const userDocRef = doc(db, 'users', user.uid);
    const userData = {
      displayName: 'New User',
      email: email,
      photoURL: null,
      lastLogin: new Date()
    };
    await expect(setDoc(userDocRef, userData)).resolves.not.toThrow();
  });

  it('prevents a user from setting isAdmin to true on creation', async () => {
    const email = `hacker-${Date.now()}@example.com`;
    const { user } = await createUserWithEmailAndPassword(auth, email, 'password123');
    const userDocRef = doc(db, 'users', user.uid);
    const maliciousData = {
      displayName: 'Hacker',
      email: email,
      isAdmin: true,
      lastLogin: new Date()
    };
    await expect(setDoc(userDocRef, maliciousData)).rejects.toThrow();
  });
});

describe('Security Rules: Draft Profiles', () => {
  beforeEach(async () => {
    await clearFirestoreEmulator();
    await clearAuthEmulator();
  });

  it('allows owner to update and delete their own draft', async () => {
    const email = 'owner@example.com';
    const user = await createTestUser(email, 'Owner');
    await signInWithEmailAndPassword(auth, email, 'password123');

    const draftRef = doc(db, 'draft_profiles', 'test-slug');
    const draftData = {
      profile: { businessName: 'Test', town: 'Storrs', memberType: 'farm', contactEmail: email, website: '' },
      offerings: { description: '', searchTags: [] },
      media: { logoUrl: null, galleryUrls: [] },
      draft_owner_uid: user.uid,
      updatedAt: serverTimestamp()
    };

    // Create
    await setDoc(draftRef, draftData);
    
    // Update
    const updatedData = { ...draftData, profile: { ...draftData.profile, town: 'Mansfield' } };
    await expect(setDoc(draftRef, updatedData)).resolves.not.toThrow();

    // Delete
    await expect(deleteDoc(draftRef)).resolves.not.toThrow();
  });

  it('rejects draft with invalid schema (missing fields)', async () => {
    const email = 'owner@example.com';
    const user = await createTestUser(email, 'Owner');
    await signInWithEmailAndPassword(auth, email, 'password123');

    const draftRef = doc(db, 'draft_profiles', 'bad-schema');
    const invalidData = {
      profile: { businessName: 'Bad' },
      draft_owner_uid: user.uid
      // missing offerings, media, updatedAt
    };

    await expect(setDoc(draftRef, invalidData)).rejects.toThrow(/PERMISSION_DENIED|permission-denied/i);
  });
});

describe('Security Rules: Blocked Users', () => {
  beforeEach(async () => {
    await clearFirestoreEmulator();
    await clearAuthEmulator();
  });

  it('prevents blocked user from creating an inquiry thread', async () => {
    const email = 'blocked@example.com';
    const user = await createTestUser(email, 'Blocked User');
    await blockUser(user.uid, true);
    await signInWithEmailAndPassword(auth, email, 'password123');

    const threadRef = doc(db, 'inquiry_threads', 'blocked_thread');
    const threadData = {
      participants: [user.uid, 'admin'],
      userUid: user.uid,
      breederSlug: 'some-farm',
      breederName: 'Some Farm',
      lastMessage: 'Hello',
      updatedAt: serverTimestamp(),
      unreadCount: { admin: 1 }
    };

    await expect(setDoc(threadRef, threadData)).rejects.toThrow(/PERMISSION_DENIED|permission-denied/i);
  });

  it('prevents blocked user from sending a message', async () => {
    const email = 'blocked@example.com';
    const user = await createTestUser(email, 'Blocked User');
    
    // 1. Create thread while NOT blocked (or via seed)
    const threadId = 'test_thread';
    await seedInquiryThread(threadId, {
      participants: [user.uid, 'admin'],
      userUid: user.uid,
      breederSlug: 'farm',
      breederName: 'Farm'
    });

    // 2. Block the user
    await blockUser(user.uid, true);
    await signInWithEmailAndPassword(auth, email, 'password123');

    const msgRef = doc(db, 'inquiry_threads', threadId, 'messages', 'msg1');
    const msgData = {
      senderUid: user.uid,
      text: 'I am blocked',
      createdAt: serverTimestamp(),
      read: false
    };

    await expect(setDoc(msgRef, msgData)).rejects.toThrow(/PERMISSION_DENIED|permission-denied/i);
  });
});

describe('Security Rules: Claim Requests', () => {
  beforeEach(async () => {
    await clearFirestoreEmulator();
    await clearAuthEmulator();
  });

  it('prevents strangers from reading a claim request', async () => {
    const requesterEmail = 'requester@example.com';
    const strangerEmail = 'stranger@example.com';
    
    const requester = await createTestUser(requesterEmail, 'Requester');
    await createTestUser(strangerEmail, 'Stranger');

    // 1. Create claim as requester
    await signInWithEmailAndPassword(auth, requesterEmail, 'password123');
    const claimRef = doc(db, 'claim_requests', 'farm-slug');
    await setDoc(claimRef, {
      requesterUid: requester.uid,
      businessSlug: 'farm-slug',
      status: 'pending'
    });

    // 2. Try to read as stranger
    await signOut(auth);
    await signInWithEmailAndPassword(auth, strangerEmail, 'password123');
    await expect(getDoc(claimRef)).rejects.toThrow(/PERMISSION_DENIED|permission-denied|evaluation error/i);
  });
});
