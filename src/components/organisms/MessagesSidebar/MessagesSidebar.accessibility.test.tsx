import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import MessagesSidebar from './MessagesSidebar';

expect.extend(toHaveNoViolations);

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => null, toString: () => '' }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/services/messaging/connection-service', () => ({
  connectionService: { getOrCreateConversation: vi.fn() },
}));

vi.mock('@/components/organisms/UnifiedSidebar', () => ({
  default: () => <div data-testid="unified-sidebar-mock" />,
}));

describe('MessagesSidebar Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(
      <MessagesSidebar
        selectedConversationId={null}
        onConversationSelect={vi.fn()}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should render as an aside landmark', () => {
    const { container } = render(
      <MessagesSidebar
        selectedConversationId={null}
        onConversationSelect={vi.fn()}
      />
    );
    expect(container.querySelector('aside')).toBeInTheDocument();
  });
});
