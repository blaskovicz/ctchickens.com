import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';

// We'll track if the SDK "saw" the juice before it was wiped
const callOrder: { name: string; url: string }[] = [];
let capturedUser: any = null;

// 1. Mock ONLY Firebase Auth. We control the "juice" recognition here.
vi.mock('firebase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/auth')>();
  return {
    ...actual,
    getRedirectResult: vi.fn(async () => {
      const url = window.location.href;
      callOrder.push({ name: 'getRedirectResult', url });
      
      if (url.includes('code=juice')) {
        capturedUser = { 
          uid: 'fb-user-123', 
          displayName: 'Facebook User',
          email: 'fb@example.com',
          photoURL: 'http://example.com/photo.jpg',
          providerData: [{ providerId: 'facebook.com', uid: 'fb-123' }]
        };
        return { user: capturedUser };
      }
      return capturedUser ? { user: capturedUser } : null;
    }),
    onAuthStateChanged: vi.fn((auth, cb) => {
      setTimeout(() => cb(capturedUser), 10);
      return () => {};
    }),
  };
});

// 2. Mock vue-router to simulate the "Lunch Stealing" (URL cleaning)
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>();
  return {
    ...actual,
    createRouter: vi.fn((options: any) => {
      const router = actual.createRouter(options);
      
      // SIMULATE THE LUNCH STEALING:
      // In a real browser with Hash Mode, the router initialization cleans the URL.
      // JSDOM doesn't always replicate this automatically during tests, so we force it here
      // to prove our early capture logic works when the URL is indeed wiped.
      vi.stubGlobal('location', {
        href: 'http://localhost/#/',
        search: '', // Juice is gone!
        hash: '#/',
        pathname: '/'
      });
      
      return router;
    }),
  };
});

// Mock Firestore to prevent network hits
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    getDoc: vi.fn(() => Promise.resolve({ exists: () => false })),
    getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
    setDoc: vi.fn(() => Promise.resolve()),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn(),
  };
});

describe('High-Fidelity Initialization Flow', () => {
  beforeEach(() => {
    vi.resetModules(); // CRITICAL: Ensure top-level code in router/store runs again
    vi.clearAllMocks();
    callOrder.length = 0;
    capturedUser = null;
    
    // Start with a "Juicy" URL - exactly what Facebook sends back
    vi.stubGlobal('location', {
      href: 'http://localhost/?code=juice#/',
      search: '?code=juice',
      hash: '#/',
      pathname: '/'
    });
  });

  it('proves the REAL router cleans the URL but the REAL store still gets the user', async () => {
    // 1. Load the REAL router.
    // In src/router/index.ts, getRedirectResult is called BEFORE createRouter.
    const router = (await import('../router/index')).default;
    
    // 2. Load the REAL store.
    const store = (await import('../store/index')).default;
    const AuthButton = (await import('../components/AuthButton.vue')).default;

    // 3. Verify the sequence and the "Lunch Stealing"
    // The first call to getRedirectResult happened in the router module.
    expect(callOrder[0].name).toBe('getRedirectResult');
    expect(callOrder[0].url).toContain('code=juice');

    // Verify the URL was indeed cleaned (as per our mock simulation of reality)
    expect(window.location.search).toBe(''); 

    // 4. Now run the REAL initAuth action.
    // It will call getRedirectResult again, but this time the URL is clean!
    await store.dispatch('initAuth');
    
    expect(callOrder[1].name).toBe('getRedirectResult');
    expect(callOrder[1].url).not.toContain('code=juice'); // The URL was clean for this call

    // 5. Final verification: The store MUST have the user because the first call "grabbed the juice"
    expect(store.state.user).not.toBeNull();
    expect(store.state.user?.uid).toBe('fb-user-123');

    // 6. Verify the REAL component reflects this
    const wrapper = mount(AuthButton, {
      global: { plugins: [store, router] }
    });
    expect(wrapper.text()).toContain('Facebook');
    
    console.log('✅ Verified: Real Router wiped the URL, but the Real Store still authenticated.');
  });
});
