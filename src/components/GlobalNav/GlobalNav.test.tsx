import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GlobalNav } from './GlobalNav';
import { THEMES } from '@/config/themes';
import { CONSENT_STORAGE_KEY } from '@/config/accessibility-tokens';

const { signOut, checkIsAdmin } = vi.hoisted(() => ({
  signOut: vi.fn(),
  checkIsAdmin: vi.fn().mockResolvedValue(false),
}));

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

let user: { id: string } | null = null;
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user, signOut }),
}));
vi.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ profile: { display_name: 'Ada' } }),
}));

let unread = 0;
vi.mock('@/hooks/useUnreadCount', () => ({ useUnreadCount: () => unread }));

vi.mock('@/services/admin/admin-auth-service', () => ({
  AdminAuthService: class {
    checkIsAdmin = checkIsAdmin;
  },
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));

// Heavy children, each already covered by its own suite. Stubbing keeps this
// file about the NAV rather than about a logo's animation or a colour panel.
vi.mock('@/components/atomic/SpinningLogo', () => ({
  LayeredScriptHammerLogo: () => <span data-testid="logo" />,
}));
vi.mock('@/components/atomic/AnimatedLogo', () => ({
  AnimatedLogo: () => <span data-testid="animated-logo" />,
}));
vi.mock('@/components/molecular/ColorblindToggle', () => ({
  ColorVisionPanel: () => <div data-testid="color-vision-panel" />,
}));
vi.mock('@/components/navigation/FontSizeControl', () => ({
  TextSettingsPanel: () => <div data-testid="text-settings-panel" />,
}));
vi.mock('@/components/atomic/AvatarDisplay', () => ({
  default: () => <span data-testid="avatar" />,
}));

let renderer: 'atlas' | 'diorama' = 'atlas';
vi.mock('@/twin/renderer-select', () => ({ selectRenderer: () => renderer }));

/** Grant functional consent, which is what allows persistence to localStorage. */
const allowFunctional = () =>
  localStorage.setItem(
    CONSENT_STORAGE_KEY,
    JSON.stringify({ functional: true })
  );

const setSearch = (search: string) =>
  window.history.replaceState({}, '', `/${search}`);

beforeEach(() => {
  pathname = '/';
  user = null;
  unread = 0;
  renderer = 'atlas';
  signOut.mockClear();
  checkIsAdmin.mockClear().mockResolvedValue(false);
  localStorage.clear();
  // sessionStorage too: applyTheme writes there on EVERY path, consent or not, so
  // leaving it set carries one test's chosen theme into the next mount. Same trap
  // as ThemeSwitcher.test.tsx.
  sessionStorage.clear();
  setSearch('');
  document.documentElement.removeAttribute('data-theme');
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
});

describe('GlobalNav structure', () => {
  it('keeps the data-global-nav hook the twin routes style against', () => {
    const { container } = render(<GlobalNav />);
    // globals.css:1855 and four E2E specs select this. It is an attribute rather
    // than an accessible name deliberately, so renaming a label cannot silently
    // break the glass treatment (#301).
    expect(container.querySelector('[data-global-nav]')).not.toBeNull();
  });

  it('renders exactly ONE navigation landmark', () => {
    render(<GlobalNav />);
    // The desktop rail used to be a second <nav> nested inside this one. Two
    // unnamed navigation landmarks are announced identically in a landmark list,
    // which axe reports as landmark-unique; it is a div now.
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
  });

  it('puts Home on the logo rather than a nav slot (#378)', () => {
    render(<GlobalNav />);
    expect(screen.getByRole('link', { name: /— Home$/ })).toHaveAttribute(
      'href',
      '/'
    );
    expect(screen.queryByRole('link', { name: /^Home$/ })).toBeNull();
  });
});

describe('GlobalNav destinations', () => {
  it('offers the top-level destinations', () => {
    render(<GlobalNav />);
    const nav = screen.getByRole('navigation');
    for (const label of [
      'Docs',
      'Blog',
      'Play',
      'Pricing',
      'Themes',
      'Status',
    ]) {
      expect(
        within(nav).getAllByRole('link', { name: label }).length
      ).toBeGreaterThan(0);
    }
  });

  it('hides the grouped demos until the group is opened', async () => {
    const user = userEvent.setup();
    render(<GlobalNav />);
    expect(screen.queryByRole('menuitem', { name: 'Wireframes' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Demos' }));
    for (const label of [
      'Atlas',
      'Diorama',
      'Wireframes',
      'Map',
      'Game',
      'Payments',
      'Schedule',
    ]) {
      expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument();
    }
  });

  it('uses a FULL navigation for the two map entries', async () => {
    const u = userEvent.setup();
    render(<GlobalNav />);
    await u.click(screen.getByRole('button', { name: 'Demos' }));
    // reload:true renders a plain <a>, not a client Link. The renderer is chosen
    // from the query at MOUNT and is not reactive, so a client-side query-only
    // nav would keep the current renderer and atlas↔diorama could never switch.
    const atlas = screen.getByRole('menuitem', { name: 'Atlas' });
    expect(atlas.tagName).toBe('A');
    expect(atlas.getAttribute('href')).toContain('/chatt');
  });
});

describe('GlobalNav active state', () => {
  it('marks the current top-level route', () => {
    pathname = '/blog';
    render(<GlobalNav />);
    expect(screen.getAllByRole('link', { name: 'Blog' })[0].className).toMatch(
      /active|text-primary|font-semibold|bg-/
    );
  });

  it('treats a nested route as being under its section', () => {
    pathname = '/blog/some-post';
    render(<GlobalNav />);
    expect(screen.getAllByRole('link', { name: 'Blog' })[0].className).toMatch(
      /active|text-primary|font-semibold|bg-/
    );
  });

  it('tells Atlas and Diorama apart, which the pathname alone cannot', async () => {
    // Both are /chatt; they differ only by ?diorama, and usePathname is
    // query-blind. The nav reflects the ACTUAL renderer instead.
    pathname = '/chatt';
    renderer = 'diorama';
    setSearch('?diorama');
    const u = userEvent.setup();
    render(<GlobalNav />);
    await u.click(screen.getByRole('button', { name: 'Demos' }));

    const diorama = screen.getByRole('menuitem', { name: 'Diorama' });
    const atlas = screen.getByRole('menuitem', { name: 'Atlas' });
    await waitFor(() => expect(diorama.className).toContain('active'));
    expect(atlas.className).not.toContain('active');
  });
});

describe('GlobalNav authentication', () => {
  it('offers sign in and sign up to a signed-out visitor', () => {
    render(<GlobalNav />);
    expect(
      screen.getAllByRole('link', { name: 'Sign In' }).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('link', { name: 'Sign Up' }).length
    ).toBeGreaterThan(0);
  });

  it('swaps them for an account menu once signed in', () => {
    user = { id: 'user-1' };
    render(<GlobalNav />);
    expect(screen.getByLabelText('User account menu')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign In' })).toBeNull();
  });

  it.fails('makes the account trigger a real button (#1018)', () => {
    // KNOWN GAP. It is a `<label tabIndex={0}>` inside a DaisyUI `:focus-within`
    // dropdown — the exact pattern #378 rejected for the Display and Demos
    // popovers, and the one FontSizeControl is already flagged for. It therefore
    // has no aria-expanded, is not announced as a button, and Escape cannot
    // close it without immediately reopening it.
    user = { id: 'user-1' };
    render(<GlobalNav />);
    expect(
      screen.getByRole('button', { name: 'User account menu' })
    ).toBeInTheDocument();
  });

  it('hides the admin link from a non-admin', async () => {
    user = { id: 'user-1' };
    const u = userEvent.setup();
    render(<GlobalNav />);
    await u.click(screen.getByLabelText('User account menu'));
    await waitFor(() => expect(checkIsAdmin).toHaveBeenCalledWith('user-1'));
    expect(screen.queryByRole('link', { name: 'Admin Dashboard' })).toBeNull();
  });

  it('shows it to an admin', async () => {
    user = { id: 'admin-1' };
    checkIsAdmin.mockResolvedValue(true);
    const u = userEvent.setup();
    render(<GlobalNav />);
    await u.click(screen.getByLabelText('User account menu'));
    // Rendered in BOTH the desktop dropdown and the mobile menu.
    const links = await screen.findAllByRole('link', {
      name: 'Admin Dashboard',
    });
    expect(links[0]).toHaveAttribute('href', '/admin');
  });

  it('does not ask whether a signed-out visitor is an admin', () => {
    render(<GlobalNav />);
    expect(checkIsAdmin).not.toHaveBeenCalled();
  });

  it('signs out through the context', async () => {
    user = { id: 'user-1' };
    const u = userEvent.setup();
    render(<GlobalNav />);
    await u.click(screen.getByLabelText('User account menu'));
    await u.click(screen.getAllByRole('button', { name: /sign out/i })[0]);
    expect(signOut).toHaveBeenCalled();
  });
});

describe('GlobalNav unread messages', () => {
  it('shows no badge at zero', () => {
    user = { id: 'user-1' };
    render(<GlobalNav />);
    const messages = screen.getAllByRole('link', { name: 'Messages' })[0];
    expect(messages.textContent).not.toMatch(/\d/);
  });

  it('shows the count when there is one', () => {
    user = { id: 'user-1' };
    unread = 3;
    render(<GlobalNav />);
    expect(
      screen.getAllByRole('link', { name: 'Messages' })[0].textContent
    ).toContain('3');
  });
});

describe('GlobalNav theming', () => {
  it('syncs to the theme ThemeScript already applied, rather than overwriting it', async () => {
    document.documentElement.setAttribute('data-theme', THEMES[4]);
    render(<GlobalNav />);
    // ThemeScript runs before hydration; the nav must not stomp its work with a
    // default on mount, which would flash the wrong theme on every page load.
    await waitFor(() =>
      expect(document.documentElement.getAttribute('data-theme')).toBe(
        THEMES[4]
      )
    );
  });

  it('applies a theme chosen from the Display panel', async () => {
    const u = userEvent.setup();
    render(<GlobalNav />);
    await u.click(screen.getByRole('button', { name: 'Display' }));
    await u.click(screen.getByRole('button', { name: THEMES[6] }));
    expect(document.documentElement.getAttribute('data-theme')).toBe(THEMES[6]);
  });

  it('does NOT persist to localStorage without functional consent (#1016)', async () => {
    // Was an it.fails. GlobalNav carried its own theme implementation and wrote
    // localStorage unconditionally, so picking a theme here ignored the
    // visitor's cookie choice while doing it on /themes respected it. #382
    // extracted applyTheme precisely so a second copy could not drift.
    const u = userEvent.setup();
    render(<GlobalNav />);
    await u.click(screen.getByRole('button', { name: 'Display' }));
    await u.click(screen.getByRole('button', { name: THEMES[6] }));

    expect(localStorage.getItem('theme')).toBeNull();
    // Still remembered for the session — declining cookies costs persistence
    // across visits, not the ability to choose a theme at all.
    expect(sessionStorage.getItem('theme')).toBe(THEMES[6]);
  });

  it('DOES persist once functional consent is granted', async () => {
    // The other half, so the test above cannot be satisfied by a component that
    // simply never writes anything.
    allowFunctional();
    const u = userEvent.setup();
    render(<GlobalNav />);
    await u.click(screen.getByRole('button', { name: 'Display' }));
    await u.click(screen.getByRole('button', { name: THEMES[6] }));

    expect(localStorage.getItem('theme')).toBe(THEMES[6]);
  });

  it('broadcasts the change to components listening in-page', async () => {
    // applyTheme's StorageEvent is consent-gated; this CustomEvent is not, and is
    // the only signal a declined visitor produces.
    const heard: string[] = [];
    const onThemeChange = (e: Event) =>
      heard.push((e as CustomEvent).detail.theme);
    window.addEventListener('themechange', onThemeChange);

    const u = userEvent.setup();
    render(<GlobalNav />);
    await u.click(screen.getByRole('button', { name: 'Display' }));
    await u.click(screen.getByRole('button', { name: THEMES[6] }));

    window.removeEventListener('themechange', onThemeChange);
    expect(heard).toContain(THEMES[6]);
  });
});
