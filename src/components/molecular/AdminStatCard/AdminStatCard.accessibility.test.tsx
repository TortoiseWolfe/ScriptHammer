import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { AdminStatCard } from './AdminStatCard';

describe('AdminStatCard Accessibility', () => {
  it('should have no accessibility violations (default)', async () => {
    const { container } = render(
      <AdminStatCard label="Total Users" value={42} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations (as link)', async () => {
    const { container } = render(
      <AdminStatCard
        label="Active Users"
        value={100}
        href="/admin/users"
        description="View all users"
        trend="up"
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper aria-label on container', () => {
    const { getByLabelText } = render(
      <AdminStatCard label="Revenue" value="$5,000" />
    );
    expect(getByLabelText('Revenue: $5,000')).toBeInTheDocument();
  });

  it('should render link with accessible name when href is provided', () => {
    const { getByRole } = render(
      <AdminStatCard label="Posts" value={50} href="/admin/posts" />
    );
    const link = getByRole('link', { name: 'Posts: 50' });
    expect(link).toBeInTheDocument();
  });
});
