import { test, expect } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

/**
 * The resend control on /verify-email is one column (#1406).
 *
 * It was `alert alert-warning flex-col ...`. DaisyUI's `.alert` is a grid with
 * `grid-auto-flow: column`, so `flex-col` did nothing and every child (the sentence, the
 * email field, the captcha, the button) became its own sideways column. The control worked,
 * which is why nothing else noticed: no test measured where its parts sit.
 *
 * Signed out, at a phone width and a desktop width, each part must sit below the one before
 * it, and the field must be wide enough to type an address in.
 */
for (const viewport of [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
]) {
  test(`resend control stacks in one column at ${viewport.width}px (#1406)`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto('/verify-email');
    await dismissCookieBanner(page);

    const sentence = page.getByText('Link expired or never arrived?');
    const field = page.getByLabel('Email');
    const button = page.getByRole('button', {
      name: 'Resend the confirmation email',
    });
    await expect(button).toBeVisible();

    const box = async (loc: typeof field) => {
      const b = await loc.boundingBox();
      expect(b, 'element has a layout box').not.toBeNull();
      return b!;
    };
    const s = await box(sentence);
    const f = await box(field);
    const b = await box(button);

    // Below, not beside: each part starts under the bottom edge of the one before.
    expect(f.y).toBeGreaterThanOrEqual(s.y + s.height - 1);
    expect(b.y).toBeGreaterThanOrEqual(f.y + f.height - 1);

    // One column: the three share a left edge (within a pixel of rounding).
    expect(Math.abs(f.x - s.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(b.x - s.x)).toBeLessThanOrEqual(2);

    // The field is wide enough to read an address in. Squeezed it was under 40px.
    expect(f.width).toBeGreaterThanOrEqual(200);
  });
}
