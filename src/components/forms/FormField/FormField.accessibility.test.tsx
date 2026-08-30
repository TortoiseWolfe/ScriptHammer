import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { FormField, getFormFieldInputProps } from './FormField';

expect.extend(toHaveNoViolations);

/**
 * FormField renders `{children}` untouched — the consumer wires the input, which is
 * why `getFormFieldInputProps` exists. So the accessibility contract only holds for
 * the PAIR, and the pair is what these cases render. A test of the wrapper alone
 * would pass while every real field was mislabelled.
 */
describe('FormField Accessibility', () => {
  const states = [
    { name: 'plain', props: {} },
    { name: 'required', props: { required: true } },
    { name: 'with help text', props: { helpText: 'We never share it' } },
    { name: 'errored', props: { error: 'Enter a valid email' } },
    {
      name: 'errored WITH help text',
      props: { error: 'Enter a valid email', helpText: 'We never share it' },
    },
    { name: 'visually hidden label', props: { hideLabel: true } },
  ];

  for (const { name, props } of states) {
    it(`has no violations — ${name}`, async () => {
      const { container } = render(
        <FormField label="Email" name="email" {...props}>
          <input
            type="email"
            {...getFormFieldInputProps({ name: 'email', ...props })}
          />
        </FormField>
      );
      // aria-valid-attr-value is the rule that catches an aria-describedby naming
      // an id that is not in the document — the "errored WITH help text" case.
      expect(await axe(container)).toHaveNoViolations();
    });
  }

  it('never describes an id that is absent from the document', async () => {
    // Stated directly as well as via axe, because this is the specific defect the
    // pair had: help text is not rendered once there is an error.
    const { container } = render(
      <FormField
        label="Email"
        name="email"
        error="Enter a valid email"
        helpText="We never share it"
      >
        <input
          {...getFormFieldInputProps({
            name: 'email',
            error: 'Enter a valid email',
            helpText: 'We never share it',
          })}
        />
      </FormField>
    );
    const described = container
      .querySelector('input')
      ?.getAttribute('aria-describedby');
    for (const id of (described ?? '').split(' ').filter(Boolean)) {
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
  });
});
