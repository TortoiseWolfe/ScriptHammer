import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import SocialShareButtons from './SocialShareButtons';
import type { ShareOptions } from '@/types/social';

describe('SocialShareButtons', () => {
  const mockShareOptions: ShareOptions = {
    title: 'Test Title',
    text: 'Test text',
    url: 'https://example.com',
  };

  it('renders without crashing', () => {
    const { container } = render(
      <SocialShareButtons shareOptions={mockShareOptions} />
    );
    expect(container).toBeInTheDocument();
  });

  it('displays share buttons', () => {
    const { container } = render(
      <SocialShareButtons shareOptions={mockShareOptions} />
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('accepts custom className', () => {
    const { container } = render(
      <SocialShareButtons
        shareOptions={mockShareOptions}
        className="custom-class"
      />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
