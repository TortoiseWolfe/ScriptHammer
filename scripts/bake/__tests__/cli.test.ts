import { describe, it, expect } from 'vitest';
import { parseCliArgs } from '../run';

describe('parseCliArgs', () => {
  it('defaults to the flagship site', () => {
    expect(parseCliArgs([])).toEqual({ kind: 'site', slug: 'chatt' });
  });
  it('bakes a named site', () => {
    expect(parseCliArgs(['--site', 'kx'])).toEqual({
      kind: 'site',
      slug: 'kx',
    });
  });
  it('scaffolds from an address + radius', () => {
    const plan = parseCliArgs([
      '--address',
      '1 Broad St, Chattanooga TN',
      '--radius',
      '800',
    ]);
    expect(plan).toMatchObject({
      kind: 'scaffold',
      source: 'address',
      address: '1 Broad St, Chattanooga TN',
      widthM: 1600,
      heightM: 1600,
      force: false,
      dryRun: false,
    });
  });
  it('scaffolds from a center + box, slug required', () => {
    const plan = parseCliArgs([
      '--center',
      '35.0563,-85.3111',
      '--box',
      '1600x900',
      '--slug',
      'broad-st',
    ]);
    expect(plan).toMatchObject({
      kind: 'scaffold',
      source: 'center',
      centerLat: 35.0563,
      centerLon: -85.3111,
      widthM: 1600,
      heightM: 900,
      slug: 'broad-st',
    });
    expect(() =>
      parseCliArgs(['--center', '35.0563,-85.3111', '--box', '1600x900'])
    ).toThrow(/--slug/);
  });
  it('passes through --name, --force and --dry-run', () => {
    const plan = parseCliArgs([
      '--address',
      'x',
      '--radius',
      '500',
      '--name',
      'My Site',
      '--force',
      '--dry-run',
    ]);
    expect(plan).toMatchObject({ name: 'My Site', force: true, dryRun: true });
  });

  describe('mutual exclusion + validation', () => {
    it('rejects --address with --center', () => {
      expect(() =>
        parseCliArgs(['--address', 'x', '--center', '1,2', '--radius', '5'])
      ).toThrow(/mutually exclusive/);
    });
    it('rejects --site with --address', () => {
      expect(() =>
        parseCliArgs(['--site', 'chatt', '--address', 'x', '--radius', '5'])
      ).toThrow(/--site cannot/);
    });
    it('rejects scaffold flags without --address/--center', () => {
      expect(() => parseCliArgs(['--radius', '800'])).toThrow(/only applies/);
      expect(() => parseCliArgs(['--slug', 'x'])).toThrow(/only applies/);
    });
    it('rejects --dry-run/--force in site mode (a "preview" must never live-bake)', () => {
      expect(() => parseCliArgs(['--dry-run'])).toThrow(/only applies/);
      expect(() => parseCliArgs(['--site', 'chatt', '--dry-run'])).toThrow(
        /only applies/
      );
      expect(() => parseCliArgs(['--force'])).toThrow(/only applies/);
    });
    it('requires exactly one of --radius | --box', () => {
      expect(() => parseCliArgs(['--address', 'x'])).toThrow(/exactly one/);
      expect(() =>
        parseCliArgs(['--address', 'x', '--radius', '5', '--box', '1x1'])
      ).toThrow(/exactly one/);
    });
    it('rejects malformed values', () => {
      expect(() => parseCliArgs(['--address', 'x', '--radius=-5'])).toThrow(
        /bad --radius/
      );
      expect(() => parseCliArgs(['--address', 'x', '--radius', '0'])).toThrow(
        /bad --radius/
      );
      expect(() => parseCliArgs(['--address', 'x', '--box', '1600'])).toThrow(
        /bad --box/
      );
      expect(() =>
        parseCliArgs(['--center', 'north,west', '--box', '1x1', '--slug', 's'])
      ).toThrow(/bad --center/);
      expect(() => parseCliArgs(['--bogus'])).toThrow();
    });
  });
});
