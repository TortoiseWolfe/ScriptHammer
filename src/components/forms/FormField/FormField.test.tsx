import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FormField, getFormFieldInputProps } from './FormField';

describe('FormField', () => {
  it('associates the label with the input by name', () => {
    render(
      <FormField label="Email Address" name="email">
        <input {...getFormFieldInputProps({ name: 'email' })} type="email" />
      </FormField>
    );
    // getByLabelText only resolves through a real htmlFor/id association.
    expect(screen.getByLabelText('Email Address')).toHaveAttribute(
      'type',
      'email'
    );
  });

  it('marks a required field for assistive tech, not just visually', () => {
    render(
      <FormField label="Email" name="email" required>
        <input {...getFormFieldInputProps({ name: 'email', required: true })} />
      </FormField>
    );
    expect(screen.getByLabelText(/Email/)).toHaveAttribute(
      'aria-required',
      'true'
    );
    // The asterisk is decorative text; it carries its own label so it is not
    // announced as a bare "*".
    expect(screen.getByLabelText('required')).toBeInTheDocument();
  });

  it('renders help text when there is no error', () => {
    render(
      <FormField label="Email" name="email" helpText="We never share it">
        <input />
      </FormField>
    );
    expect(screen.getByText('We never share it')).toHaveAttribute(
      'id',
      'email-help'
    );
  });

  it('DROPS help text once there is an error', () => {
    render(
      <FormField
        label="Email"
        name="email"
        helpText="We never share it"
        error="Invalid email"
      >
        <input />
      </FormField>
    );
    expect(screen.queryByText('We never share it')).not.toBeInTheDocument();
    expect(screen.getByText('Invalid email')).toBeInTheDocument();
  });

  it('hides the label visually while keeping it for screen readers', () => {
    render(
      <FormField label="Search" name="q" hideLabel>
        <input {...getFormFieldInputProps({ name: 'q' })} />
      </FormField>
    );
    // Still resolvable by name — sr-only, not display:none.
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
    expect(screen.getByText('Search').closest('label')).toHaveClass('sr-only');
  });
});

describe('getFormFieldInputProps', () => {
  it('describes ONLY elements FormField actually renders', () => {
    // The regression this pins: help text is dropped on error, so naming the help
    // id alongside the error id points aria-describedby at an element that is not
    // in the document. Both ids together are only correct when both exist.
    const withBoth = getFormFieldInputProps({
      name: 'email',
      error: 'Invalid',
      helpText: 'Help',
    });
    expect(withBoth['aria-describedby']).toBe('email-error');

    const helpOnly = getFormFieldInputProps({
      name: 'email',
      helpText: 'Help',
    });
    expect(helpOnly['aria-describedby']).toBe('email-help');

    const neither = getFormFieldInputProps({ name: 'email' });
    expect(neither['aria-describedby']).toBeUndefined();
  });

  it('flags invalidity and adds the error class only when errored', () => {
    expect(
      getFormFieldInputProps({ name: 'x', error: 'e' })['aria-invalid']
    ).toBe(true);
    expect(getFormFieldInputProps({ name: 'x' })['aria-invalid']).toBe(false);
    expect(
      getFormFieldInputProps({ name: 'x', error: 'e' }).className
    ).toContain('input-error');
    expect(getFormFieldInputProps({ name: 'x' }).className).not.toContain(
      'input-error'
    );
  });
});
