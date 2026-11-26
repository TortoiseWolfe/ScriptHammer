import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import BandSchedule from './BandSchedule';

expect.extend(toHaveNoViolations);

describe('BandSchedule Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<BandSchedule />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('gives each table a caption and column headers', () => {
    const { container } = render(<BandSchedule />);
    const tables = container.querySelectorAll('table');
    expect(tables).toHaveLength(2);
    tables.forEach((table) => {
      expect(table.querySelector('caption')).not.toBeNull();
      expect(table.querySelectorAll('thead th[scope="col"]')).toHaveLength(2);
    });
  });
});
