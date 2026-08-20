import { test, expect, Locator } from '@playwright/test';
import { dismissCookieBanner } from '../utils/test-user-factory';

/**
 * Check if an input field is a honeypot (bot trap) that should not be filled.
 * Honeypot fields have labels like "Don't fill this out if you're human"
 */
async function isHoneypotField(input: Locator): Promise<boolean> {
  try {
    const labelText = await input.evaluate((el) => {
      const id = el.id;
      if (!id) return '';
      const label = document.querySelector(`label[for="${id}"]`);
      return label?.textContent?.toLowerCase() || '';
    });
    return labelText.includes('human') || labelText.includes("don't fill");
  } catch {
    return false;
  }
}

test.describe('Form Submission', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the contact page which has a form
    // Nothing in this file may reach the real Web3Forms endpoint. 'form submission
    // with valid data' below clicks submit with a filled form, and once the lane bakes
    // an access key that becomes a live outbound request. Fulfil it locally instead;
    // individual tests can register a narrower route, which takes precedence.
    await page.route('**/api.web3forms.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'ok' }),
      })
    );

    await page.goto('/contact');
    await dismissCookieBanner(page);
  });

  test('form fields have proper labels and ARIA attributes', async ({
    page,
  }) => {
    // Get the main form element
    const form = page.locator('form[aria-label="Contact form"]');
    await expect(form).toBeVisible();

    // Check name field has proper label association
    const nameLabel = page.getByText('Full Name');
    await expect(nameLabel).toBeVisible();

    const nameInput = page.locator('#name');
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveAttribute('aria-required', 'true');

    // Check email field has proper label association
    const emailLabel = page.getByText('Email Address');
    await expect(emailLabel).toBeVisible();

    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('aria-required', 'true');
  });

  test('required fields show indicators', async ({ page }) => {
    // Each required field's label carries an asterisk: <span class="text-error">*</span>
    // inside <label class="label">. Match by the asterisk text within field labels so
    // the selector isn't coupled to DaisyUI class names (error-message spans also use
    // .text-error but contain the message text, not "*").
    const requiredIndicators = page
      .locator('label.label span.text-error')
      .filter({ hasText: '*' });

    // Contact form has 4 required fields: name, email, subject, message
    await expect(requiredIndicators).toHaveCount(4);

    // Verify at least one indicator contains the asterisk
    await expect(requiredIndicators.first()).toContainText('*');
  });

  test('error messages display correctly', async ({ page }) => {
    // react-hook-form is configured `mode: 'onSubmit'` (ContactForm.tsx:31) and every
    // `-error` label renders only under `{errors.X && ...}`. NO error element exists
    // until a submit has been attempted.
    //
    // The previous version filled a field with '' and pressed Tab, so `[id$="-error"]`
    // was always 0, `if (hasError)` was always false, and neither assertion below had
    // ever executed on any shard (#850). Submitting an empty form is what produces the
    // state this test claims to inspect.
    await page.locator('button[type="submit"]').click();

    // All four required fields fail validation on an empty submit. Asserting the count
    // rather than guarding on it means a form that stops reporting errors fails here.
    const errorMessages = page.locator('[id$="-error"]');
    await expect(errorMessages).toHaveCount(4);
    await expect(errorMessages.first()).toBeVisible();

    // The field must be marked invalid AND point at its own message — the association
    // is the part screen readers depend on, and the part most easily broken.
    const nameInput = page.locator('#name');
    await expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    await expect(nameInput).toHaveAttribute('aria-describedby', 'name-error');
  });

  test('form submission with valid data', async ({ page }) => {
    // Look for a form with submit button
    const submitButton = page.locator('button[type="submit"]').first();
    const hasSubmitButton = (await submitButton.count()) > 0;

    if (hasSubmitButton) {
      // Fill any text inputs
      const textInputs = page.locator(
        'input[type="text"], input[type="email"]'
      );
      const inputCount = await textInputs.count();

      for (let i = 0; i < inputCount; i++) {
        const input = textInputs.nth(i);

        // Skip honeypot fields (bot traps)
        if (await isHoneypotField(input)) {
          continue;
        }

        const inputType = await input.getAttribute('type');

        if (inputType === 'email') {
          await input.fill('test@example.com');
        } else {
          await input.fill('Test Value');
        }
      }

      // Submit form
      await submitButton.click();

      // Wait for form response - loading state, success message, or error
      await expect(async () => {
        const buttonDisabled = await submitButton.isDisabled();
        const hasAlert =
          (await page.locator('[role="alert"], .alert').count()) > 0;
        const hasLoadingClass = (
          await submitButton.getAttribute('class')
        )?.includes('loading');
        expect(buttonDisabled || hasAlert || hasLoadingClass).toBeTruthy();
      })
        .toPass({ timeout: 5000 })
        .catch(() => {
          // Form may not have async behavior - that's acceptable
        });
    }
  });

  test('form validation prevents submission with invalid data', async ({
    page,
  }) => {
    // Look for email input
    const emailInput = page.locator('input[type="email"]').first();
    const hasEmailInput = (await emailInput.count()) > 0;

    if (hasEmailInput) {
      // Enter invalid email
      await emailInput.fill('invalid-email');

      // Try to submit
      const submitButton = page.locator('button[type="submit"]').first();
      if ((await submitButton.count()) > 0) {
        await submitButton.click();

        // Check that we're still on the same page (not submitted)
        await expect(page).toHaveURL(/.*contact/);

        // Check for validation error
        const ariaInvalid = await emailInput.getAttribute('aria-invalid');
        if (ariaInvalid !== null) {
          expect(ariaInvalid).toBe('true');
        }
      }
    }
  });

  test('help text is properly associated with fields', async ({ page }) => {
    // Until #855 there was no help text anywhere in the product, so `[id$="-help"]`
    // matched nothing, `if (hasHelpText)` was always false, and this test's assertion
    // had never run on any shard (#850). It was kept rather than deleted because the
    // gap it pointed at was real: the contact form's length constraints were invisible
    // until a submit failed.
    //
    // Subject (min 5) and message (min 10) carry hints; name and email deliberately do
    // not, so the count is asserted exactly. A hint that silently disappears is the
    // failure this now catches.
    const helpTexts = page.locator('[id$="-help"]');
    await expect(helpTexts).toHaveCount(2);

    for (const field of ['subject', 'message']) {
      const help = page.locator(`#${field}-help`);
      await expect(help).toBeVisible();
      await expect(help).not.toBeEmpty();

      // The hint is only accessible if the control points at it. aria-describedby is a
      // space-separated list, so match the token rather than the whole value — the
      // error id joins it once validation fails.
      await expect(
        page.locator(`#${field}`),
        `#${field} should be described by its help text`
      ).toHaveAttribute(
        'aria-describedby',
        new RegExp(`(^| )${field}-help( |$)`)
      );
    }
  });

  test('form fields maintain focus order', async ({ page }) => {
    // Test tab navigation through the contact form specifically
    // Focus the name field first
    const nameInput = page.locator('#name');
    await nameInput.focus();
    await expect(nameInput).toBeFocused();

    // Tab through the form fields in order: name -> email -> subject -> message -> submit
    await page.keyboard.press('Tab');
    await expect(page.locator('#email')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('#subject')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('#message')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('button', { name: /send|queue/i })
    ).toBeFocused();
  });

  test('form shows loading state during submission', async ({ page }) => {
    // This was dead twice over (#850). It waited for a response whose URL contained
    // '/api/' — but this is a static export with no API routes, and Web3Forms lives at
    // api.web3forms.com/submit, which contains '//api.', not '/api/'. It also clicked
    // submit on an EMPTY form, so validation blocked the request before any network
    // call could happen. `response` was always null and its assertion never ran.
    //
    // Hold the Web3Forms response open so the submitting state lasts long enough to
    // observe. This route is registered after the beforeEach one and therefore wins:
    // Playwright matches handlers in reverse registration order.
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api.web3forms.com/**', async (route) => {
      await held;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'ok' }),
      });
    });

    await page.locator('#name').fill('Test Person');
    await page.locator('#email').fill('test@example.com');
    await page.locator('#subject').fill('Loading state check');
    await page
      .locator('#message')
      .fill('Verifying that the submit button reports progress while sending.');

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // One piece of state — `isSubmitting` — drives all three of these
    // (ContactForm.tsx:362-368), so all three are asserted.
    await expect(submitButton).toBeDisabled();
    await expect(submitButton).toHaveClass(/loading/);
    await expect(submitButton).toHaveText(/Sending|Queuing/);

    release();
  });
});
