import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, auth } from '../../firebase';
import { 
  signInWithEmailAndPassword
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, serverTimestamp,
  runTransaction, collection, getDocs,
  query, where, updateDoc, writeBatch
} from 'firebase/firestore';
import {
  clearFirestoreEmulator,
  clearAuthEmulator,
  createTestUser,
  seedTestBreeder,
  seedInquiryThread,
  seedInquiryMessage,
  logout
} from '../test-helpers';
import store from '../../store';
import InboxView from '../../views/InboxView.vue';
import { createRouter, createWebHistory } from 'vue-router';

// Mock Router
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/inbox/:threadId?', name: 'inbox', component: InboxView },
    { path: '/directory/:slug', name: 'breeder-profile', component: { template: '<div>Profile</div>' } }
  ]
});

describe('Chat System Integration', () => {
  beforeEach(async () => {
    await clearFirestoreEmulator();
    await clearAuthEmulator();
    await logout();
    store.commit('SET_USER', null);
    store.commit('SET_USER_DATA', null);
    store.commit('SET_BREEDERS', []);
    store.commit('SET_MY_DRAFTS', []);
    document.body.innerHTML = '';
  });

  it('User to Farm: creates a thread and both sides can see/reply', async () => {
    // 1. Setup Users
    const buyerEmail = 'buyer@example.com';
    const sellerEmail = 'seller@example.com';
    await createTestUser(buyerEmail, 'Buyer Bob');
    const sellerUser = await createTestUser(sellerEmail, 'Seller Sue');
    const slug = 'test-farm';
    
    // 2. Setup Farm
    await seedTestBreeder(slug, {
      profile: { businessName: 'Test Farm' },
      account: { ownerUid: sellerUser.uid, isVerified: true }
    });

    // 3. Buyer sends an inquiry (Directly using setDoc for stability in test)
    const buyer = (await signInWithEmailAndPassword(auth, buyerEmail, 'password123')).user;
    const threadId = `${buyer.uid}_${slug}`;
    await setDoc(doc(db, 'inquiry_threads', threadId), {
      participants: [buyer.uid, sellerUser.uid],
      type: 'inquiry',
      userUid: buyer.uid,
      userName: 'Buyer Bob',
      breederSlug: slug,
      breederName: 'Test Farm',
      lastMessage: 'Hi seller!',
      updatedAt: serverTimestamp(),
      unreadCount: { [sellerUser.uid]: 1 }
    });

    // 4. Verify Thread exists
    const threadDoc = await getDoc(doc(db, 'inquiry_threads', threadId));
    expect(threadDoc.exists()).toBe(true);

    // 5. Seller logs in and sees it
    await logout();
    const seller = (await signInWithEmailAndPassword(auth, sellerEmail, 'password123')).user;
    store.commit('SET_USER', seller);
    store.commit('SET_USER_DATA', { isAdmin: false });
    await store.dispatch('fetchDirectory'); // Required for ownedSlugs
    
    const inboxWrapper = mount(InboxView, {
      global: { plugins: [store, router] }
    });
    
    await flushPromises();
    await new Promise(r => setTimeout(r, 2000));
    await flushPromises();

    // Formatting helper makes "Buyer Bob" -> "Buyer B."
    expect(inboxWrapper.text()).toContain('Buyer B.');
    expect(inboxWrapper.text()).toContain('Hi seller!');

    inboxWrapper.unmount();
  }, 40000);

  it('Support Chat: User can contact support and Admin can see/reply', async () => {
    const userEmail = `support-user-${Date.now()}@example.com`;
    const adminEmail = `admin-${Date.now()}@ctchickens.com`;
    const displayName = 'Support User';
    await createTestUser(userEmail, displayName);
    await createTestUser(adminEmail, 'Admin Zach', true);

    // 1. User opens inbox and clicks Support — routes to support_new (no thread created yet)
    const user = (await signInWithEmailAndPassword(auth, userEmail, 'password123')).user;
    store.commit('SET_USER', user);
    store.commit('SET_USER_DATA', { isAdmin: false });

    const userInbox = mount(InboxView, {
      global: { plugins: [store, router] }
    });
    await flushPromises();
    await new Promise(r => setTimeout(r, 1000));

    const supportBtn = userInbox.find('[data-testid="support-btn"]');
    await supportBtn.trigger('click');
    await flushPromises();

    // Thread must NOT exist yet — creation is deferred to first message
    const threadId = `support_${user.uid}`;
    const beforeDoc = await getDoc(doc(db, 'inquiry_threads', threadId));
    expect(beforeDoc.exists()).toBe(false);

    // 2. User types and sends their first message — this creates the thread atomically
    await new Promise(r => setTimeout(r, 500));
    const textarea = userInbox.find('textarea');
    await textarea.setValue('Hello, I need help with my listing.');
    await textarea.trigger('keyup.enter');
    await flushPromises();
    await new Promise(r => setTimeout(r, 2000));

    const threadDoc = await getDoc(doc(db, 'inquiry_threads', threadId));
    expect(threadDoc.exists()).toBe(true);
    expect(threadDoc.data()?.lastMessage).toContain('Hello, I need help');

    // 3. Admin logs in and sees the thread with the actual message
    await logout();
    const admin = (await signInWithEmailAndPassword(auth, adminEmail, 'password123')).user;
    store.commit('SET_USER', admin);
    store.commit('SET_USER_DATA', { isAdmin: true });

    const adminInbox = mount(InboxView, {
      global: { plugins: [store, router] }
    });
    await flushPromises();
    await new Promise(r => setTimeout(r, 2000));
    await flushPromises();

    expect(adminInbox.text()).toContain('Support U.');
    expect(adminInbox.text()).toContain('Hello, I need help with my listing.');

    userInbox.unmount();
    adminInbox.unmount();
  }, 40000);

  // ---------------------------------------------------------------------------
  // Scenario 1: Unclaimed farm — full round-trip through admin
  // ---------------------------------------------------------------------------
  it('Unclaimed Farm: buyer sends via transaction → admin sees & replies → buyer sees reply', async () => {
    const buyerUser  = await createTestUser('buyer-unc@test.com', 'Buyer Alice');
    await createTestUser('admin-unc@test.com', 'Admin Zach', true);
    const slug = 'goose-creek-farm';

    await seedTestBreeder(slug, {
      profile: { businessName: 'Goose Creek Farm' },
      account: { ownerUid: null, isVerified: true }
    });

    // 1. Buyer sends via runTransaction — this is the exact path InquiryModal uses.
    //    The transaction.get on a non-existent thread verifies the resource==null fix.
    await signInWithEmailAndPassword(auth, 'buyer-unc@test.com', 'password123');
    const threadId   = `${buyerUser.uid}_${slug}`;
    const threadRef  = doc(db, 'inquiry_threads', threadId);
    const msgsCol    = collection(db, 'inquiry_threads', threadId, 'messages');

    await runTransaction(db, async (tx) => {
      const threadDoc = await tx.get(threadRef); // would have thrown before resource==null fix
      if (!threadDoc.exists()) {
        tx.set(threadRef, {
          participants:  [buyerUser.uid, 'admin'],
          type:          'inquiry',
          userUid:       buyerUser.uid,
          userName:      'Buyer Alice',
          breederSlug:   slug,
          breederName:   'Goose Creek Farm',
          lastMessage:   'Do you have chicks available?',
          updatedAt:     serverTimestamp(),
          unreadCount:   { admin: 1 }
        });
      }
      tx.set(doc(msgsCol), {
        senderUid:  buyerUser.uid,
        text:       'Do you have chicks available?',
        createdAt:  serverTimestamp(),
        read:       false
      });
    });

    // 2. Admin queries threads — should find it via 'admin' in participants
    await logout();
    const admin = (await signInWithEmailAndPassword(auth, 'admin-unc@test.com', 'password123')).user;

    const adminQ    = query(collection(db, 'inquiry_threads'), where('participants', 'array-contains', 'admin'));
    const adminSnap = await getDocs(adminQ);
    expect(adminSnap.size).toBe(1);

    const msgsSnap = await getDocs(collection(db, 'inquiry_threads', threadId, 'messages'));
    expect(msgsSnap.size).toBe(1);
    expect(msgsSnap.docs[0]!.data().text).toBe('Do you have chicks available?');

    // 3. Admin replies
    await runTransaction(db, async (tx) => {
      const threadDoc    = await tx.get(threadRef);
      const currentUnread = threadDoc.data()?.unreadCount?.[buyerUser.uid] || 0;
      tx.update(threadRef, {
        lastMessage:                          'Yes, pullets ready in 3 weeks.',
        updatedAt:                            serverTimestamp(),
        [`unreadCount.${buyerUser.uid}`]:     currentUnread + 1
      });
      tx.set(doc(msgsCol), {
        senderUid:  admin.uid,
        text:       'Yes, pullets ready in 3 weeks.',
        createdAt:  serverTimestamp(),
        read:       false
      });
    });

    // 4. Buyer logs back in and can see the admin reply
    await logout();
    await signInWithEmailAndPassword(auth, 'buyer-unc@test.com', 'password123');

    const buyerMsgs = await getDocs(collection(db, 'inquiry_threads', threadId, 'messages'));
    expect(buyerMsgs.size).toBe(2);
    expect(buyerMsgs.docs.map(d => d.data().text)).toContain('Yes, pullets ready in 3 weeks.');
  }, 30000);

  // ---------------------------------------------------------------------------
  // Scenario 2: Claim handoff — admin thread transitions to farm owner
  // ---------------------------------------------------------------------------
  it('Claim Handoff: admin loses thread visibility, new owner inherits and can reply', async () => {
    const buyerUser = await createTestUser('buyer-ho@test.com', 'Buyer Beth');
    await createTestUser('admin-ho@test.com', 'Admin Zach', true);
    const ownerUser = await createTestUser('owner-ho@test.com', 'New Owner');
    const slug = 'sunny-ridge-farm';

    await seedTestBreeder(slug, {
      profile: { businessName: 'Sunny Ridge Farm' },
      account: { ownerUid: null, isVerified: true }
    });

    // 1. Seed an existing unclaimed-farm thread (buyer already messaged)
    const threadId  = `${buyerUser.uid}_${slug}`;
    const threadRef = doc(db, 'inquiry_threads', threadId);
    const msgsCol   = collection(db, 'inquiry_threads', threadId, 'messages');

    await seedInquiryThread(threadId, {
      participants: [buyerUser.uid, 'admin'],
      type:         'inquiry',
      userUid:      buyerUser.uid,
      userName:     'Buyer Beth',
      breederSlug:  slug,
      breederName:  'Sunny Ridge Farm',
      lastMessage:  'Is this farm active?',
      unreadCount:  { admin: 1 }
    });
    await seedInquiryMessage(threadId, 'msg1', {
      senderUid: buyerUser.uid,
      text:      'Is this farm active?'
    });

    // 2. Admin can see thread before handoff
    await signInWithEmailAndPassword(auth, 'admin-ho@test.com', 'password123');

    const beforeQ = query(collection(db, 'inquiry_threads'), where('participants', 'array-contains', 'admin'));
    expect((await getDocs(beforeQ)).size).toBe(1);

    // 3. Simulate handleApprove: update ownerUid + swap 'admin' out of participants
    await updateDoc(doc(db, 'directory_members', slug), {
      'account.ownerUid':    ownerUser.uid,
      'account.updatedAt':   serverTimestamp()
    });
    const handoffBatch = writeBatch(db);
    handoffBatch.update(threadRef, { participants: [buyerUser.uid, ownerUser.uid] });
    await handoffBatch.commit();

    // 4. Admin can no longer find the thread via the 'admin' participant query
    const afterAdminQ = query(collection(db, 'inquiry_threads'), where('participants', 'array-contains', 'admin'));
    expect((await getDocs(afterAdminQ)).size).toBe(0);

    // 5. New owner logs in and finds the thread via their own UID
    await logout();
    await signInWithEmailAndPassword(auth, 'owner-ho@test.com', 'password123');

    const ownerQ    = query(collection(db, 'inquiry_threads'), where('participants', 'array-contains', ownerUser.uid));
    const ownerSnap = await getDocs(ownerQ);
    expect(ownerSnap.size).toBe(1);
    expect(ownerSnap.docs[0]!.data().lastMessage).toBe('Is this farm active?');

    // Owner can read the original message
    const ownerMsgs = await getDocs(msgsCol);
    expect(ownerMsgs.size).toBe(1);
    expect(ownerMsgs.docs[0]!.data().text).toBe('Is this farm active?');

    // 6. Owner replies
    await runTransaction(db, async (tx) => {
      const threadDoc     = await tx.get(threadRef);
      const currentUnread  = threadDoc.data()?.unreadCount?.[buyerUser.uid] || 0;
      tx.update(threadRef, {
        lastMessage:                         'Yes, very much active!',
        updatedAt:                           serverTimestamp(),
        [`unreadCount.${buyerUser.uid}`]:    currentUnread + 1
      });
      tx.set(doc(msgsCol), {
        senderUid:  ownerUser.uid,
        text:       'Yes, very much active!',
        createdAt:  serverTimestamp(),
        read:       false
      });
    });

    // 7. Buyer logs in and sees owner's reply
    await logout();
    await signInWithEmailAndPassword(auth, 'buyer-ho@test.com', 'password123');

    const buyerMsgs = await getDocs(msgsCol);
    expect(buyerMsgs.size).toBe(2);
    expect(buyerMsgs.docs.map(d => d.data().text)).toContain('Yes, very much active!');
  }, 30000);

  // ---------------------------------------------------------------------------
  // Scenario 3: Already-claimed farm — direct buyer ↔ owner round-trip
  // ---------------------------------------------------------------------------
  it('Claimed Farm: owner sees buyer message, replies, buyer sees reply', async () => {
    const buyerUser = await createTestUser('buyer-cl@test.com', 'Buyer Carol');
    const ownerUser = await createTestUser('owner-cl@test.com', 'Farm Owner Carol');
    const slug = 'maple-hollow-farm';

    await seedTestBreeder(slug, {
      profile: { businessName: 'Maple Hollow Farm' },
      account: { ownerUid: ownerUser.uid, isVerified: true }
    });

    // 1. Buyer sends via runTransaction (farm is already claimed)
    await signInWithEmailAndPassword(auth, 'buyer-cl@test.com', 'password123');
    const threadId  = `${buyerUser.uid}_${slug}`;
    const threadRef = doc(db, 'inquiry_threads', threadId);
    const msgsCol   = collection(db, 'inquiry_threads', threadId, 'messages');

    await runTransaction(db, async (tx) => {
      const threadDoc = await tx.get(threadRef);
      if (!threadDoc.exists()) {
        tx.set(threadRef, {
          participants:  [buyerUser.uid, ownerUser.uid],
          type:          'inquiry',
          userUid:       buyerUser.uid,
          userName:      'Buyer Carol',
          breederSlug:   slug,
          breederName:   'Maple Hollow Farm',
          lastMessage:   'Any Silkies available?',
          updatedAt:     serverTimestamp(),
          unreadCount:   { [ownerUser.uid]: 1 }
        });
      }
      tx.set(doc(msgsCol), {
        senderUid:  buyerUser.uid,
        text:       'Any Silkies available?',
        createdAt:  serverTimestamp(),
        read:       false
      });
    });

    // 2. Owner finds the thread via their UID and reads the message
    await logout();
    await signInWithEmailAndPassword(auth, 'owner-cl@test.com', 'password123');

    const ownerQ    = query(collection(db, 'inquiry_threads'), where('participants', 'array-contains', ownerUser.uid));
    const ownerSnap = await getDocs(ownerQ);
    expect(ownerSnap.size).toBe(1);

    const ownerMsgs = await getDocs(msgsCol);
    expect(ownerMsgs.size).toBe(1);
    expect(ownerMsgs.docs[0]!.data().text).toBe('Any Silkies available?');

    // 3. Owner replies
    await runTransaction(db, async (tx) => {
      const threadDoc     = await tx.get(threadRef);
      const currentUnread  = threadDoc.data()?.unreadCount?.[buyerUser.uid] || 0;
      tx.update(threadRef, {
        lastMessage:                         'We have 3 Silkie hens ready.',
        updatedAt:                           serverTimestamp(),
        [`unreadCount.${buyerUser.uid}`]:    currentUnread + 1
      });
      tx.set(doc(msgsCol), {
        senderUid:  ownerUser.uid,
        text:       'We have 3 Silkie hens ready.',
        createdAt:  serverTimestamp(),
        read:       false
      });
    });

    // 4. Buyer logs back in and sees the owner's reply
    await logout();
    await signInWithEmailAndPassword(auth, 'buyer-cl@test.com', 'password123');

    const buyerMsgs = await getDocs(msgsCol);
    expect(buyerMsgs.size).toBe(2);
    expect(buyerMsgs.docs.map(d => d.data().text)).toContain('We have 3 Silkie hens ready.');
  }, 30000);

  // ---------------------------------------------------------------------------
  // Scenario 4: Message flagging → admin hides → hidden status visible
  // ---------------------------------------------------------------------------
  it('Flagging: participant flags message → admin marks hidden → sender sees hidden status', async () => {
    const buyerUser = await createTestUser('buyer-flag@test.com', 'Buyer Flag');
    const ownerUser = await createTestUser('owner-flag@test.com', 'Owner Flag');
    await createTestUser('admin-flag@test.com', 'Admin Flag', true);
    const slug = 'flag-test-farm';

    await seedTestBreeder(slug, {
      profile: { businessName: 'Flag Test Farm' },
      account: { ownerUid: ownerUser.uid, isVerified: true }
    });

    const threadId = `${buyerUser.uid}_${slug}`;
    await seedInquiryThread(threadId, {
      participants: [buyerUser.uid, ownerUser.uid],
      type:         'inquiry',
      userUid:      buyerUser.uid,
      userName:     'Buyer Flag',
      breederSlug:  slug,
      breederName:  'Flag Test Farm',
      lastMessage:  'Offensive message',
      unreadCount:  { [ownerUser.uid]: 1 }
    });
    await seedInquiryMessage(threadId, 'flagged-msg', {
      senderUid: buyerUser.uid,
      text:      'Offensive message'
    });

    const msgRef = doc(db, 'inquiry_threads', threadId, 'messages', 'flagged-msg');

    // 1. Farm owner flags the buyer's message (only flaggedByUid + adminReviewStatus may change)
    await signInWithEmailAndPassword(auth, 'owner-flag@test.com', 'password123');
    await updateDoc(msgRef, { flaggedByUid: ownerUser.uid, adminReviewStatus: 'pending' });

    // 2. Admin sees the pending flag and marks it hidden
    await logout();
    await signInWithEmailAndPassword(auth, 'admin-flag@test.com', 'password123');

    const pendingSnap = await getDoc(msgRef);
    expect(pendingSnap.data()?.adminReviewStatus).toBe('pending');

    await updateDoc(msgRef, { adminReviewStatus: 'hidden' });

    // 3. Buyer reads the message — doc is still accessible (rules don't delete it),
    //    adminReviewStatus is 'hidden' so the UI renders "[removed]" instead of the text
    await logout();
    await signInWithEmailAndPassword(auth, 'buyer-flag@test.com', 'password123');

    const hiddenSnap = await getDoc(msgRef);
    expect(hiddenSnap.data()?.adminReviewStatus).toBe('hidden');
    expect(hiddenSnap.data()?.text).toBe('Offensive message'); // text preserved, UI hides it
  }, 20000);

  // ---------------------------------------------------------------------------
  // Security: third-party cannot enumerate threads
  // ---------------------------------------------------------------------------
  it('Security: non-participant cannot enumerate all inquiry threads', async () => {
    const buyerUser    = await createTestUser('buyer-sec@test.com', 'Buyer Sec');
    const ownerUser    = await createTestUser('owner-sec@test.com', 'Owner Sec');
    const strangerUser = await createTestUser('stranger-sec@test.com', 'Stranger Sec');
    const slug = 'sec-test-farm';

    await seedTestBreeder(slug, {
      profile: { businessName: 'Sec Test Farm' },
      account: { ownerUid: ownerUser.uid, isVerified: true }
    });

    // Seed a private thread between buyer and owner (stranger is NOT a participant)
    await seedInquiryThread(`${buyerUser.uid}_${slug}`, {
      participants: [buyerUser.uid, ownerUser.uid],
      type:         'inquiry',
      userUid:      buyerUser.uid,
      userName:     'Buyer Sec',
      breederSlug:  slug,
      breederName:  'Sec Test Farm',
      lastMessage:  'Secret inquiry',
      unreadCount:  { [ownerUser.uid]: 1 }
    });

    // Stranger logs in and tries to dump the entire collection — must be denied
    await signInWithEmailAndPassword(auth, 'stranger-sec@test.com', 'password123');
    await expect(getDocs(collection(db, 'inquiry_threads'))).rejects.toThrow(/permission-denied|insufficient|false for 'list'/i);

    // Stranger filtering by their own UID should return nothing (not an error, just empty)
    const ownQ = query(
      collection(db, 'inquiry_threads'),
      where('participants', 'array-contains', strangerUser.uid)
    );
    const snap = await getDocs(ownQ);
    expect(snap.size).toBe(0);
  }, 20000);

  // ---------------------------------------------------------------------------
  // (original) Claiming Persistence
  // ---------------------------------------------------------------------------
  it('Claiming Persistence: History is visible to new owner after claiming', async () => {
    const buyerEmail = 'buyer2@example.com';
    const newOwnerEmail = 'owner2@example.com';
    await createTestUser(buyerEmail, 'Buyer Two');
    const newOwnerUser = await createTestUser(newOwnerEmail, 'New Owner');
    const slug = 'unclaimed-farm';

    await seedTestBreeder(slug, {
      profile: { businessName: 'Unclaimed Farm' },
      account: { ownerUid: null, isVerified: true }
    });

    // 1. Buyer sends message to unclaimed farm
    const buyer = (await signInWithEmailAndPassword(auth, buyerEmail, 'password123')).user;
    const threadId = `${buyer.uid}_${slug}`;
    const threadRef = doc(db, 'inquiry_threads', threadId);
    await setDoc(threadRef, {
      participants: [buyer.uid, 'admin'],
      type: 'inquiry',
      userUid: buyer.uid,
      userName: 'Buyer Two',
      breederSlug: slug,
      breederName: 'Unclaimed Farm',
      lastMessage: 'Hello legacy',
      updatedAt: serverTimestamp(),
      unreadCount: { 'admin': 1 }
    });

    // 2. New Owner claims the farm
    await seedTestBreeder(slug, {
      profile: { businessName: 'Unclaimed Farm' },
      account: { ownerUid: newOwnerUser.uid, isVerified: true }
    });

    // 3. New Owner logs in and checks inbox
    await logout();
    const owner = (await signInWithEmailAndPassword(auth, newOwnerEmail, 'password123')).user;
    store.commit('SET_USER', owner);
    store.commit('SET_USER_DATA', { isAdmin: false });
    await store.dispatch('fetchDirectory'); 
    
    const ownerInbox = mount(InboxView, {
      global: { plugins: [store, router] }
    });
    await flushPromises();
    await new Promise(r => setTimeout(r, 2000));
    await flushPromises();

    expect(ownerInbox.text()).toContain('Buyer T.');
    expect(ownerInbox.text()).toContain('Hello legacy');

    ownerInbox.unmount();
  }, 40000);
});
