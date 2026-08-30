import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { GlobalNav } from './GlobalNav';

expect.extend(toHaveNoViolations);

const { signOut, checkIsAdmin } = vi.hoisted(() => ({
  signOut: vi.fn(),
  checkIsAdmin: vi.fn().mockResolvedValue(false),
}));

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
let user: { id: string } | null = null;
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user, signOut }),
}));
vi.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ profile: { display_name: 'Ada' } }),
}));
vi.mock('@/hooks/useUnreadCount', () => ({ useUnreadCount: () => 0 }));
vi.mock('@/services/admin/admin-auth-service', () => ({
  AdminAuthService: class {
    checkIsAdmin = checkIsAdmin;
  },
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
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
vi.mock('@/twin/renderer-select', () => ({ selectRenderer: () => 'atlas' }));

beforeEach(() => {
  user = null;
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
});

describe('GlobalNav Accessibility', () => {
  it('has no violations signed out', async () => {
    const { container } = render(<GlobalNav />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations signed in', async () => {
    user = { id: 'user-1' };
    const { container } = render(<GlobalNav />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations with a group open', async () => {
    const u = userEvent.setup();
    const { container } = render(<GlobalNav />);
    await u.click(screen.getByRole('button', { name: 'Demos' }));
    expect(await axe(container)).toHaveNoViolations();
  });
});

/**
 * `useDismissable` exists so the keyboard contract is written once rather than
 * three times. These cases exercise it through the real triggers — the doc
 * comment is a claim, and this is what makes it a checked one.
 */
describe('GlobalNav popover keyboard contract', () => {
  it('reports its expanded state on the trigger', async () => {
    const u = userEvent.setup();
    render(<GlobalNav />);
    const trigger = screen.getByRole('button', { name: 'Demos' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await u.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes on Escape AND returns focus to the trigger', async () => {
    const u = userEvent.setup();
    render(<GlobalNav />);
    const trigger = screen.getByRole('button', { name: 'Demos' });
    await u.click(trigger);

    // Move focus INTO the panel first. Clicking the trigger leaves focus on it,
    // so asserting toHaveFocus() straight after Escape passes whether or not the
    // component restores anything — mutation-testing proved that: deleting
    // `trigger.current?.focus()` left this green until this line was added.
    const firstItem = screen.getAllByRole('menuitem')[0];
    firstItem.focus();
    expect(firstItem).toHaveFocus();

    await u.keyboard('{Escape}');

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // The focus half is what a DaisyUI :focus-within dropdown cannot do:
    // returning focus to a trigger that lives inside `.dropdown` re-opens the
    // panel on the same frame. That is why these two are React-owned.
    expect(trigger).toHaveFocus();
  });

  it('closes on a pointer press outside it', async () => {
    const u = userEvent.setup();
    render(<GlobalNav />);
    const trigger = screen.getByRole('button', { name: 'Demos' });
    await u.click(trigger);
    await u.click(document.body);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('describes the Display panel as a group, not a menu', async () => {
    const u = userEvent.setup();
    render(<GlobalNav />);
    const trigger = screen.getByRole('button', { name: 'Display' });
    await u.click(trigger);
    // It holds CONTROLS — a theme list, toggles, button groups. A role="menu"
    // would announce each of them as a menuitem, which they are not (#378).
    expect(trigger).toHaveAttribute('aria-haspopup', 'true');
    expect(screen.getByTestId('nav-popover-display')).toHaveAttribute(
      'role',
      'group'
    );
  });

  it('describes a list of destinations as a real menu', async () => {
    const u = userEvent.setup();
    render(<GlobalNav />);
    const trigger = screen.getByRole('button', { name: 'Demos' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await u.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
});

describe('GlobalNav names and targets', () => {
  it('does NOT put the word "menu" in the Display trigger name', () => {
    render(<GlobalNav />);
    // #378's own earlier regression: mobile-navigation.spec.ts locates
    // `[aria-label*="menu" i]`, `.first()` follows document order, and nav
    // precedes page content — so a name containing "menu" shadows the mobile
    // hamburger and the wrong control gets driven.
    const display = screen.getByRole('button', { name: 'Display' });
    expect(display.getAttribute('aria-label') ?? 'Display').not.toMatch(
      /menu/i
    );
  });

  it('names the mobile hamburger unambiguously', () => {
    render(<GlobalNav />);
    // getByLabelText, not getByRole('button'): the hamburger is a
    // `<label tabIndex={0}>`, see the it.fails below.
    expect(screen.getByLabelText('Navigation menu')).toBeInTheDocument();
  });

  it.fails(
    'makes the hamburger and account triggers real buttons (#1018)',
    () => {
      // KNOWN GAP, red when fixed. Both are `<label tabIndex={0}>` inside DaisyUI
      // `:focus-within` dropdowns — the pattern #378 replaced for the Display and
      // Demos popovers because returning focus to a trigger that lives inside
      // `.dropdown` re-opens the panel on the same frame. So neither carries
      // aria-expanded, neither is announced as a button, and Escape cannot close
      // them. The two React-owned popovers beside them show what the fix looks
      // like; the tests above prove that contract already holds for those.
      render(<GlobalNav />);
      expect(
        screen.getByRole('button', { name: 'Navigation menu' })
      ).toBeInTheDocument();
    }
  );

  it('has ONE navigation landmark, so a landmark list is not ambiguous', () => {
    render(<GlobalNav />);
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
  });

  it('keeps every menu item at the 44px floor', async () => {
    const u = userEvent.setup();
    render(<GlobalNav />);
    await u.click(screen.getByRole('button', { name: 'Demos' }));
    // DaisyUI renders `li > a` at 26px, and no E2E gate can measure an item
    // inside a closed dropdown — so without an explicit floor they stay under it
    // indefinitely (#378). MENU_ITEM is named rather than repeated for the same
    // reason: a new entry cannot arrive without one.
    for (const item of screen.getAllByRole('menuitem')) {
      expect(item.className).toContain('min-h-11');
    }
  });

  it('gives the logo link a destination in its name', () => {
    render(<GlobalNav />);
    expect(screen.getByRole('link', { name: /— Home$/ })).toHaveAttribute(
      'href',
      '/'
    );
  });
});
