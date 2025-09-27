import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Card } from './Card';
import { Button } from '../Button/Button';

expect.extend(toHaveNoViolations);

describe('Card Accessibility', () => {
  it('should have no accessibility violations with basic props', async () => {
    const { container } = render(
      <Card title="Test Card">Card content goes here</Card>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with all props', async () => {
    const { container } = render(
      <Card
        title="Complete Card"
        subtitle="Card subtitle"
        image={{ src: '/test.jpg', alt: 'Test image description' }}
        actions={<Button>Action</Button>}
      >
        Card content with all props
      </Card>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with different styles', async () => {
    const styles = [
      { compact: true },
      { side: true },
      { glass: true },
      { bordered: true },
    ];

    for (const style of styles) {
      const { container } = render(
        <Card title="Styled Card" {...style}>
          Content
        </Card>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    }
  });

  it('should require alt text for images', async () => {
    const { container } = render(
      <Card
        title="Card with Image"
        image={{ src: '/test.jpg', alt: 'Descriptive alt text' }}
      >
        Content
      </Card>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper heading hierarchy', () => {
    const { container } = render(
      <Card title="Heading Test" subtitle="Subtitle Test">
        Content
      </Card>
    );

    // Check that headings are present and in correct order
    const heading = container.querySelector('h2');
    expect(heading).toBeTruthy();
    expect(heading?.textContent).toBe('Heading Test');
  });

  it('should handle complex content accessibly', async () => {
    const { container } = render(
      <Card
        title="Complex Card"
        subtitle="With multiple elements"
        actions={
          <>
            <Button variant="ghost">Cancel</Button>
            <Button variant="primary">Confirm</Button>
          </>
        }
      >
        <div>
          <p>Paragraph content</p>
          <ul>
            <li>List item 1</li>
            <li>List item 2</li>
          </ul>
        </div>
      </Card>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should maintain proper contrast in glass mode', async () => {
    const { container } = render(
      <div style={{ backgroundColor: '#f0f0f0' }}>
        <Card title="Glass Card" glass>
          Content with glass effect
        </Card>
      </div>
    );

    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
      },
    });

    expect(results).toHaveNoViolations();
  });

  it('should have accessible interactive elements in actions', async () => {
    const { container, getByRole } = render(
      <Card title="Interactive Card" actions={<Button>Click Me</Button>}>
        Content
      </Card>
    );

    const button = getByRole('button');
    expect(button).toBeTruthy();
    expect(button.textContent).toBe('Click Me');

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should handle side layout accessibly', async () => {
    const { container } = render(
      <Card
        title="Side Layout Card"
        image={{ src: '/test.jpg', alt: 'Side image' }}
        side
      >
        Content in side layout
      </Card>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should maintain semantic structure', () => {
    const { container } = render(
      <Card title="Semantic Test">
        <p>First paragraph</p>
        <p>Second paragraph</p>
      </Card>
    );

    const article = container.querySelector('article');
    expect(article).toBeTruthy();

    const header = container.querySelector('header');
    expect(header).toBeTruthy();
  });
});
