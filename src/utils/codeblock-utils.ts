/**
 * Utility functions for code block handling
 */

/**
 * Generate a unique ID for a code block based on its content
 */
export function generateBlockId(content: string): string {
  // Simple hash function for generating IDs
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `code-block-${Math.abs(hash).toString(36)}`;
}

/**
 * Count the number of lines in a string
 */
export function countLines(text: string): number {
  return text.split('\n').length;
}

/**
 * Extract language from className
 */
export function extractLanguage(className: string): string | null {
  const match = className.match(/language-(\w+)/);
  return match ? match[1] : null;
}

/**
 * Format line numbers for display
 */
export function formatLineNumber(num: number, totalLines: number): string {
  const digits = totalLines.toString().length;
  return num.toString().padStart(digits, ' ');
}

/**
 * Strip line numbers from copied content
 */
export function stripLineNumbers(content: string): string {
  // Remove line numbers that appear at the start of lines
  return content
    .split('\n')
    .map((line) => line.replace(/^\s*\d+\s*\|\s*/, ''))
    .join('\n');
}

/**
 * Get supported language display name
 */
export function getLanguageDisplayName(language: string): string {
  const languageMap: Record<string, string> = {
    js: 'JavaScript',
    javascript: 'JavaScript',
    jsx: 'JavaScript',
    ts: 'TypeScript',
    typescript: 'TypeScript',
    tsx: 'TypeScript',
    py: 'Python',
    python: 'Python',
    css: 'CSS',
    scss: 'SCSS',
    sass: 'Sass',
    html: 'HTML',
    xml: 'XML',
    json: 'JSON',
    bash: 'Bash',
    sh: 'Shell',
    shell: 'Shell',
    plaintext: 'Plain Text',
  };

  return languageMap[language.toLowerCase()] || language;
}

/**
 * Detect language from code content using heuristics
 */
export function detectLanguage(content: string): string {
  // Clean content for analysis
  const trimmed = content.trim();
  const lines = trimmed.split('\n');
  const firstLine = lines[0];

  // Check for shebang in first few lines (sometimes there's a comment first)
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    if (lines[i].startsWith('#!')) {
      if (lines[i].includes('python')) return 'python';
      if (lines[i].includes('node')) return 'javascript';
      if (lines[i].includes('bash') || lines[i].includes('/sh')) return 'bash';
      return 'bash'; // Default shebangs to bash
    }
  }

  // Check for shell/bash file paths and patterns
  if (
    /^#\s*\.husky\//.test(trimmed) || // .husky/ paths in comments
    /^#\s*\.github\//.test(trimmed) || // GitHub workflows
    /docker\s+compose/.test(content) || // Docker compose commands
    /^\s*#\s*(Format|Lint|Check|Run|Test|Build|Install)/.test(content) || // Common script comments
    /if\s+\[\s+/.test(content) || // Shell if statements
    /\s+fi\s*$/.test(content) || // Shell fi endings
    /\s+then\s*$/.test(content) || // Shell then
    /\s+done\s*$/.test(content) // Shell done
  ) {
    return 'bash';
  }

  // Check for common shell commands at start of lines
  if (
    /^(npm|pnpm|yarn|docker|git|echo|cd|ls|mkdir|rm|cp|mv|cat|grep|sed|awk)\s/m.test(
      content
    )
  ) {
    return 'bash';
  }

  // Check for React/JSX patterns
  if (
    /<[A-Z]\w+/.test(content) ||
    /import\s+React/.test(content) ||
    /export\s+default\s+function/.test(content)
  ) {
    return 'typescript'; // Default to TypeScript for JSX content
  }

  // Check for TypeScript specific syntax
  if (
    /interface\s+\w+/.test(content) ||
    /type\s+\w+\s*=/.test(content) ||
    /:\s*(string|number|boolean|any|void)/.test(content)
  ) {
    return 'typescript';
  }

  // ES MODULE SYNTAX, DECIDED BEFORE CSS AND PYTHON (#1044).
  //
  // Both of the probes below used to claim an ES import first, and this cascade is
  // ordered, so whichever ran first won:
  //   `import { a } from 'b';`  -> CSS, because /^[.#]?\w+\s*{/ reads "import" as a
  //                                selector and the DESTRUCTURING BRACE as a rule opening
  //   `import foo from 'bar';`  -> Python, because /import\s+\w+/ is satisfied by any
  //                                `import` followed by a word
  // Neither probe is wrong about its own language; they were simply asked first. The fix
  // is to answer the unambiguous question -- does this have a module specifier? -- before
  // either gets a turn, rather than to make their patterns cleverer.
  if (
    /^\s*import\s[\s\S]*?\bfrom\s*['"]/m.test(content) ||
    /^\s*import\s*\{[^}]*\}\s*from\b/m.test(content) ||
    /^\s*export\s+(default|const|let|var|function|class|interface|type|\{)/m.test(
      content
    )
  ) {
    return 'typescript';
  }

  // Check for CSS patterns
  if (
    /^[.#]?\w+\s*{/.test(trimmed) ||
    /:\s*\d+px/.test(content) ||
    /@media/.test(content)
  ) {
    return 'css';
  }

  // Check for HTML patterns
  if (
    /^<!DOCTYPE/i.test(trimmed) ||
    /^<html/i.test(trimmed) ||
    (/^<\w+/.test(trimmed) && /<\/\w+>$/.test(trimmed))
  ) {
    return 'html';
  }

  // Check for JSON patterns
  if (/^[{\[]/.test(trimmed) && /[}\]]$/.test(trimmed)) {
    try {
      JSON.parse(content);
      return 'json';
    } catch {
      // Not valid JSON, continue checking
    }
  }

  // Check for Python patterns
  //
  // The import test is shaped like PYTHON's two forms rather than the word "import"
  // (#1044): `import os` on its own line, or `from x import y`. The old
  // /import\s+\w+/ matched `import foo from 'bar'` too, which is how a TypeScript
  // default import came back as Python. The ES-module branch above now answers first
  // regardless, so this is defence in depth -- but a probe that claims another
  // language's syntax is worth narrowing even when something else catches it.
  if (
    /def\s+\w+\s*\(/.test(content) ||
    /^\s*import\s+[\w.]+\s*$/m.test(content) ||
    /^\s*from\s+[\w.]+\s+import\s/m.test(content) ||
    /if\s+__name__\s*==/.test(content)
  ) {
    return 'python';
  }

  // Check for SQL patterns
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s+/i.test(trimmed)) {
    return 'sql';
  }

  // Check for JavaScript patterns (as fallback before TypeScript)
  if (
    /^(const|let|var|function)\s/.test(trimmed) ||
    /console\.log/.test(content) ||
    /^import\s/.test(trimmed)
  ) {
    return 'typescript'; // Default to TypeScript for better highlighting
  }

  // Default to bash for unknown scripts instead of TypeScript
  // This is better for shell scripts that don't match other patterns
  if (firstLine.startsWith('#')) {
    return 'bash';
  }

  // Default to TypeScript for this project since it's a TypeScript/React blog
  return 'typescript';
}
