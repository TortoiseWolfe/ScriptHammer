import { describe, it, expect } from 'vitest';
import {
  generateBlockId,
  countLines,
  extractLanguage,
  formatLineNumber,
  stripLineNumbers,
  getLanguageDisplayName,
  detectLanguage,
} from './codeblock-utils';

/**
 * `codeblock-utils.ts` shipped untested (#883). `detectLanguage` is the only
 * export with a live consumer — `CodeBlock.tsx` calls it as the last fallback in
 * `language || extractLanguage(className) || detectLanguage(codeText)` — and it
 * is a 13-branch ordered cascade where the ORDER is the whole behaviour. So the
 * tests below are written per branch, and several deliberately pin an ordering
 * outcome that is arguably wrong, because "arguably wrong" is exactly the thing
 * a refactor must not change by accident.
 *
 * Behaviour that surprised me while writing these, all verified against the
 * module and TESTED AS-IS rather than fixed:
 *
 *   - `import { a } from 'b';` is detected as **css**, not typescript. The CSS
 *     probe `/^[.#]?\w+\s*{/` matches the destructuring brace ("import" + " " +
 *     "{"), and it runs before the JS branch.
 *   - `import foo from 'bar';` is detected as **python**, because the Python
 *     probe `/import\s+\w+/` also runs before the JS branch.
 *   - A shebang for an unrecognised interpreter (`ruby`) falls back to bash, and
 *     `#!/usr/bin/env node` is the ONLY input that ever returns `javascript` —
 *     every other JS-ish input returns `typescript`.
 *   - `docker compose` anywhere in the content wins outright, so a package.json
 *     snippet whose script runs `docker compose up` is reported as bash.
 *     `docker-compose` (hyphen, the v1 spelling) does not match at all.
 *   - `<DIV>hi</DIV>` is typescript, not html: `/<[A-Z]\w+/` reads an uppercase
 *     tag as a JSX component.
 *   - `countLines('a\n')` is 2 — the empty string after a trailing newline
 *     counts as a line.
 *   - `stripLineNumbers` eats a leading bitwise-or: `'5 | 3'` becomes `'3'`.
 *   - `getLanguageDisplayName` lowercases only for the LOOKUP; an unknown
 *     language is echoed back with its original casing and whitespace.
 */

describe('generateBlockId', () => {
  // Pinned literals: the id ends up in the DOM, so changing the hash silently
  // changes every anchor/key. These were computed from the shipped
  // implementation and are here to make a hash change loud.
  it.each([
    ['', 'code-block-0'],
    ['a', 'code-block-2p'],
    ['A', 'code-block-1t'],
    ['hello', 'code-block-1n1e4y'],
    ['const x = 1;', 'code-block-soopvy'],
  ])('hashes %j to %s', (content, expected) => {
    expect(generateBlockId(content)).toBe(expected);
  });

  it('is deterministic across calls', () => {
    const content = 'function add(a, b) {\n  return a + b;\n}';
    expect(generateBlockId(content)).toBe(generateBlockId(content));
  });

  it('is whitespace-sensitive, so a trailing newline is a different block', () => {
    expect(generateBlockId('hello')).toBe('code-block-1n1e4y');
    expect(generateBlockId('hello\n')).toBe('code-block-k6wvpk');
  });

  it('distinguishes content that differs only by character order or case', () => {
    const ids = [
      'ab',
      'ba',
      'AB',
      'Ab',
      'a b',
      'const x = 1;',
      'const y = 1;',
    ].map(generateBlockId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('handles non-ASCII content without throwing', () => {
    // charCodeAt() walks UTF-16 code units, so an emoji contributes two.
    expect(generateBlockId('👋')).toBe('code-block-11zn2');
    expect(generateBlockId('café')).not.toBe(generateBlockId('cafe'));
  });

  it('stays inside 32 bits no matter how long the content is', () => {
    // `hash = hash & hash` is the int32 clamp. Without it a long input drifts
    // past 2^31 and the base-36 suffix grows unboundedly.
    for (const content of ['x'.repeat(10000), 'const a = 1;\n'.repeat(500)]) {
      const suffix = generateBlockId(content).replace('code-block-', '');
      expect(parseInt(suffix, 36)).toBeLessThanOrEqual(2 ** 31);
    }
  });

  it('always produces a DOM-safe id', () => {
    for (const content of ['', '  ', '<div>&</div>', '#!/bin/sh', '👋 hi']) {
      expect(generateBlockId(content)).toMatch(/^code-block-[0-9a-z]+$/);
    }
  });
});

describe('countLines', () => {
  it.each([
    ['', 1],
    ['a', 1],
    ['a\nb', 2],
    ['a\nb\nc', 3],
    // A trailing newline yields a final EMPTY line, which is counted.
    ['a\n', 2],
    ['\n', 2],
    ['\n\n', 3],
    // \r stays attached to the previous line; only \n splits.
    ['a\r\nb', 2],
    ['a\rb', 1],
  ])('counts %j as %i line(s)', (text, expected) => {
    expect(countLines(text)).toBe(expected);
  });

  it('never returns zero, even for the empty string', () => {
    expect(countLines('')).toBeGreaterThan(0);
  });
});

describe('extractLanguage', () => {
  it.each([
    ['language-ts', 'ts'],
    ['language-python', 'python'],
    // The class rarely sits alone on the element.
    ['hljs language-python line-numbers', 'python'],
    ['prose language-json', 'json'],
    // \w matches digits and underscore.
    ['language-123', '123'],
    ['language-c_sharp', 'c_sharp'],
    // Case of the captured token is preserved verbatim.
    ['language-Ts', 'Ts'],
  ])('reads %j as %s', (className, expected) => {
    expect(extractLanguage(className)).toBe(expected);
  });

  it.each([
    [''],
    ['   '],
    ['lang-ts'],
    ['language-'],
    ['language- ts'],
    // The match is case-SENSITIVE on the prefix.
    ['Language-ts'],
    ['LANGUAGE-TS'],
    ['language_ts'],
    ['highlight code'],
  ])('returns null for %j', (className) => {
    expect(extractLanguage(className)).toBeNull();
  });

  it('stops at the first non-word character, truncating hyphenated names', () => {
    // Documented surprise: `objective-c` and `c++` lose their tails, so those
    // languages can never round-trip through this helper.
    expect(extractLanguage('language-objective-c')).toBe('objective');
    expect(extractLanguage('language-c++')).toBe('c');
  });

  it('returns the first match when several language classes are present', () => {
    expect(extractLanguage('language-ts language-js')).toBe('ts');
  });
});

describe('formatLineNumber', () => {
  it.each([
    [1, 100, '  1'],
    [42, 100, ' 42'],
    [100, 100, '100'],
    [1, 1000, '   1'],
    [5, 9, '5'],
    [9, 9, '9'],
    // Single-digit total => single-column gutter.
    [1, 1, '1'],
    [0, 0, '0'],
  ])('formats %i of %i as %j', (num, totalLines, expected) => {
    expect(formatLineNumber(num, totalLines)).toBe(expected);
  });

  it('never truncates a number that is wider than the gutter', () => {
    // padStart only pads. A number larger than totalLines still prints in full.
    expect(formatLineNumber(1000, 10)).toBe('1000');
  });

  it('pads with spaces, not zeros', () => {
    expect(formatLineNumber(7, 100)).toBe('  7');
    expect(formatLineNumber(7, 100)).not.toBe('007');
  });

  it('aligns every line of a file to the same width', () => {
    const total = 120;
    const widths = new Set(
      Array.from(
        { length: total },
        (_, i) => formatLineNumber(i + 1, total).length
      )
    );
    expect(widths).toEqual(new Set([3]));
  });

  it('counts a minus sign as a column on both arguments', () => {
    // Surprising but consistent: `.toString().length` includes the sign, so a
    // negative total widens the gutter by one.
    expect(formatLineNumber(-1, 100)).toBe(' -1');
    expect(formatLineNumber(1, -5)).toBe(' 1');
  });

  it('passes a fractional number through unpadded when it is already wide', () => {
    expect(formatLineNumber(1.5, 100)).toBe('1.5');
  });
});

describe('stripLineNumbers', () => {
  it('removes a "N | " gutter from every line', () => {
    expect(stripLineNumbers('1 | const a = 1;\n2 | const b = 2;')).toBe(
      'const a = 1;\nconst b = 2;'
    );
  });

  it('tolerates the padding a wide gutter produces', () => {
    expect(stripLineNumbers('  8 | eight\n  9 | nine\n 10 | ten')).toBe(
      'eight\nnine\nten'
    );
  });

  it('accepts a gutter with no spaces around the pipe', () => {
    expect(stripLineNumbers('1|a\n2|b')).toBe('a\nb');
  });

  it.each([
    ['no numbers here'],
    ['a || b'],
    ['   |  x'],
    ['1 . x'],
    ['const total = 1;'],
    [''],
  ])('leaves %j untouched', (line) => {
    expect(stripLineNumbers(line)).toBe(line);
  });

  it.each([
    ['x = 1 | 2', 'a bitwise-or that is not at the start of the line'],
    ['echo 12 | wc -l', 'a shell pipe with a numeric argument'],
    ['  return 8 | mask;', 'an indented expression'],
  ])('leaves %j alone because the gutter must start the line (%s)', (line) => {
    // The `^` anchor is load-bearing: without it every "<digits> |" anywhere in
    // a line would be eaten, silently rewriting the code a reader copies.
    expect(stripLineNumbers(line)).toBe(line);
  });

  it('strips only the first gutter on a line', () => {
    expect(stripLineNumbers('1 | 2 | 3')).toBe('2 | 3');
  });

  it('empties a line that is nothing but a gutter', () => {
    expect(stripLineNumbers('42 |')).toBe('');
  });

  it('preserves the line count, including blank lines', () => {
    const input = '1 | a\n2 |\n3 | c\n\nplain';
    const output = stripLineNumbers(input);
    expect(output).toBe('a\n\nc\n\nplain');
    expect(countLines(output)).toBe(countLines(input));
  });

  it('mangles a leading bitwise-or, which is a real false positive', () => {
    // Tested as-is: `5 | 3` in a Python or JS snippet reads as line 5 of a
    // gutter and loses its left operand.
    expect(stripLineNumbers('5 | 3')).toBe('3');
  });
});

describe('getLanguageDisplayName', () => {
  it.each([
    ['js', 'JavaScript'],
    ['javascript', 'JavaScript'],
    ['jsx', 'JavaScript'],
    ['ts', 'TypeScript'],
    ['typescript', 'TypeScript'],
    ['tsx', 'TypeScript'],
    ['py', 'Python'],
    ['python', 'Python'],
    ['css', 'CSS'],
    ['scss', 'SCSS'],
    ['sass', 'Sass'],
    ['html', 'HTML'],
    ['xml', 'XML'],
    ['json', 'JSON'],
    ['bash', 'Bash'],
    ['sh', 'Shell'],
    ['shell', 'Shell'],
    ['plaintext', 'Plain Text'],
  ])('maps %s to %s', (language, expected) => {
    expect(getLanguageDisplayName(language)).toBe(expected);
  });

  it.each([
    ['JS', 'JavaScript'],
    ['Js', 'JavaScript'],
    ['TSX', 'TypeScript'],
    ['SHELL', 'Shell'],
    ['PlainText', 'Plain Text'],
  ])('looks %s up case-insensitively', (language, expected) => {
    expect(getLanguageDisplayName(language)).toBe(expected);
  });

  it('echoes an unknown language back with its original casing', () => {
    // The fallback is `|| language`, NOT the lowercased key — so casing that
    // the user supplied survives.
    expect(getLanguageDisplayName('rust')).toBe('rust');
    expect(getLanguageDisplayName('Rust')).toBe('Rust');
    expect(getLanguageDisplayName('C#')).toBe('C#');
  });

  it('does not trim, so surrounding whitespace defeats the lookup', () => {
    expect(getLanguageDisplayName('  js  ')).toBe('  js  ');
  });

  it('returns the empty string for empty input', () => {
    // `languageMap['']` is undefined, so `|| language` hands back ''.
    expect(getLanguageDisplayName('')).toBe('');
  });

  it('distinguishes bash from the generic shells', () => {
    expect(getLanguageDisplayName('bash')).toBe('Bash');
    expect(getLanguageDisplayName('sh')).toBe('Shell');
  });
});

describe('detectLanguage', () => {
  describe('shebangs (highest precedence)', () => {
    it.each([
      ['#!/usr/bin/env python\nprint(1)', 'python'],
      ['#!/usr/bin/python3\nprint(1)', 'python'],
      ['#!/usr/bin/env node\nconsole.log(1)', 'javascript'],
      ['#!/bin/bash\necho hi', 'bash'],
      ['#!/bin/sh\necho hi', 'bash'],
      // Unrecognised interpreters default to bash rather than to the
      // module-wide typescript default.
      ['#!/usr/bin/env ruby\nputs 1', 'bash'],
      ['#!/usr/bin/perl\nprint 1;', 'bash'],
    ])('reads %j as %s', (content, expected) => {
      expect(detectLanguage(content)).toBe(expected);
    });

    it('is the only path that ever reports plain javascript', () => {
      expect(detectLanguage('#!/usr/bin/env node\nconsole.log(1)')).toBe(
        'javascript'
      );
      // Every other JS-shaped input is reported as typescript.
      expect(detectLanguage('console.log(1)')).toBe('typescript');
    });

    it('scans the first three lines but not the fourth', () => {
      expect(detectLanguage('// a\n// b\n#!/usr/bin/env python')).toBe(
        'python'
      );
      expect(detectLanguage('// a\n// b\n// c\n#!/usr/bin/env python')).toBe(
        'typescript'
      );
    });

    it('still finds a shebang behind leading blank lines, because it trims first', () => {
      expect(detectLanguage('\n\n#!/usr/bin/env python\nprint(1)')).toBe(
        'python'
      );
    });
  });

  describe('shell markers', () => {
    it.each([
      ['# .husky/pre-commit\npnpm lint-staged', 'husky path comment'],
      ['# .github/workflows/ci.yml\nname: CI', 'workflow path comment'],
      ['docker compose up -d', 'docker compose invocation'],
      ['# Format code\nprettier --write .', 'script section comment'],
      ['# Install deps\nsomething', 'Install section comment'],
      ['if [ -f x ]; then\n  echo hi\nfi', 'shell if'],
      ['x=1\nif true; then', 'trailing then'],
      ['for i in 1 2; do\n  echo $i\ndone', 'trailing done'],
      ['echo hi\nfi', 'trailing fi'],
    ])('reads %j as bash (%s)', (content) => {
      expect(detectLanguage(content)).toBe('bash');
    });

    it.each([
      'npm install',
      'pnpm run build',
      'yarn add react',
      'docker ps',
      'git status',
      'echo hello',
      'cd /app && ls',
      'mkdir -p out',
    ])('reads the command %j as bash', (content) => {
      expect(detectLanguage(content)).toBe('bash');
    });

    it('matches a command on any line, not just the first', () => {
      expect(detectLanguage('Some prose about setup.\necho hello')).toBe(
        'bash'
      );
    });

    it('lets "docker compose" outrank every later branch, even inside JSON', () => {
      // Documented surprise: this package.json fragment parses as JSON, but the
      // shell probe runs first and scans the raw content.
      const packageJson = '{\n  "scripts": { "dev": "docker compose up" }\n}';
      expect(detectLanguage(packageJson)).toBe('bash');
    });

    it('does not recognise the hyphenated v1 spelling', () => {
      expect(detectLanguage('docker-compose up')).toBe('typescript');
    });
  });

  describe('JSX and TypeScript', () => {
    it.each([
      ['<Button>Click</Button>', 'capitalised JSX element'],
      ['import React from "react";\nconst a = 1;', 'React import'],
      ['export default function Page() {}', 'default-exported function'],
      ['interface Props { id: number }', 'interface declaration'],
      ['type Id = string', 'type alias'],
      ['function f(a: string) {}', 'parameter annotation'],
      ['let a: number = 1', 'variable annotation'],
    ])('reads %j as typescript (%s)', (content) => {
      expect(detectLanguage(content)).toBe('typescript');
    });

    it('mistakes an uppercase HTML tag for a JSX component', () => {
      expect(detectLanguage('<DIV>hi</DIV>')).toBe('typescript');
      expect(detectLanguage('<div>hi</div>')).toBe('html');
    });
  });

  describe('css', () => {
    it.each([
      ['.btn {\n  color: red;\n}', 'class selector'],
      ['#main { display: flex; }', 'id selector'],
      ['body {\n  margin: 0;\n}', 'element selector'],
      ['a { margin: 10px }', 'px value'],
      ['@media print { body { color: black } }', 'media query'],
    ])('reads %j as css (%s)', (content) => {
      expect(detectLanguage(content)).toBe('css');
    });

    it('claims a destructuring import before the JS branch can see it', () => {
      // Documented surprise, tested as-is: "import" + space + "{" satisfies
      // /^[.#]?\w+\s*{/, so the most common TS import line renders as CSS.
      expect(detectLanguage('import { a } from "b";')).toBe('css');
    });
  });

  describe('html', () => {
    it.each([
      ['<!DOCTYPE html>\n<html><body></body></html>', 'doctype'],
      ['<!doctype html>\n<p>hi</p>', 'lowercase doctype'],
      ['<html lang="en"></html>', 'html element'],
      ['<div>hello</div>', 'wrapped element'],
      ['<section>\n  <p>hi</p>\n</section>', 'multi-line element'],
    ])('reads %j as html (%s)', (content) => {
      expect(detectLanguage(content)).toBe('html');
    });

    it('needs a closing tag at the very end, so a void element is not html', () => {
      expect(detectLanguage('<br/>')).toBe('typescript');
    });
  });

  describe('json', () => {
    it.each([
      ['{"a": 1, "b": [2, 3]}', 'object'],
      ['[1, 2, 3]', 'array'],
      ['[\n  {"a": 1}\n]', 'array of objects'],
      ['{"a":1}\n', 'trailing newline'],
      ['{"kind": "string"}', 'a value that looks like a TS annotation'],
    ])('reads %j as json (%s)', (content) => {
      expect(detectLanguage(content)).toBe('json');
    });

    it('falls through when the braces do not actually parse', () => {
      // JSON5-ish content is NOT json; it drops to the module default.
      expect(detectLanguage('{a: 1,}')).toBe('typescript');
    });
  });

  describe('python', () => {
    it.each([
      ['def add(a, b):\n    return a + b', 'def'],
      ['if __name__ == "__main__":\n    main()', '__main__ guard'],
      ['import os\nprint(os.getcwd())', 'import'],
    ])('reads %j as python (%s)', (content) => {
      expect(detectLanguage(content)).toBe('python');
    });

    it('claims a default JS import before the JS branch can see it', () => {
      // Documented surprise, tested as-is: /import\s+\w+/ is checked in the
      // python branch, which runs before the JavaScript fallback.
      expect(detectLanguage('import foo from "bar";')).toBe('python');
    });
  });

  describe('sql', () => {
    it.each([
      'SELECT * FROM users WHERE id = 1',
      'INSERT INTO users (id) VALUES (1)',
      'UPDATE users SET name = 1',
      'DELETE FROM users',
      'CREATE TABLE users (id)',
      'DROP TABLE users',
      'ALTER TABLE users ADD col',
      'select 1',
    ])('reads %j as sql', (content) => {
      expect(detectLanguage(content)).toBe('sql');
    });
  });

  describe('fallbacks', () => {
    it.each([
      ['const x = 1;', 'const'],
      ['let total = 0;\ntotal += 1;', 'let'],
      ['var a = 2;', 'var'],
      ['function add(a, b) {\n  return a + b;\n}', 'function'],
      ['foo();\nconsole.log(x);', 'console.log'],
    ])('reads %j as typescript (%s)', (content) => {
      expect(detectLanguage(content)).toBe('typescript');
    });

    it('treats an unmatched comment block as bash', () => {
      expect(detectLanguage('# just a note\nsomething else')).toBe('bash');
      expect(detectLanguage('  # indented note\nsomething else')).toBe('bash');
    });

    it.each([
      ['', 'empty string'],
      ['   \n  ', 'whitespace only'],
      ['hello world', 'prose'],
      ['The quick brown fox.', 'a sentence'],
    ])('defaults %j to typescript (%s)', (content) => {
      expect(detectLanguage(content)).toBe('typescript');
    });

    it('never returns an empty language, because CodeBlock uses it directly', () => {
      // CodeBlock.tsx: `language || extractLanguage(className) || detectLanguage(...)`
      // — the result is passed straight to the highlighter, so a blank would
      // silently disable highlighting.
      for (const content of ['', ' ', '\n', 'x', '???']) {
        expect(detectLanguage(content)).toBeTruthy();
      }
    });
  });
});
