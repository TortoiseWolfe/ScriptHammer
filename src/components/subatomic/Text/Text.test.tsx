import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Text } from './Text';

describe('Text Component', () => {
  it('renders children correctly', () => {
    render(<Text>Hello World</Text>);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('applies default body variant', () => {
    render(<Text>Body text</Text>);
    const element = screen.getByText('Body text');
    expect(element).toHaveClass('text-base', 'text-base-content');
    expect(element.tagName).toBe('P');
  });

  it('renders heading variants with correct tags', () => {
    const { container } = render(
      <>
        <Text variant="h1">Heading 1</Text>
        <Text variant="h2">Heading 2</Text>
        <Text variant="h3">Heading 3</Text>
      </>
    );

    expect(container.querySelector('h1')).toHaveTextContent('Heading 1');
    expect(container.querySelector('h2')).toHaveTextContent('Heading 2');
    expect(container.querySelector('h3')).toHaveTextContent('Heading 3');
  });

  it('applies correct styles for each variant', () => {
    const { rerender } = render(<Text variant="h1">Test</Text>);
    expect(screen.getByText('Test')).toHaveClass('text-5xl', 'font-bold');

    rerender(<Text variant="small">Test</Text>);
    expect(screen.getByText('Test')).toHaveClass(
      'text-sm',
      'text-base-content/70'
    );

    rerender(<Text variant="code">Test</Text>);
    expect(screen.getByText('Test')).toHaveClass('font-mono', 'bg-base-200');
  });

  it('respects custom className', () => {
    render(<Text className="custom-class">Custom</Text>);
    expect(screen.getByText('Custom')).toHaveClass('custom-class');
  });

  it('allows overriding element type with "as" prop', () => {
    render(<Text as="span">Span text</Text>);
    const element = screen.getByText('Span text');
    expect(element.tagName).toBe('SPAN');
  });

  it('combines variant styles with custom className', () => {
    render(
      <Text variant="h2" className="text-primary">
        Combined styles
      </Text>
    );
    const element = screen.getByText('Combined styles');
    expect(element).toHaveClass('text-4xl', 'font-bold', 'text-primary');
  });

  it('renders emphasis variant as italic', () => {
    render(<Text variant="emphasis">Emphasized text</Text>);
    const element = screen.getByText('Emphasized text');
    expect(element.tagName).toBe('EM');
    expect(element).toHaveClass('italic');
  });

  it('renders code variant with proper styling', () => {
    render(<Text variant="code">const code = true</Text>);
    const element = screen.getByText('const code = true');
    expect(element.tagName).toBe('CODE');
    expect(element).toHaveClass('font-mono', 'bg-base-200', 'rounded');
  });
});
