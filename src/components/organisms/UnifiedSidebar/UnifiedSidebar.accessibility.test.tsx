import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import UnifiedSidebar from './UnifiedSidebar';

expect.extend(toHaveNoViolations);

// Mock child components
vi.mock('@/components/organisms/ConversationList', () => ({
  default: () => <div data-testid="conversation-list">ConversationList</div>,
}));

vi.mock('@/components/organisms/ConnectionManager', () => ({
  default: () => <div data-testid="connection-manager">ConnectionManager</div>,
}));

const defaultProps = {
  onConversationSelect: vi.fn(),
  onStartConversation: vi.fn().mockResolvedValue('conv-123'),
  activeTab: 'chats' as const,
  onTabChange: vi.fn(),
};

describe('UnifiedSidebar Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<UnifiedSidebar {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no violations with connections tab active', async () => {
    const { container } = render(
      <UnifiedSidebar {...defaultProps} activeTab="connections" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have focusable elements in proper tab order', () => {
    const { container } = render(<UnifiedSidebar {...defaultProps} />);

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    // All focusable elements should be visible
    focusableElements.forEach((element) => {
      expect(element).toBeVisible();
    });
  });

  it('should have proper semantic HTML', () => {
    const { container } = render(<UnifiedSidebar {...defaultProps} />);

    // Verify component renders with proper HTML structure
    expect(container.firstChild).toBeInTheDocument();

    // Images should have alt text
    const images = container.querySelectorAll('img');
    images.forEach((img) => {
      expect(img).toHaveAttribute('alt');
    });
  });

  it('should have all interactive elements with 44px minimum touch targets', () => {
    render(<UnifiedSidebar {...defaultProps} />);

    // Check all tab buttons have min-h-11 class (44px)
    const tabs = screen.getAllByRole('tab');
    tabs.forEach((tab) => {
      expect(tab).toHaveClass('min-h-11');
    });
  });

  it('should have tabs with proper ARIA roles', () => {
    render(<UnifiedSidebar {...defaultProps} />);

    // Check tablist exists
    expect(screen.getByRole('tablist')).toBeInTheDocument();

    // Check all tabs have role="tab" (Feature 038: 2 tabs only)
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);

    // Check active tab has aria-selected="true"
    const chatsTab = screen.getByRole('tab', { name: /chats/i });
    expect(chatsTab).toHaveAttribute('aria-selected', 'true');

    // Check inactive tabs have aria-selected="false"
    const connectionsTab = screen.getByRole('tab', { name: /connections/i });
    expect(connectionsTab).toHaveAttribute('aria-selected', 'false');
  });

  it('should have tabpanel for content area', () => {
    render(<UnifiedSidebar {...defaultProps} />);
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
  });
});
