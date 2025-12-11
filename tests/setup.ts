import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi, expect } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';
import 'fake-indexeddb/auto';

// Mock AuthContext with reasonable defaults for component tests
// Unit tests can override with vi.doUnmock() if needed
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: '123',
      email: 'test@example.com',
      user_metadata: { username: 'testuser' },
      email_confirmed_at: null, // Allow EmailVerificationNotice to render
    },
    session: { access_token: 'mock-token' },
    isLoading: false,
    isAuthenticated: true,
    signUp: vi.fn(async () => ({ error: null })),
    signIn: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    refreshSession: vi.fn(async () => {}),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Next.js navigation for all tests
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Note: usePaymentConsent is NOT globally mocked
// Tests that need it should mock it themselves (see PaymentConsentModal.test.tsx)
// This allows unit tests to test the real implementation

// Mock CSS imports
vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('prismjs/themes/prism-tomorrow.css', () => ({}));
vi.mock('@/styles/prism-override.css', () => ({}));

// =============================================================================
// Comprehensive Supabase Client Mock
// Enables tests to run without Supabase environment variables
// =============================================================================
const mockSupabaseClient = {
  auth: {
    getSession: vi.fn(() =>
      Promise.resolve({
        data: { session: null },
        error: null,
      })
    ),
    getUser: vi.fn(() =>
      Promise.resolve({
        data: { user: null },
        error: null,
      })
    ),
    signInWithPassword: vi.fn(() =>
      Promise.resolve({
        data: { user: null, session: null },
        error: null,
      })
    ),
    signInWithOAuth: vi.fn(() =>
      Promise.resolve({
        data: { provider: 'github', url: 'https://example.com/oauth' },
        error: null,
      })
    ),
    signUp: vi.fn(() =>
      Promise.resolve({
        data: { user: null, session: null },
        error: null,
      })
    ),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
    resetPasswordForEmail: vi.fn(() =>
      Promise.resolve({ data: {}, error: null })
    ),
    updateUser: vi.fn(() =>
      Promise.resolve({
        data: { user: null },
        error: null,
      })
    ),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    exchangeCodeForSession: vi.fn(() =>
      Promise.resolve({
        data: { session: null },
        error: null,
      })
    ),
  },
  from: vi.fn((table: string) => ({
    select: vi.fn((columns?: string) => ({
      eq: vi.fn((column: string, value: unknown) => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      neq: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      in: vi.fn(() => Promise.resolve({ data: [], error: null })),
      order: vi.fn((column: string) => ({
        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        range: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      range: vi.fn(() => Promise.resolve({ data: [], error: null })),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
    insert: vi.fn((data: unknown) => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      })),
    })),
    update: vi.fn((data: unknown) => ({
      eq: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      match: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null })),
      match: vi.fn(() => Promise.resolve({ error: null })),
    })),
    upsert: vi.fn(() => Promise.resolve({ data: {}, error: null })),
  })),
  channel: vi.fn((name: string) => {
    const channel = {
      on: vi.fn(() => channel),
      subscribe: vi.fn((callback?: (status: string) => void) => {
        if (callback) callback('SUBSCRIBED');
        return channel;
      }),
      unsubscribe: vi.fn(() => Promise.resolve('ok')),
      send: vi.fn(() => Promise.resolve('ok')),
      track: vi.fn(() => Promise.resolve('ok')),
      untrack: vi.fn(() => Promise.resolve('ok')),
    };
    return channel;
  }),
  removeChannel: vi.fn(() => Promise.resolve('ok')),
  removeAllChannels: vi.fn(() => Promise.resolve([])),
  getChannels: vi.fn(() => []),
  storage: {
    from: vi.fn((bucket: string) => ({
      upload: vi.fn((path: string, file: unknown) =>
        Promise.resolve({ data: { path }, error: null })
      ),
      getPublicUrl: vi.fn((path: string) => ({
        data: { publicUrl: `https://example.com/storage/${bucket}/${path}` },
      })),
      remove: vi.fn((paths: string[]) => Promise.resolve({ error: null })),
      download: vi.fn((path: string) =>
        Promise.resolve({ data: new Blob(), error: null })
      ),
      list: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })),
  },
  rpc: vi.fn((fn: string, params?: unknown) =>
    Promise.resolve({ data: null, error: null })
  ),
};

// Mock Supabase client modules for unit tests
// Note: Contract and integration tests should import directly from @supabase/supabase-js
// or use vi.unmock('@/lib/supabase/client') at the top of the test file
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
  getSupabase: vi.fn(() => mockSupabaseClient),
  supabase: mockSupabaseClient,
  isSupabaseConfigured: vi.fn(() => false),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => mockSupabaseClient),
}));

// Export mock for tests that need to override specific methods
export { mockSupabaseClient };

// Extend Vitest matchers with jest-axe accessibility matchers
expect.extend(toHaveNoViolations);

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia (only in jsdom environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Track blob dimensions for createImageBitmap
const blobDimensions = new WeakMap<Blob, { width: number; height: number }>();

// Mock HTMLCanvasElement.getContext and toBlob for avatar tests
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation(() => ({
    fillStyle: '',
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(4),
    })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(4),
    })),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    transform: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    textAlign: 'left',
    textBaseline: 'alphabetic',
    font: '10px sans-serif',
  }));

  // Mock toBlob for avatar image processing
  HTMLCanvasElement.prototype.toBlob = vi.fn().mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type = 'image/png',
    quality = 0.92
  ) {
    // Create a mock blob and track the canvas dimensions
    const blob = new Blob(['mock-image-data'], { type });
    blobDimensions.set(blob, {
      width: this.width,
      height: this.height,
    });
    setTimeout(() => callback(blob), 0);
  });
}

// Mock createImageBitmap for avatar validation
if (typeof global !== 'undefined') {
  global.createImageBitmap = vi.fn().mockImplementation((source: any) => {
    // Handle File/Blob objects
    if (source instanceof File || source instanceof Blob) {
      // Check if we tracked dimensions for this blob
      const dims = blobDimensions.get(source);
      if (dims) {
        return Promise.resolve({
          width: dims.width,
          height: dims.height,
          close: vi.fn(),
        });
      }
      // Special case: files with "not an image" content (text) should reject
      if (source.size < 20 && source.type.startsWith('image/')) {
        return Promise.reject(new Error('Failed to decode image'));
      }
      // Default for unknown blobs
      return Promise.resolve({
        width: 500,
        height: 500,
        close: vi.fn(),
      });
    }
    // Handle image elements or objects with width/height
    return Promise.resolve({
      width: source.width || 500,
      height: source.height || 500,
      close: vi.fn(),
    });
  });
}

// Mock URL.createObjectURL and revokeObjectURL for blob handling
if (typeof global !== 'undefined' && typeof URL !== 'undefined') {
  const blobUrls = new Map<string, Blob>();
  let urlCounter = 0;

  URL.createObjectURL = vi.fn().mockImplementation((blob: Blob) => {
    const url = `blob:http://localhost/${++urlCounter}`;
    blobUrls.set(url, blob);
    return url;
  });

  URL.revokeObjectURL = vi.fn().mockImplementation((url: string) => {
    blobUrls.delete(url);
  });
}

// Mock HTMLDialogElement for payment modals (JSDOM doesn't support dialog element)
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal =
    HTMLDialogElement.prototype.showModal ||
    function (this: HTMLDialogElement) {
      this.open = true;
    };

  HTMLDialogElement.prototype.close =
    HTMLDialogElement.prototype.close ||
    function (this: HTMLDialogElement) {
      this.open = false;
    };
}
