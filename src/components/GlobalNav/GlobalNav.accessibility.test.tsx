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

  it('has no violations with the HAMBURGER open', async () => {
    // The closed-nav scan cannot see this: panels are unmounted until opened, so
    // axe was scanning strictly less markup after #1018, not more. The specific
    // risk is the panel being role="group" while carrying DaisyUI's `menu`
    // classes — if a refactor ever flattened the inner <ul> away, the <li>s would
    // be listitems inside a group, which is invalid and axe reports as
    // aria-required-parent. Nothing else in the suite would catch it.
    const u = userEvent.setup();
    const { container } = render(<GlobalNav />);
    await u.click(screen.getByRole('button', { name: 'Navigation menu' }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations with the ACCOUNT menu open', async () => {
    user = { id: 'user-1' };
    const u = userEvent.setup();
    const { container } = render(<GlobalNav />);
    await u.click(screen.getByRole('button', { name: 'User account menu' }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('keeps the panel list structure valid, not just violation-free', async () => {
    // Stated directly as well as via axe. The <li>s must have a list parent; the
    // role="group" div is not one.
    const u = userEvent.setup();
    render(<GlobalNav />);
    await u.click(screen.getByRole('button', { name: 'Navigation menu' }));
    const panel = screen.getByTestId('nav-popover-navigation');
    for (const li of Array.from(panel.querySelectorAll('li'))) {
      expect(li.parentElement?.tagName).toBe('UL');
    }
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
    expect(
      screen.getByRole('button', { name: 'Navigation menu' })
    ).toBeInTheDocument();
  });

  it('makes the hamburger and account triggers real buttons (#1018)', async () => {
    // Was an it.fails. Both were `<label tabIndex={0}>` inside DaisyUI
    // `:focus-within` dropdowns — the pattern #378 replaced for Display and Demos
    // because returning focus to a trigger living inside `.dropdown` re-opens the
    // panel on the same frame. All four header popovers are React-owned now.
    const u = userEvent.setup();
    render(<GlobalNav />);
    const hamburger = screen.getByRole('button', { name: 'Navigation menu' });
    expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    await u.click(hamburger);
    expect(hamburger).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes the hamburger on Escape AND returns focus to it', async () => {
    // The half a `:focus-within` dropdown structurally cannot do. Focus is moved
    // INTO the panel first — clicking the trigger already leaves focus on it, so
    // asserting toHaveFocus() straight after Escape would pass whether or not
    // anything was restored.
    const u = userEvent.setup();
    render(<GlobalNav />);
    const hamburger = screen.getByRole('button', { name: 'Navigation menu' });
    await u.click(hamburger);

    const firstLink = screen.getAllByRole('link', { name: 'Docs' }).pop()!;
    firstLink.focus();
    expect(firstLink).toHaveFocus();

    await u.keyboard('{Escape}');
    expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    expect(hamburger).toHaveFocus();
  });

  it('mounts the hamburger panel only while it is open', async () => {
    // Not cosmetic: closed panels used to sit in the DOM behind CSS, which is
    // what made `.dropdown-content a` match two panels at once and inflated
    // every count a spec took signed-in.
    const u = userEvent.setup();
    render(<GlobalNav />);
    expect(screen.queryByTestId('nav-popover-navigation')).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Navigation menu' }));
    expect(screen.getByTestId('nav-popover-navigation')).toBeInTheDocument();
  });

  it('keeps the width cap that backstops a 320px viewport (#803, #1022)', async () => {
    // Measured, so the reason is right rather than inherited (#1022). This cap is
    // NOT what keeps the panel inside 320px today — the panel is 160px, and
    // deleting the cap changes nothing. It is a BACKSTOP: at 320px, widening the
    // panel to 384px puts its left edge at -121px, and with the cap present the
    // same change clamps to 256px and stays inside.
    //
    // The overflow runs off the LEFT edge because `-right-2` pins the right one,
    // which is why mobile-open-menu-overflow.spec.ts checks both.
    //
    // Asserted here so the class cannot be dropped in a refactor that never runs
    // the E2E lane.
    const u = userEvent.setup();
    render(<GlobalNav />);
    await u.click(screen.getByRole('button', { name: 'Navigation menu' }));
    expect(screen.getByTestId('nav-popover-navigation').className).toContain(
      'max-w-[calc(100vw-4rem)]'
    );
  });

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
