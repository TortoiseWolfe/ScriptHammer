import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('renders without crashing', () => {
    render(<Tooltip text="Test tooltip">Test content</Tooltip>);
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  // TODO: Add more specific tests
});
