import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { useFormValidation } from '../useFormValidation';

describe('useFormValidation', () => {
  const testSchema = z.object({
    email: z.string().email('Invalid email'),
    name: z.string().min(3, 'Name must be at least 3 characters'),
  });

  describe('field validation', () => {
    it('should validate fields with correct values', async () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      await act(async () => {
        await result.current.validateField('email', 'test@example.com', true);
      });

      expect(result.current.errors.email?.valid).toBe(true);
    });

    it('should report errors for invalid values', async () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      await act(async () => {
        await result.current.validateField('email', 'invalid-email', true);
      });

      expect(result.current.errors.email?.valid).toBe(false);
      expect(result.current.errors.email?.error).toBe('Invalid email');
    });

    it('should debounce validation by default', async () => {
      const { result } = renderHook(() =>
        useFormValidation(testSchema, { debounceMs: 100 })
      );

      act(() => {
        result.current.validateField('email', 'test@example.com');
      });

      // Should be validating
      expect(result.current.isValidating).toBe(true);

      // Wait for debounce
      await waitFor(
        () => {
          expect(result.current.isValidating).toBe(false);
        },
        { timeout: 200 }
      );

      expect(result.current.errors.email?.valid).toBe(true);
    });

    it('should validate immediately when requested', async () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      await act(async () => {
        await result.current.validateField('email', 'test@example.com', true);
      });

      expect(result.current.errors.email?.valid).toBe(true);
    });
  });

  describe('form validation', () => {
    it('should validate all fields in form data', async () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      const formData = {
        email: 'test@example.com',
        name: 'John Doe',
      };

      await act(async () => {
        await result.current.validateForm(formData);
      });

      expect(result.current.errors.email?.valid).toBe(true);
      expect(result.current.errors.name?.valid).toBe(true);
      expect(result.current.isValid).toBe(true);
    });

    it('should detect invalid form data', async () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      const formData = {
        email: 'invalid',
        name: 'Jo', // Too short
      };

      await act(async () => {
        await result.current.validateForm(formData);
      });

      expect(result.current.errors.email?.valid).toBe(false);
      expect(result.current.errors.name?.valid).toBe(false);
      expect(result.current.hasErrors).toBe(true);
    });
  });

  describe('field state management', () => {
    it('should track touched fields', () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      act(() => {
        result.current.touchField('email');
      });

      expect(result.current.touched.has('email')).toBe(true);
      expect(result.current.getFieldState('email').isTouched).toBe(true);
    });

    it('should only show errors for touched fields by default', async () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      await act(async () => {
        await result.current.validateField('email', 'invalid', true);
      });

      // Field not touched yet
      expect(result.current.getFieldError('email')).toBeUndefined();

      act(() => {
        result.current.touchField('email');
      });

      // Now error should show
      expect(result.current.getFieldError('email')).toBe('Invalid email');
    });

    it('should show errors immediately when configured', async () => {
      const { result } = renderHook(() =>
        useFormValidation(testSchema, { showErrorsImmediately: true })
      );

      await act(async () => {
        await result.current.validateField('email', 'invalid', true);
      });

      // Error shows without touching
      expect(result.current.getFieldError('email')).toBe('Invalid email');
    });
  });

  describe('reset functionality', () => {
    it('should reset individual fields', async () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      await act(async () => {
        await result.current.validateField('email', 'invalid', true);
        result.current.touchField('email');
      });

      expect(result.current.errors.email).toBeDefined();
      expect(result.current.touched.has('email')).toBe(true);

      act(() => {
        result.current.resetField('email');
      });

      expect(result.current.errors.email).toBeUndefined();
      expect(result.current.touched.has('email')).toBe(false);
    });

    it('should reset entire form', async () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      await act(async () => {
        await result.current.validateForm({
          email: 'invalid',
          name: 'Jo',
        });
        result.current.touchField('email');
        result.current.touchField('name');
      });

      expect(result.current.hasErrors).toBe(true);
      expect(result.current.touched.size).toBe(2);

      act(() => {
        result.current.resetForm();
      });

      expect(result.current.errors).toEqual({});
      expect(result.current.touched.size).toBe(0);
    });
  });

  describe('event handlers', () => {
    it('should handle change events', async () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      const event = {
        target: { value: 'test@example.com' },
      } as React.ChangeEvent<HTMLInputElement>;

      let value: string = '';
      await act(async () => {
        value = result.current.handleChange('email')(event);
      });

      expect(value).toBe('test@example.com');
    });

    it('should handle blur events', () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      // Mock DOM element
      const input = document.createElement('input');
      input.name = 'email';
      input.value = 'test@example.com';
      document.body.appendChild(input);

      act(() => {
        result.current.handleBlur('email')();
      });

      expect(result.current.touched.has('email')).toBe(true);

      // Cleanup
      document.body.removeChild(input);
    });
  });

  describe('register helper', () => {
    it('should return field props', async () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      await act(async () => {
        await result.current.validateField('email', 'invalid', true);
        result.current.touchField('email');
      });

      const props = result.current.register('email');

      expect(props.name).toBe('email');
      expect(props['aria-invalid']).toBe(true);
      expect(props['aria-describedby']).toBe('email-error');
      expect(props.onBlur).toBeDefined();
      expect(props.onChange).toBeDefined();
    });

    it('should not set aria attributes for valid fields', () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      const props = result.current.register('email');

      expect(props['aria-invalid']).toBe(false);
      expect(props['aria-describedby']).toBeUndefined();
    });
  });

  describe('validation options', () => {
    it('should respect validateOnChange option', async () => {
      const { result } = renderHook(() =>
        useFormValidation(testSchema, { validateOnChange: false })
      );

      const event = {
        target: { value: 'invalid' },
      } as React.ChangeEvent<HTMLInputElement>;

      await act(async () => {
        result.current.handleChange('email')(event);
      });

      // Should not validate
      expect(result.current.errors.email).toBeUndefined();
    });

    it('should respect validateOnBlur option', () => {
      const { result } = renderHook(() =>
        useFormValidation(testSchema, { validateOnBlur: false })
      );

      const input = document.createElement('input');
      input.name = 'email';
      input.value = 'invalid';
      document.body.appendChild(input);

      act(() => {
        result.current.handleBlur('email')();
      });

      // Should only touch, not validate
      expect(result.current.touched.has('email')).toBe(true);
      expect(result.current.errors.email).toBeUndefined();

      document.body.removeChild(input);
    });
  });

  describe('non-object schemas', () => {
    it('should handle non-object schemas', async () => {
      const stringSchema = z.string().min(3);
      const { result } = renderHook(() => useFormValidation(stringSchema));

      await act(async () => {
        await result.current.validateField('value', 'test', true);
      });

      expect(result.current.errors.value?.valid).toBe(true);

      await act(async () => {
        await result.current.validateField('value', 'ab', true);
      });

      expect(result.current.errors.value?.valid).toBe(false);
    });
  });
});
