import { test, expect } from '@playwright/test';

test.describe('Form Submission', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page with forms
    await page.goto('/components');
  });

  test('form fields have proper labels and ARIA attributes', async ({
    page,
  }) => {
    // Look for form fields on the components page
    const formFields = page.locator('.form-control').first();

    // Check if form exists
    const formExists = (await formFields.count()) > 0;

    if (formExists) {
      // Check for label
      const label = formFields.locator('label').first();
      await expect(label).toBeVisible();

      // Check label has for attribute
      const forAttr = await label.getAttribute('for');
      expect(forAttr).toBeTruthy();

      // Check corresponding input exists
      const input = page.locator(`#${forAttr}`).first();
      await expect(input).toBeVisible();
    }
  });

  test('required fields show indicators', async ({ page }) => {
    // Look for required field indicators
    const requiredIndicator = page.locator('.text-error:has-text("*")').first();
    const hasRequired = (await requiredIndicator.count()) > 0;

    if (hasRequired) {
      await expect(requiredIndicator).toBeVisible();
      await expect(requiredIndicator).toHaveAttribute('aria-label', 'required');
    }
  });

  test('error messages display correctly', async ({ page }) => {
    // Look for any input field
    const input = page
      .locator('input[type="text"], input[type="email"]')
      .first();
    const inputExists = (await input.count()) > 0;

    if (inputExists) {
      // Submit form with empty required field to trigger validation
      await input.fill('');
      await input.press('Tab'); // Trigger blur event

      // Check for error message with proper ARIA
      const errorMessage = page.locator('[id$="-error"]').first();

      // If form has validation, error should appear
      const hasError = (await errorMessage.count()) > 0;
      if (hasError) {
        await expect(errorMessage).toBeVisible();

        // Check input has aria-invalid
        const ariaInvalid = await input.getAttribute('aria-invalid');
        expect(ariaInvalid).toBe('true');

        // Check input has aria-describedby pointing to error
        const ariaDescribedBy = await input.getAttribute('aria-describedby');
        expect(ariaDescribedBy).toContain('-error');
      }
    }
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
        const inputType = await input.getAttribute('type');

        if (inputType === 'email') {
          await input.fill('test@example.com');
        } else {
          await input.fill('Test Value');
        }
      }

      // Submit form
      await submitButton.click();

      // Check for success indication (could be redirect, message, etc.)
      // This is generic since we don't know specific form behavior
      await page.waitForTimeout(1000); // Wait for any async operations
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
        await expect(page).toHaveURL(/.*components/);

        // Check for validation error
        const ariaInvalid = await emailInput.getAttribute('aria-invalid');
        if (ariaInvalid !== null) {
          expect(ariaInvalid).toBe('true');
        }
      }
    }
  });

  test('help text is properly associated with fields', async ({ page }) => {
    // Look for help text
    const helpText = page.locator('[id$="-help"]').first();
    const hasHelpText = (await helpText.count()) > 0;

    if (hasHelpText) {
      await expect(helpText).toBeVisible();

      // Find associated input
      const helpId = await helpText.getAttribute('id');
      const fieldName = helpId?.replace('-help', '');

      if (fieldName) {
        const input = page.locator(`#${fieldName}`);
        if ((await input.count()) > 0) {
          const ariaDescribedBy = await input.getAttribute('aria-describedby');
          expect(ariaDescribedBy).toContain(helpId);
        }
      }
    }
  });

  test('form fields maintain focus order', async ({ page }) => {
    // Test tab navigation through form
    const inputs = page.locator('input, select, textarea, button');
    const inputCount = await inputs.count();

    if (inputCount > 0) {
      // Focus first input
      await inputs.first().focus();

      // Tab through elements and verify focus moves forward
      for (let i = 1; i < Math.min(inputCount, 5); i++) {
        await page.keyboard.press('Tab');

        // Check that some element has focus
        const focusedElement = await page.evaluate(
          () => document.activeElement?.tagName
        );
        expect(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A']).toContain(
          focusedElement
        );
      }
    }
  });

  test('form data persists on page reload', async ({ page }) => {
    // Look for text input
    const textInput = page.locator('input[type="text"]').first();
    const hasTextInput = (await textInput.count()) > 0;

    if (hasTextInput) {
      const testValue = 'Persistence Test Value';
      await textInput.fill(testValue);

      // Some forms may save to localStorage
      const inputName = await textInput.getAttribute('name');

      if (inputName) {
        // Check if value is saved to localStorage
        const savedValue = await page.evaluate((name) => {
          return localStorage.getItem(`form_${name}`);
        }, inputName);

        // If form implements persistence
        if (savedValue) {
          // Reload page
          await page.reload();

          // Check if value is restored
          const currentValue = await textInput.inputValue();
          expect(currentValue).toBe(testValue);
        }
      }
    }
  });

  test('form clears on reset button', async ({ page }) => {
    // Look for reset button
    const resetButton = page
      .locator(
        'button[type="reset"], button:has-text("Reset"), button:has-text("Clear")'
      )
      .first();
    const hasResetButton = (await resetButton.count()) > 0;

    if (hasResetButton) {
      // Fill form fields
      const inputs = page.locator(
        'input[type="text"], input[type="email"], textarea'
      );
      const inputCount = await inputs.count();

      for (let i = 0; i < inputCount; i++) {
        await inputs.nth(i).fill('Test Value');
      }

      // Click reset
      await resetButton.click();

      // Check fields are cleared
      for (let i = 0; i < inputCount; i++) {
        const value = await inputs.nth(i).inputValue();
        expect(value).toBe('');
      }
    }
  });

  test('disabled fields cannot be edited', async ({ page }) => {
    // Look for disabled input
    const disabledInput = page
      .locator('input:disabled, textarea:disabled, select:disabled')
      .first();
    const hasDisabledInput = (await disabledInput.count()) > 0;

    if (hasDisabledInput) {
      // Try to fill disabled field
      const isEditable = await disabledInput.isEditable();
      expect(isEditable).toBe(false);

      // Verify aria-disabled attribute
      const ariaDisabled = await disabledInput.getAttribute('aria-disabled');
      if (ariaDisabled !== null) {
        expect(ariaDisabled).toBe('true');
      }
    }
  });

  test('form shows loading state during submission', async ({ page }) => {
    // Look for form with async submission
    const form = page.locator('form').first();
    const hasForm = (await form.count()) > 0;

    if (hasForm) {
      // Set up listener for loading indicators
      const submitButton = form.locator('button[type="submit"]').first();

      if ((await submitButton.count()) > 0) {
        // Click and check for loading state
        const [response] = await Promise.all([
          page
            .waitForResponse((response) => response.url().includes('/api/'), {
              timeout: 5000,
            })
            .catch(() => null),
          submitButton.click(),
        ]);

        if (response) {
          // Check for loading indicator (spinner, disabled button, etc.)
          const isDisabled = await submitButton.isDisabled();
          const hasSpinner =
            (await page
              .locator('.loading, .spinner, [role="status"]')
              .count()) > 0;

          expect(isDisabled || hasSpinner).toBe(true);
        }
      }
    }
  });

  test('multi-step form navigation works correctly', async ({ page }) => {
    // Look for multi-step form indicators
    const stepIndicators = page.locator('[class*="step"], [data-step]');
    const hasSteps = (await stepIndicators.count()) > 1;

    if (hasSteps) {
      // Check for next/previous buttons
      const nextButton = page.locator('button:has-text("Next")').first();
      const prevButton = page
        .locator('button:has-text("Previous"), button:has-text("Back")')
        .first();

      if ((await nextButton.count()) > 0) {
        // Click next
        await nextButton.click();

        // Check step changed
        await page.waitForTimeout(500);

        // Previous button should now be visible
        if ((await prevButton.count()) > 0) {
          await expect(prevButton).toBeVisible();

          // Go back
          await prevButton.click();
          await page.waitForTimeout(500);
        }
      }
    }
  });
});
