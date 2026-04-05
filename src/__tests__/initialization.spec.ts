import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

// 1. Mock Firebase Auth strictly to track sequence
const callOrder: string[] = [];
let capturedUser: any = null;

const mocks = vi.hoisted(() => ({
  getRedirectResult: vi.fn(async () => {
    callOrder.push('getRedirectResult');
    const url = window.location.href;
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
  })
}));

vi.mock('firebase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/auth')>();
  return {
    ...actual,
    getRedirectResult: mocks.getRedirectResult,
    onAuthStateChanged: vi.fn((auth, cb) => {
      // Observer fires with user if we captured one
      setTimeout(() => cb(capturedUser), 10);
      return () => {};
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

describe('Initialization E2E Juice Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;
    capturedUser = null;
    
    // Start with a "Juicy" URL
    vi.stubGlobal('location', {
      href: 'http://localhost/?code=juice#/',
      search: '?code=juice',
      hash: '#/'
    });
  });

  it('verifies that the REAL router and store preserve auth state', async () => {
    // 1. Import the REAL router. 
    // This will trigger the top-level getRedirectResult call we added.
    const router = (await import('../router/index')).default;
    
    // 2. Verify call happened while juice was present
    expect(callOrder).toContain('getRedirectResult');
    
    // 3. Import the REAL store and AuthButton component
    const store = (await import('../store/index')).default;
    const AuthButton = (await import('../components/AuthButton.vue')).default;

    // 4. Initialize Auth (this simulates the App.vue mount)
    await store.dispatch('initAuth');

    // 5. Mount the REAL component to verify UI state
    const wrapper = mount(AuthButton, {
      global: {
        plugins: [store, router]
      }
    });

    // 6. Assertions
    expect(store.state.user).not.toBeNull();
    expect(store.state.user?.uid).toBe('fb-user-123');
    
    // Check if the UI reflects the logged-in state (e.g., the user's name is shown)
    // AuthButton shows user's first name in a span
    expect(wrapper.text()).toContain('Facebook');
    
    console.log('✅ High-Fidelity Test Passed: Real Router/Store/Component authenticated via early capture.');
  });
});
