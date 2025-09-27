import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Text, type TextVariant } from './Text';

expect.extend(toHaveNoViolations);

describe('Text Accessibility', () => {
  it('should have no accessibility violations with default props', async () => {
    const { container } = render(<Text>Default text content</Text>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with all text variants', async () => {
    const variants: TextVariant[] = [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'body',
      'lead',
      'small',
      'code',
      'emphasis',
      'caption',
    ];

    for (const variant of variants) {
      const { container } = render(<Text variant={variant}>Text content</Text>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    }
  });

  it('should have no violations with className overrides', async () => {
    const { container } = render(
      <Text className="text-lg font-bold">Styled text</Text>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should maintain proper heading hierarchy', async () => {
    const { container } = render(
      <div>
        <Text variant="h1">Main Heading</Text>
        <Text variant="h2">Subheading</Text>
        <Text variant="h3">Section</Text>
        <Text variant="body">Body text</Text>
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have sufficient color contrast', async () => {
    const { container } = render(
      <div style={{ backgroundColor: 'white' }}>
        <Text>Default text</Text>
        <Text variant="lead">Lead text</Text>
        <Text variant="small">Small text</Text>
        <Text variant="caption">Caption text</Text>
      </div>
    );

    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
      },
    });

    expect(results).toHaveNoViolations();
  });

  it('should handle different element types accessibly', async () => {
    const elements = ['div', 'span', 'p', 'article', 'section'] as const;

    for (const element of elements) {
      const { container } = render(<Text as={element}>Text as {element}</Text>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    }
  });

  it('should use semantic HTML elements', () => {
    const { container: h1Container } = render(<Text as="h1">Heading 1</Text>);
    expect(h1Container.querySelector('h1')).toBeTruthy();

    const { container: pContainer } = render(<Text as="p">Paragraph</Text>);
    expect(pContainer.querySelector('p')).toBeTruthy();

    const { container: spanContainer } = render(
      <Text as="span">Span text</Text>
    );
    expect(spanContainer.querySelector('span')).toBeTruthy();
  });

  it('should handle emphasized text accessibly', async () => {
    const { container } = render(
      <div>
        <Text as="strong">Strong text</Text>
        <Text as="em">Emphasized text</Text>
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should maintain readability with different styles', async () => {
    const { container } = render(
      <div>
        <Text variant="emphasis">Emphasized text</Text>
        <Text variant="code">Code text</Text>
        <Text className="line-through">Strike-through text</Text>
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should handle long text content appropriately', async () => {
    const { container } = render(
      <Text>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
        veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
        commodo consequat.
      </Text>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
