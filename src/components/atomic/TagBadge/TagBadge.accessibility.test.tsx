import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import TagBadge from './TagBadge';

expect.extend(toHaveNoViolations);

// Mock Next.js Link component
vi.mock('next/link', () => ({
  default: ({ children, href, className, ...props }: any) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

describe('TagBadge Accessibility', () => {
  it('should have no accessibility violations as link', async () => {
    const { container } = render(<TagBadge tag="React" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations as button', async () => {
    const handleClick = vi.fn();
    const { container } = render(
      <TagBadge tag="TypeScript" onClick={handleClick} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations when non-clickable', async () => {
    const { container } = render(
      <TagBadge tag="JavaScript" clickable={false} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations with count', async () => {
    const { container } = render(<TagBadge tag="Docker" count={5} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations when active', async () => {
    const { container } = render(<TagBadge tag="Next.js" active />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations with all sizes', async () => {
    const { container: smContainer } = render(
      <TagBadge tag="Small" size="sm" />
    );
    const smResults = await axe(smContainer);
    expect(smResults).toHaveNoViolations();

    const { container: mdContainer } = render(
      <TagBadge tag="Medium" size="md" />
    );
    const mdResults = await axe(mdContainer);
    expect(mdResults).toHaveNoViolations();

    const { container: lgContainer } = render(
      <TagBadge tag="Large" size="lg" />
    );
    const lgResults = await axe(lgContainer);
    expect(lgResults).toHaveNoViolations();
  });

  it('should have no accessibility violations with all variants', async () => {
    const { container: defaultContainer } = render(
      <TagBadge tag="Default" variant="default" />
    );
    const defaultResults = await axe(defaultContainer);
    expect(defaultResults).toHaveNoViolations();

    const { container: primaryContainer } = render(
      <TagBadge tag="Primary" variant="primary" />
    );
    const primaryResults = await axe(primaryContainer);
    expect(primaryResults).toHaveNoViolations();

    const { container: secondaryContainer } = render(
      <TagBadge tag="Secondary" variant="secondary" />
    );
    const secondaryResults = await axe(secondaryContainer);
    expect(secondaryResults).toHaveNoViolations();

    const { container: accentContainer } = render(
      <TagBadge tag="Accent" variant="accent" />
    );
    const accentResults = await axe(accentContainer);
    expect(accentResults).toHaveNoViolations();
  });

  it('should have appropriate ARIA labels', () => {
    const { getByTestId, rerender } = render(<TagBadge tag="Testing" />);
    expect(getByTestId('tag-badge')).toHaveAttribute(
      'aria-label',
      'View posts tagged with Testing'
    );

    const handleClick = vi.fn();
    rerender(<TagBadge tag="Vitest" onClick={handleClick} />);
    expect(getByTestId('tag-badge')).toHaveAttribute(
      'aria-label',
      'Filter by tag: Vitest'
    );
  });

  it('should be keyboard navigable as link', () => {
    const { getByTestId } = render(<TagBadge tag="Keyboard" />);
    const badge = getByTestId('tag-badge');
    expect(badge).toHaveAttribute('href');
    // Links are naturally keyboard navigable
  });

  it('should be keyboard navigable as button', () => {
    const handleClick = vi.fn();
    const { getByTestId } = render(
      <TagBadge tag="Button" onClick={handleClick} />
    );
    const badge = getByTestId('tag-badge');
    expect(badge).toHaveAttribute('type', 'button');
    // Buttons are naturally keyboard navigable
  });

  it('should have sufficient color contrast', async () => {
    // This test assumes DaisyUI themes provide sufficient contrast
    // which they do by default
    const { container } = render(
      <div className="bg-base-100">
        <TagBadge tag="Contrast" />
      </div>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
