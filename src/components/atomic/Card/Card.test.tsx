import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Card from './Card';

describe('Card', () => {
  it('renders children content', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(<Card title="Card Title">Content</Card>);
    expect(
      screen.getByRole('heading', { name: 'Card Title' })
    ).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<Card subtitle="Card subtitle">Content</Card>);
    expect(screen.getByText('Card subtitle')).toBeInTheDocument();
  });

  it('renders both title and subtitle', () => {
    render(
      <Card title="Title" subtitle="Subtitle">
        Content
      </Card>
    );
    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument();
    expect(screen.getByText('Subtitle')).toBeInTheDocument();
  });

  it('renders image when provided', () => {
    render(
      <Card image={{ src: '/test.jpg', alt: 'Test image' }}>Content</Card>
    );
    const image = screen.getByAltText('Test image');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src');
  });

  it('renders actions when provided', () => {
    render(<Card actions={<button>Action Button</button>}>Content</Card>);
    expect(
      screen.getByRole('button', { name: 'Action Button' })
    ).toBeInTheDocument();
  });

  it('applies compact class when compact prop is true', () => {
    const { container } = render(<Card compact>Content</Card>);
    expect(container.firstChild).toHaveClass('card-compact');
  });

  it('applies side class when side prop is true (mobile-first: md:card-side)', () => {
    const { container } = render(<Card side>Content</Card>);
    expect(container.firstChild).toHaveClass('md:card-side');
  });

  it('applies glass class when glass prop is true', () => {
    const { container } = render(<Card glass>Content</Card>);
    expect(container.firstChild).toHaveClass('glass');
  });

  it('applies bordered class when bordered prop is true', () => {
    const { container } = render(<Card bordered>Content</Card>);
    expect(container.firstChild).toHaveClass('card-bordered');
  });

  it('applies custom className', () => {
    const { container } = render(<Card className="custom-class">Content</Card>);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('combines multiple props correctly', () => {
    const { container } = render(
      <Card compact glass bordered className="custom">
        Content
      </Card>
    );

    const card = container.firstChild;
    expect(card).toHaveClass('card');
    expect(card).toHaveClass('bg-base-100');
    expect(card).toHaveClass('shadow-xl');
    expect(card).toHaveClass('card-compact');
    expect(card).toHaveClass('glass');
    expect(card).toHaveClass('card-bordered');
    expect(card).toHaveClass('custom');
  });

  it('renders complex card with all features', () => {
    render(
      <Card
        title={<span>Custom Title</span>}
        subtitle="Subtitle text"
        image={{ src: '/image.jpg', alt: 'Card image' }}
        actions={
          <>
            <button>Action 1</button>
            <button>Action 2</button>
          </>
        }
        side
      >
        Main content
      </Card>
    );

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText('Subtitle text')).toBeInTheDocument();
    expect(screen.getByAltText('Card image')).toBeInTheDocument();
    expect(screen.getByText('Main content')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Action 1' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Action 2' })
    ).toBeInTheDocument();
  });

  it('handles React node as title', () => {
    const TitleComponent = () => <span>React Node Title</span>;
    render(<Card title={<TitleComponent />}>Content</Card>);
    expect(screen.getByText('React Node Title')).toBeInTheDocument();
  });
});
