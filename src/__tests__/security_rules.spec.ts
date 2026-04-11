import { describe, it, expect, beforeEach } from 'vitest';
import { db, auth } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { 
  clearFirestoreEmulator, 
  clearAuthEmulator, 
  createTestUser, 
  blockUser,
  seedInquiryThread,
  seedTestBreeder
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

  it('prevents unauthorized claim requests (email mismatch)', async () => {
    const ownerEmail = 'owner@example.com';
    const otherEmail = 'other@example.com';
    const slug = 'test-farm';

    await seedTestBreeder(slug, {
      profile: { businessName: 'Test Farm', contactEmail: ownerEmail },
      account: { ownerUid: null, status: 'published' }
    });

    // DEBUG: Verify breeder exists
    const breederSnap = await getDoc(doc(db, 'directory_members', slug));
    console.log('DEBUG Breeder Data:', JSON.stringify(breederSnap.data(), null, 2));
    expect(breederSnap.exists()).toBe(true);
    expect(breederSnap.data()?.profile?.contactEmail).toBe(ownerEmail);

    const otherUser = await createTestUser(otherEmail, 'Other User');
    await signInWithEmailAndPassword(auth, otherEmail, 'password123');

    const claimRef = doc(db, 'claim_requests', slug);
    const claimData = {
      requesterUid: otherUser.uid,
      requesterEmail: otherEmail,
      requesterName: 'Other User',
      requesterPhotoURL: null,
      status: 'pending',
      businessName: 'Test Farm',
      businessSlug: slug,
      createdAt: serverTimestamp()
    };

    // Fails because email doesn't match directory
    await expect(setDoc(claimRef, claimData)).rejects.toThrow(/PERMISSION_DENIED|permission-denied|evaluation error/i);
  });

  it('allows authorized claim requests', async () => {
    const ownerEmail = 'owner@example.com';
    const slug = 'test-farm';

    await seedTestBreeder(slug, {
      profile: { businessName: 'Test Farm', contactEmail: ownerEmail },
      account: { ownerUid: null }
    });

    const ownerUser = await createTestUser(ownerEmail, 'Owner');
    await signInWithEmailAndPassword(auth, ownerEmail, 'password123');

    const claimRef = doc(db, 'claim_requests', slug);
    const claimData = {
      requesterUid: ownerUser.uid,
      requesterEmail: ownerEmail,
      requesterName: 'Owner',
      requesterPhotoURL: null,
      status: 'pending',
      businessName: 'Test Farm',
      businessSlug: slug,
      createdAt: serverTimestamp()
    };

    await expect(setDoc(claimRef, claimData)).resolves.not.toThrow();
  });

  it('prevents strangers from reading someone else\'s claim request', async () => {
    const ownerEmail = 'owner@example.com';
    const strangerEmail = 'stranger@example.com';
    const slug = 'test-farm';

    await seedTestBreeder(slug, {
      profile: { businessName: 'Test Farm', contactEmail: ownerEmail },
      account: { ownerUid: null }
    });

    const ownerUser = await createTestUser(ownerEmail, 'Owner');
    await createTestUser(strangerEmail, 'Stranger');

    // 1. Create claim as owner
    await signInWithEmailAndPassword(auth, ownerEmail, 'password123');
    const claimRef = doc(db, 'claim_requests', slug);
    await setDoc(claimRef, {
      requesterUid: ownerUser.uid,
      requesterEmail: ownerEmail,
      requesterName: 'Owner',
      requesterPhotoURL: null,
      status: 'pending',
      businessName: 'Test Farm',
      businessSlug: slug,
      createdAt: serverTimestamp()
    });

    // 2. Try to read as stranger
    await signOut(auth);
    await signInWithEmailAndPassword(auth, strangerEmail, 'password123');
    await expect(getDoc(claimRef)).rejects.toThrow(/PERMISSION_DENIED|permission-denied|evaluation error/i);
  });
});
