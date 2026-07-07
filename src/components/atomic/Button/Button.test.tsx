import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from './Button';

describe('Button', () => {
  it('renders button with children', () => {
    render(<Button>Click me</Button>);
    expect(
      screen.getByRole('button', { name: 'Click me' })
    ).toBeInTheDocument();
  });

  it('applies variant classes correctly', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-primary');

    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-secondary');

    rerender(<Button variant="accent">Accent</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-accent');

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-ghost');

    rerender(<Button variant="link">Link</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-link');
  });

  it('applies size classes correctly', () => {
    const { rerender } = render(<Button size="xs">XS</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-xs');

    rerender(<Button size="sm">SM</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-sm');

    rerender(<Button size="md">MD</Button>);
    // md size doesn't add a class, it's the default
    expect(screen.getByRole('button')).not.toHaveClass('btn-md');

    rerender(<Button size="lg">LG</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-lg');
  });

  it('applies outline class when outline prop is true', () => {
    render(<Button outline>Outline</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-outline');
  });

  it('applies wide class when wide prop is true', () => {
    render(<Button wide>Wide</Button>);
    expect(screen.getByRole('button')).toHaveClass('btn-wide');
  });

  it('applies disabled attribute when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button');
    // Button doesn't add btn-disabled class, it uses the disabled attribute
    expect(button).toBeDisabled();
  });

  it('applies loading class when loading prop is true', () => {
    render(<Button loading>Loading</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('loading');
    expect(button).toBeDisabled();
    expect(button).toContainHTML('loading');
  });

  it('applies glass class when glass prop is true', () => {
    render(<Button glass>Glass</Button>);
    expect(screen.getByRole('button')).toHaveClass('glass');
  });

  it('handles onClick event', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not trigger onClick when disabled', () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('does not trigger onClick when loading', () => {
    const handleClick = vi.fn();
    render(
      <Button loading onClick={handleClick}>
        Loading
      </Button>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(<Button className="custom-class">Custom</Button>);
    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });

  it('combines multiple props correctly', () => {
    render(
      <Button variant="primary" size="lg" outline wide className="custom">
        Combined
      </Button>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn');
    expect(button).toHaveClass('btn-primary');
    expect(button).toHaveClass('btn-lg');
    expect(button).toHaveClass('btn-outline');
    expect(button).toHaveClass('btn-wide');
    expect(button).toHaveClass('custom');
  });
});
