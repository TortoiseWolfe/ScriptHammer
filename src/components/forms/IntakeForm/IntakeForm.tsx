'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

/**
 * What the buyer tells us about the job, captured at checkout.
 *
 * PHONE IS REQUIRED, and that is a product decision rather than a form-design
 * one (FR-013). The catalog promises every build ships with click-to-call and
 * "a form wired to your inbox and phone" — the product cannot deliver what it
 * sells without asking for the number.
 *
 * Composed from src/schemas/forms.ts primitives where they fit. `phoneSchema`
 * there is `.optional()` WITHOUT `.or(z.literal(''))`, so an empty controlled
 * input fails its regex rather than being treated as absent; phone is required
 * here so that does not bite, but do not reuse it optionally without the union.
 */
export const intakeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Your name is required')
    .max(100, 'Name must be under 100 characters'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  phone: z
    .string()
    .trim()
    .min(1, 'Phone is required — every build ships with click-to-call')
    .regex(
      /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/,
      'Please enter a valid phone number'
    ),
  business: z
    .string()
    .trim()
    .min(1, 'Business name is required')
    .max(120, 'Business name must be under 120 characters'),
  domain: z.string().trim().max(253).optional().or(z.literal('')),
  reference_url: z
    .string()
    .trim()
    .url('Please enter a valid URL, including https://')
    .optional()
    .or(z.literal('')),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

export type IntakeFormData = z.infer<typeof intakeSchema>;

export interface IntakeFormProps {
  /** Receives validated intake. The page owns what happens next. */
  onSubmit: (data: IntakeFormData) => void | Promise<void>;
  /** Disables every control — used while the order is being created. */
  busy?: boolean;
  /** Label for the submit button; the page sets the amount. */
  submitLabel?: string;
  className?: string;
}

interface FieldProps {
  id: keyof IntakeFormData;
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}

/**
 * One field, wired the way ContactForm wires its own: aria-required,
 * aria-invalid, aria-describedby pointing at a live error region.
 */
function Field({ id, label, error, required, hint, children }: FieldProps) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="label">
        <span className="text-base-content">{label}</span>
        {required && (
          <span className="text-error" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-base-content mt-1 text-xs">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm">
          <span className="text-error" role="alert" aria-live="polite">
            {error}
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * Tell us about the job.
 *
 * @category forms
 */
export default function IntakeForm({
  onSubmit,
  busy = false,
  submitLabel = 'Continue to payment',
  className = '',
}: IntakeFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
  } = useForm<IntakeFormData>({
    resolver: zodResolver(intakeSchema),
    mode: 'onSubmit',
    reValidateMode: 'onBlur',
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      business: '',
      domain: '',
      reference_url: '',
      notes: '',
    },
  });

  // Move focus to the first thing that is wrong, so a keyboard or screen-reader
  // user is not left hunting. Same effect as ContactForm.
  useEffect(() => {
    const first = (Object.keys(errors) as (keyof IntakeFormData)[])[0];
    if (first) setFocus(first);
  }, [errors, setFocus]);

  const cls = (bad: unknown, base = 'input') =>
    `${base} w-full min-w-0 ${bad ? `${base}-error` : ''}`;

  const aria = (id: keyof IntakeFormData, hasHint = false) => ({
    id,
    'aria-required': true as const,
    'aria-invalid': !!errors[id],
    'aria-describedby': errors[id]
      ? `${id}-error`
      : hasHint
        ? `${id}-hint`
        : undefined,
  });

  return (
    <form
      noValidate
      aria-label="Job details"
      className={`min-w-0 space-y-8 ${className}`}
      onSubmit={handleSubmit(onSubmit)}
    >
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <legend className="text-base-content mb-2 text-lg font-semibold">
          Your details
        </legend>

        <Field
          id="name"
          label="Your name"
          required
          error={errors.name?.message}
        >
          <input
            {...register('name')}
            {...aria('name')}
            type="text"
            autoComplete="name"
            className={cls(errors.name)}
          />
        </Field>

        <Field id="email" label="Email" required error={errors.email?.message}>
          <input
            {...register('email')}
            {...aria('email')}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={cls(errors.email)}
          />
        </Field>

        <Field
          id="phone"
          label="Phone"
          required
          error={errors.phone?.message}
          hint="Your build ships with click-to-call, so we need a number to wire it to."
        >
          <input
            {...register('phone')}
            {...aria('phone', true)}
            type="tel"
            autoComplete="tel"
            placeholder="(423) 555-0137"
            className={cls(errors.phone)}
          />
        </Field>
      </fieldset>

      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <legend className="text-base-content mb-2 text-lg font-semibold">
          About the job
        </legend>

        <Field
          id="business"
          label="Business name"
          required
          error={errors.business?.message}
        >
          <input
            {...register('business')}
            {...aria('business')}
            type="text"
            autoComplete="organization"
            placeholder="Warrior Roofing"
            className={cls(errors.business)}
          />
        </Field>

        <Field
          id="domain"
          label="Domain (optional)"
          error={errors.domain?.message}
        >
          <input
            {...register('domain')}
            id="domain"
            aria-invalid={!!errors.domain}
            aria-describedby={errors.domain ? 'domain-error' : undefined}
            type="text"
            autoComplete="url"
            placeholder="warriorroofingtn.com"
            className={cls(errors.domain)}
          />
        </Field>

        <Field
          id="reference_url"
          label="Reference site (optional)"
          error={errors.reference_url?.message}
        >
          <input
            {...register('reference_url')}
            id="reference_url"
            aria-invalid={!!errors.reference_url}
            aria-describedby={
              errors.reference_url ? 'reference_url-error' : undefined
            }
            type="url"
            placeholder="https://example.carrd.co"
            className={cls(errors.reference_url)}
          />
        </Field>

        <Field
          id="notes"
          label="Anything else? (optional)"
          error={errors.notes?.message}
        >
          <textarea
            {...register('notes')}
            id="notes"
            aria-invalid={!!errors.notes}
            aria-describedby={errors.notes ? 'notes-error' : undefined}
            rows={4}
            placeholder="Want it to look like the carrd but higher end"
            className={cls(errors.notes, 'textarea')}
          />
        </Field>
      </fieldset>

      {/* min-h-11 = the 44px touch target this repo requires. */}
      <button
        type="submit"
        disabled={busy}
        className="btn btn-primary min-h-11 w-full min-w-11"
      >
        {busy ? 'Working…' : submitLabel}
      </button>
    </form>
  );
}
