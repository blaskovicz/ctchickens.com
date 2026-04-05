import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import store from '../../store';
import { auth } from '../../firebase';
import { getRedirectResult, onAuthStateChanged } from 'firebase/auth';

// Mock firebase/auth
vi.mock('firebase/auth', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    getRedirectResult: vi.fn(),
    onAuthStateChanged: vi.fn(),
  };
});

// Mock firestore to avoid actual network calls
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    getDoc: vi.fn(() => Promise.resolve({ exists: () => false })),
    getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
    setDoc: vi.fn(() => Promise.resolve()),
    doc: vi.fn(),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn(),
  };
});

describe('initAuth Integration Test', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore
    delete window.location;
    (window as any).location = { ...originalLocation, href: 'http://localhost/' };
    
    // Reset store state
    store.commit('SET_USER', null);
    store.commit('SET_USER_DATA', null);
    store.commit('SET_AUTH_READY', false);
  });

  afterEach(() => {
    (window as any).location = originalLocation;
  });

  it('settles auth state correctly when redirect is detected', async () => {
    // 1. Simulate a redirect URL
    const redirectUrl = 'http://localhost/?__firebase_request_key=123';
    // @ts-ignore
    window.location.href = redirectUrl;

    const mockUser = {
      uid: 'test-uid',
      displayName: 'Test User',
      email: 'test@example.com',
      photoURL: 'http://example.com/photo.jpg',
      providerData: [{ providerId: 'facebook.com', uid: 'fb-123' }]
    };

    // 2. Mock getRedirectResult to return a user (eventually)
    (getRedirectResult as any).mockResolvedValueOnce({ user: mockUser });

    // 3. Mock onAuthStateChanged to simulate the session settling
    // It should fire with the user AFTER the redirect logic has started
    (onAuthStateChanged as any).mockImplementation((_auth: any, callback: any) => {
      // Simulate the SDK firing the state change
      setTimeout(() => callback(mockUser), 50);
      return () => {}; // Unsubscribe
    });

    // 4. Dispatch initAuth
    const initPromise = store.dispatch('initAuth');

    // Initially should not be ready
    expect(store.state.authReady).toBe(false);

    await initPromise;

    // 5. Verify results
    expect(store.state.user).toEqual(mockUser);
    expect(store.state.authReady).toBe(true);
    expect(getRedirectResult).toHaveBeenCalledWith(auth);
    console.log('✅ initAuth settled correctly with redirect params');
  });

  it('settles auth state correctly when NO redirect is detected (cold start)', async () => {
    // 1. Normal URL
    // @ts-ignore
    window.location.href = 'http://localhost/';

    (getRedirectResult as any).mockResolvedValueOnce(null);

    (onAuthStateChanged as any).mockImplementation((_auth: any, callback: any) => {
      // No session
      setTimeout(() => callback(null), 50);
      return () => {};
    });

    await store.dispatch('initAuth');

    expect(store.state.user).toBeNull();
    expect(store.state.authReady).toBe(true);
    console.log('✅ initAuth settled correctly for anonymous cold start');
  });

  it('waits for session to settle if redirect params are present but user is initially null', async () => {
    const redirectUrl = 'http://localhost/?code=abc';
    // @ts-ignore
    window.location.href = redirectUrl;

    (getRedirectResult as any).mockResolvedValueOnce({ user: null }); // Result might be null initially

    let callbackCount = 0;
    (onAuthStateChanged as any).mockImplementation((_auth: any, callback: any) => {
      // First call: null (SDK still initializing)
      setTimeout(() => {
        callbackCount++;
        callback(null);
        
        // Second call: user (SDK finally processed the redirect or recovered session)
        setTimeout(() => {
          callbackCount++;
          callback({ uid: 'late-uid' });
        }, 100);
      }, 50);
      return () => {};
    });

    await store.dispatch('initAuth');

    expect(store.state.user).not.toBeNull();
    expect(store.state.user?.uid).toBe('late-uid');
    expect(store.state.authReady).toBe(true);
    console.log('✅ initAuth waited for delayed session recovery during redirect');
  });
});
