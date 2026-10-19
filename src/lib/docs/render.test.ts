import { describe, it, expect } from 'vitest';
import { rewriteRepoLinks } from './render';

describe('rewriteRepoLinks (#1373)', () => {
  it('points a link to another registered document at its docs page', () => {
    const out = rewriteRepoLinks(
      '<a href="docs/AUTH-SETUP.md#oauth">auth</a>',
      'README.md'
    );
    expect(out).toContain('href="/docs/auth-and-sessions/#oauth"');
  });

  it('resolves relative to the source file, not the docs page', () => {
    const out = rewriteRepoLinks(
      '<a href="../AUTH-SETUP.md">auth</a>',
      'docs/architecture/README.md'
    );
    expect(out).toContain('href="/docs/auth-and-sessions/"');
  });

  it('sends unregistered repo files to GitHub', () => {
    const out = rewriteRepoLinks(
      '<a href="CONTRIBUTING.md">c</a>',
      'README.md'
    );
    expect(out).toMatch(
      /href="https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/main\/CONTRIBUTING\.md"/
    );
  });

  it('serves images from the raw file so they still render', () => {
    const out = rewriteRepoLinks(
      '<img src="architecture-detailed.png">',
      'docs/architecture/README.md'
    );
    expect(out).toMatch(
      /src="https:\/\/github\.com\/[^/]+\/[^/]+\/raw\/main\/docs\/architecture\/architecture-detailed\.png"/
    );
  });

  it('leaves anchors, absolute paths, schemes and queries alone', () => {
    const html =
      '<a href="#top">a</a><a href="/blog/">b</a><a href="https://x.dev/">c</a><a href="mailto:a@b.c">d</a><a href="?q=1">e</a>';
    expect(rewriteRepoLinks(html, 'README.md')).toBe(html);
  });

  it('leaves a link that escapes the repo root untouched', () => {
    const html = '<a href="../../outside.md">x</a>';
    expect(rewriteRepoLinks(html, 'README.md')).toBe(html);
  });
});
