import { db, auth } from '../firebase';
import { 
  doc, setDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut, 
  updateProfile
} from 'firebase/auth';

const PROJECT_ID = () => import.meta.env.VITE_FIREBASE_PROJECT_ID;

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

  // 1. Set verified email in Auth Emulator (required for claims)
  // Use the EMULATOR-SPECIFIC endpoint which allows updating verified status directly
  const authUrl = `http://127.0.0.1:9099/emulator/v1/projects/${projectId}/accounts/${user.uid}`;
  const authRes = await fetch(authUrl, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      emailVerified: true 
    })
  });
  
  if (!authRes.ok) {
    console.warn(`Failed to verify email via emulator PATCH: ${await authRes.text()}`);
  } else {
    console.log(`Successfully verified email for ${email} via emulator PATCH`);
  }

  // 2. Create the user document in Firestore via REST (bypasses rules)
  const url = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents/users/${user.uid}`;
  const payload = {
    fields: {
      displayName: { stringValue: displayName },
      email: { stringValue: email },
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

/**
 * Logs out the current user.
 */
export async function logout() {
  await signOut(auth);
}
