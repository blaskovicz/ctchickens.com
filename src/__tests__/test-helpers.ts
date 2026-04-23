import { auth } from '../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut, 
  updateProfile,
  sendEmailVerification
} from 'firebase/auth';

const PROJECT_ID = () => import.meta.env.VITE_FIREBASE_PROJECT_ID || 'ct-chickens';

/** 
 * Clears Firestore data in the emulator via the REST API.
 */
export async function clearFirestoreEmulator() {
  const projectId = PROJECT_ID();
  const response = await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${projectId}/databases/(default)/documents`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    throw new Error(`Failed to clear Firestore emulator for project: ${projectId}`);
  }
}

/**
 * Clears Auth data in the emulator via the REST API.
 */
export async function clearAuthEmulator() {
  const projectId = PROJECT_ID();
  const response = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${projectId}/accounts`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    throw new Error(`Failed to clear Auth emulator for project: ${projectId}`);
  }
}

/**
 * Seeds a test breeder into Firestore via REST API (bypasses rules for setup).
 */
export async function seedTestBreeder(slug: string, data: any = {}) {
  const projectId = PROJECT_ID();
  const url = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents/directory_members/${slug}`;
  
  const payload = {
    fields: {
      profile: { mapValue: { fields: {
        businessName: { stringValue: data.profile?.businessName || 'Test Farm' },
        town: { stringValue: data.profile?.town || 'Hartford' },
        contactEmail: { stringValue: data.profile?.contactEmail || 'test@example.com' },
        memberType: { stringValue: data.profile?.memberType || 'breeder' },
        website: { stringValue: data.profile?.website || 'https://test.com' }
      }}},
      offerings: { mapValue: { fields: {
        description: { stringValue: data.offerings?.description || 'Test description' },
        searchTags: { arrayValue: { values: (data.offerings?.searchTags || ['eggs']).map((t: string) => ({ stringValue: t })) }}
      }}},
      media: { mapValue: { fields: {
        logoUrl: { stringValue: data.media?.logoUrl || '' },
        galleryUrls: { arrayValue: { values: (data.media?.galleryUrls || []).map((u: string) => ({ stringValue: u })) }}
      }}},
      account: { mapValue: { fields: {
        status: { stringValue: data.account?.status || 'published' },
        isVerified: { booleanValue: data.account?.isVerified ?? true },
        foundingMember: data.account?.foundingMember ? { integerValue: data.account.foundingMember } : { nullValue: null },
        updatedAt: { timestampValue: new Date().toISOString() },
        ownerUid: data.account?.ownerUid ? { stringValue: data.account.ownerUid } : { nullValue: null }
      }}}
    }
  };

  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer owner' 
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to seed breeder: ${err}`);
  }
}

/**
 * Helper to fetch OOB codes from the Auth Emulator.
 */
async function getOobCodes(projectId: string) {
  const url = `http://127.0.0.1:9099/emulator/v1/projects/${projectId}/oobCodes`;
  const res = await fetch(url);
  if (!res.ok) return { oobCodes: [] };
  return res.json();
}

/**
 * Creates a test user and bypasses rules to set Admin status if needed.
 */
export async function createTestUser(email: string, displayName: string, isAdmin: boolean = false) {
  let user;
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, 'password123');
    user = credential.user;
    await updateProfile(user, { displayName });
  } catch (e: any) {
    if (e.code === 'auth/email-already-in-use') {
      const credential = await signInWithEmailAndPassword(auth, email, 'password123');
      user = credential.user;
    } else {
      throw e;
    }
  }
  
  const projectId = PROJECT_ID();
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

  // 1. Verify email directly via emulator REST API
  try {
    const idToken = await user.getIdToken();
    const updateUrl = `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`;
    const verifRes = await fetch(updateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        idToken: idToken,
        emailVerified: true 
      })
    });
    if (!verifRes.ok) {
      console.warn(`Failed to verify email for ${email} directly:`, await verifRes.text());
    }
    await user.reload();
  } catch (e) {
    console.warn(`Failed to verify email for ${email}:`, e);
  }

  // 2. Create the user document in Firestore via REST (bypasses rules)
  const url = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents/users/${user.uid}`;
  const payload = {
    fields: {
      displayName: { stringValue: displayName },
      email: { stringValue: email },
      localEmail: { stringValue: email },
      isAdmin: { booleanValue: isAdmin },
      lastLogin: { timestampValue: new Date().toISOString() }
    }
  };

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer owner'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`Failed to seed user doc: ${await res.text()}`);
  }

  // Force refresh token to pick up the verified claim
  await user.getIdToken(true);

  return user;
}

/**
 * Seeds a claim request via REST API.
 */
export async function seedClaimRequest(slug: string, data: any) {
  const projectId = PROJECT_ID();
  const url = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents/claim_requests/${slug}`;
  
  const payload = {
    fields: {
      businessName: { stringValue: data.businessName },
      businessSlug: { stringValue: data.businessSlug },
      requesterUid: { stringValue: data.requesterUid },
      requesterEmail: { stringValue: data.requesterEmail },
      requesterName: { stringValue: data.requesterName || 'Test User' },
      status: { stringValue: data.status || 'pending' },
      createdAt: { timestampValue: data.createdAt || new Date().toISOString() }
    }
  };

  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer owner' 
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to seed claim request: ${err}`);
  }
}

/**
 * Seeds a draft profile via REST API.
 */
export async function seedDraftProfile(slug: string, data: any) {
  const projectId = PROJECT_ID();
  const url = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents/draft_profiles/${slug}`;
  
  const payload = {
    fields: {
      profile: { mapValue: { fields: {
        businessName: { stringValue: data.profile?.businessName || '' },
        town: { stringValue: data.profile?.town || '' },
        contactEmail: { stringValue: data.profile?.contactEmail || '' },
        memberType: { stringValue: data.profile?.memberType || 'breeder' }
      }}},
      offerings: { mapValue: { fields: {
        description: { stringValue: data.offerings?.description || '' },
        searchTags: { arrayValue: { values: (data.offerings?.searchTags || []).map((t: string) => ({ stringValue: t })) }}
      }}},
      media: { mapValue: { fields: {
        logoUrl: { stringValue: data.media?.logoUrl || '' },
        galleryUrls: { arrayValue: { values: (data.media?.galleryUrls || []).map((u: string) => ({ stringValue: u })) }}
      }}},
      draft_owner_uid: { stringValue: data.draft_owner_uid },
      updatedAt: { timestampValue: new Date().toISOString() }
    }
  };

  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer owner' 
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to seed draft profile: ${err}`);
  }
  }

  export async function seedInquiryThread(threadId: string, data: any) {
  const projectId = PROJECT_ID();
  const url = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents/inquiry_threads/${threadId}`;

  const payload = {
    fields: {
      participants: { arrayValue: { values: data.participants.map((p: string) => ({ stringValue: p })) }},
      type: { stringValue: data.type || 'inquiry' },
      userUid: { stringValue: data.userUid },
      breederSlug: { stringValue: data.breederSlug },
      breederName: { stringValue: data.breederName },
      lastMessage: { stringValue: data.lastMessage || '' },
      updatedAt: { timestampValue: data.updatedAt || new Date().toISOString() },
      unreadCount: { mapValue: { fields: Object.fromEntries(
        Object.entries(data.unreadCount || {}).map(([k, v]) => [k, { integerValue: v }])
      )}}
    }
  };

  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer owner' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error(`Failed to seed inquiry thread: ${await response.text()}`);
  }

  /**
  * Seeds an inquiry message via REST API.
  */
  export async function seedInquiryMessage(threadId: string, messageId: string, data: any) {
  const projectId = PROJECT_ID();
  const url = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents/inquiry_threads/${threadId}/messages/${messageId}`;

  const payload = {
    fields: {
      senderUid: { stringValue: data.senderUid },
      text: { stringValue: data.text },
      createdAt: { timestampValue: data.createdAt || new Date().toISOString() },
      read: { booleanValue: data.read ?? false },
      flaggedByUid: data.flaggedByUid ? { stringValue: data.flaggedByUid } : { nullValue: null },
      adminReviewStatus: data.adminReviewStatus ? { stringValue: data.adminReviewStatus } : { nullValue: null }
    }
  };

  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer owner' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error(`Failed to seed inquiry message: ${await response.text()}`);
  }

  /**
  * Blocks a user via REST API (updates their user doc).
  */
  export async function blockUser(uid: string, blocked: boolean = true) {
  const projectId = PROJECT_ID();
  const url = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`;

  // Use mask to only update blockedFromChat
  const updateUrl = `${url}?updateMask.fieldPaths=blockedFromChat`;

  const payload = {
    fields: {
      blockedFromChat: { booleanValue: blocked }
    }
  };

  const response = await fetch(updateUrl, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer owner' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error(`Failed to block user: ${await response.text()}`);
  }

  /**
  * Logs out the current user.
  */

export async function logout() {
  await signOut(auth);
}
