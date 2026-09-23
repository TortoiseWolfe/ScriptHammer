import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { jsonForScript } from './json-script';

describe('jsonForScript (#1241)', () => {
  it('cannot close the script element it is embedded in', () => {
    const out = jsonForScript({ title: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('<');
  });

  it('round-trips to the same value, so the escape is invisible to the consumer', () => {
    const value = { a: '</script>', b: ['<', 1, null], c: { d: '<x>' } };
    expect(JSON.parse(jsonForScript(value))).toEqual(value);
  });

  it('CONTROL: plain JSON.stringify would have shipped the closing tag', () => {
    // The assertion above passes trivially against a helper that returns ''. This
    // pins that the input really is dangerous, so the first test is not vacuous.
    expect(JSON.stringify({ t: '</script>' })).toContain('</script>');
  });

  it('every inline-script sink uses it rather than JSON.stringify directly', () => {
    // Syntax, not prose: a comment mentioning JSON.stringify does not match this.
    const sinks = [
      'src/app/blog/[slug]/page.tsx',
      'src/utils/metadata.tsx',
      'src/components/AccessibilityScript/AccessibilityScript.tsx',
    ];
    for (const file of sinks) {
      const src = readFileSync(file, 'utf8');
      expect(src, file).not.toMatch(/__html:\s*JSON\.stringify\(/);
      expect(src, file).not.toMatch(/\$\{JSON\.stringify\(/);
      expect(src, file).toMatch(/jsonForScript/);
    }
  });
});
