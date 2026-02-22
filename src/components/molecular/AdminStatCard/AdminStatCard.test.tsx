import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminStatCard } from './AdminStatCard';

describe('AdminStatCard', () => {
  it('renders label and value', () => {
    render(<AdminStatCard label="Total Users" value={42} />);
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <AdminStatCard
        label="Revenue"
        value="$1,200"
        description="Last 30 days"
      />
    );
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
  });

  it('renders as a link when href is provided', () => {
    render(<AdminStatCard label="Users" value={100} href="/admin/users" />);
    const link = screen.getByRole('link', { name: 'Users: 100' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/admin/users');
    expect(link).toHaveClass('hover:shadow-md');
  });

  it('renders as a div when no href is provided', () => {
    render(<AdminStatCard label="Posts" value={25} />);
    const element = screen.getByLabelText('Posts: 25');
    expect(element.tagName).toBe('DIV');
  });

  it('has accessible aria-label', () => {
    render(<AdminStatCard label="Active Sessions" value={7} />);
    expect(screen.getByLabelText('Active Sessions: 7')).toBeInTheDocument();
  });

  it('shows up trend indicator', () => {
    render(<AdminStatCard label="Users" value={50} trend="up" />);
    const statValue = screen.getByText(/50/);
    expect(statValue).toHaveClass('text-success');
    expect(statValue.textContent).toContain('\u2191');
  });

  it('shows down trend indicator', () => {
    render(<AdminStatCard label="Errors" value={3} trend="down" />);
    const statValue = screen.getByText(/3/);
    expect(statValue).toHaveClass('text-error');
    expect(statValue.textContent).toContain('\u2193');
  });

  it('accepts custom className', () => {
    render(<AdminStatCard label="Test" value={1} className="custom-class" />);
    const element = screen.getByLabelText('Test: 1');
    expect(element).toHaveClass('custom-class');
  });

  it('accepts testId', () => {
    render(<AdminStatCard label="Test" value={1} testId="stat-card" />);
    expect(screen.getByTestId('stat-card')).toBeInTheDocument();
  });
});
