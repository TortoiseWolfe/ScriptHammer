import { randomUUID } from 'node:crypto';

import Prism from 'prismjs';
import { rehype } from 'rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, {
  defaultSchema,
  type Options as SanitizeSchema,
} from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import type { MarkdownProcessorOptions } from '@/types/metadata';

// Prism language support used by the published blog posts.
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-yaml';

const HEADING_MARKER = 'dataBlogHeadingIndex';

/**
 * The classes Prism itself can add to token spans. Keeping this list explicit
 * lets the sanitizer retain syntax colours without granting authored HTML an
 * arbitrary Tailwind class surface.
 */
const PRISM_TOKEN_CLASSES = [
  'token',
  'attr-name',
  'attr-value',
  'atrule',
  'boolean',
  'bold',
  'builtin',
  'cdata',
  'char',
  'class-name',
  'comment',
  'constant',
  'deleted',
  'doctype',
  'doc-comment',
  'entity',
  'function',
  'function-variable',
  'important',
  'inserted',
  'interpolation',
  'interpolation-punctuation',
  'italic',
  'keyword',
  'literal-property',
  'namespace',
  'number',
  'operator',
  'parameter',
  'prolog',
  'property',
  'punctuation',
  'regex',
  'script',
  'selector',
  'string',
  'symbol',
  'tag',
  'template-punctuation',
  'template-string',
  'url',
  'variable',
] as const;

const headingAttributes = (tag: string) => [
  ...(defaultSchema.attributes?.[tag] || []),
  HEADING_MARKER,
];

/**
 * GitHub-style HTML allowlist plus the two renderer-owned facts that must
 * survive until trusted post-sanitize transforms run: heading markers and
 * Prism token classes. Executable tags, event handlers, inline styles,
 * `srcdoc`, unsafe protocols, and raw DOM-clobbering ids remain disallowed.
 */
const blogSanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [['className', /^language-[\w-]+$/]],
    span: [
      ...(defaultSchema.attributes?.span || []),
      ['className', ...PRISM_TOKEN_CLASSES, /^language-[\w-]+$/],
    ],
    h1: headingAttributes('h1'),
    h2: headingAttributes('h2'),
    h3: headingAttributes('h3'),
    h4: headingAttributes('h4'),
    h5: headingAttributes('h5'),
    h6: headingAttributes('h6'),
  },
};

interface TreeNode {
  type: string;
  value?: string;
  children?: TreeNode[];
}

interface ElementNode extends TreeNode {
  type: 'element';
  tagName: string;
  properties: Record<string, unknown>;
  children: TreeNode[];
}

interface MarkdownNode extends TreeNode {
  depth?: number;
  lang?: string | null;
  url?: string;
  data?: {
    hProperties?: Record<string, unknown>;
  };
  position?: {
    start: { offset?: number };
    end: { offset?: number };
  };
}

interface RenderHeading {
  id: string;
  level: number;
  marker: string;
}

interface PrepareOptions {
  content: string;
  demote: number;
  headings: RenderHeading[];
  markerNonce: string;
}

interface FinalizeOptions {
  headings: RenderHeading[];
  externalLinksTarget: '_blank' | '_self';
}

function isElement(node: TreeNode): node is ElementNode {
  return (
    node.type === 'element' &&
    typeof (node as Partial<ElementNode>).tagName === 'string' &&
    Array.isArray(node.children)
  );
}

/** Exact published blog/TOC slug semantics. Do not replace with rehype-slug. */
export function generateBlogHeadingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Remove fenced code while retaining the renderer's heading boundary. */
export function stripBlogFences(content: string): string {
  return content.replace(/```[\s\S]*?```/g, '');
}

/**
 * The page template supplies the document h1. Preserve the existing rule:
 * demote all Markdown headings only when a real `# ` heading exists outside a
 * fence. A shell comment inside a code sample must never trigger the shift.
 */
export function blogHeadingDemotion(
  content: string,
  enabled: boolean | undefined
): number {
  return enabled && /^#\s+\S/m.test(stripBlogFences(content)) ? 1 : 0;
}

function markdownText(node: TreeNode): string {
  if (typeof node.value === 'string') return node.value;
  return (node.children || []).map(markdownText).join('');
}

function sourceHeadingText(content: string, node: MarkdownNode): string {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;

  if (typeof start === 'number' && typeof end === 'number') {
    const source = content.slice(start, end).split(/\r?\n/, 1)[0];
    const atx = /^#{1,6}\s+(.+?)\s*$/.exec(source);
    if (atx) return atx[1].trim();
  }

  return markdownText(node).trim();
}

function neutralizeDangerousMarkdownUrl(url: string | undefined): string {
  if (!url) return '';
  return /^\s*(?:javascript|data|vbscript)\s*:/i.test(url) ? '#' : url;
}

/** Prepare only Markdown-owned nodes; authored raw HTML is handled later. */
function prepareBlogMarkdown(options: PrepareOptions) {
  return (tree: unknown) => {
    const visitable = tree as Parameters<typeof visit>[0];

    visit(visitable, 'heading', (candidate) => {
      const node = candidate as unknown as MarkdownNode;
      const originalDepth = node.depth || 1;
      const level = Math.min(6, originalDepth + options.demote);
      const index = options.headings.length;

      const marker = `${options.markerNonce}:${index}`;
      options.headings.push({
        id: generateBlogHeadingId(sourceHeadingText(options.content, node)),
        level,
        marker,
      });

      node.depth = level;
      node.data ||= {};
      node.data.hProperties = {
        ...(node.data.hProperties || {}),
        [HEADING_MARKER]: marker,
      };
    });

    // Keep the legacy `href="#"`/`src="#"` fallback for Markdown URLs while
    // the later schema also catches entity/control-obfuscated variants.
    for (const type of ['link', 'image'] as const) {
      visit(visitable, type, (candidate) => {
        const node = candidate as unknown as MarkdownNode;
        node.url = neutralizeDangerousMarkdownUrl(node.url);
      });
    }
  };
}

const prismFragmentParser = rehype().data('settings', { fragment: true });

function prismLanguage(node: ElementNode): string {
  const value = node.properties.className;
  const classes = Array.isArray(value)
    ? value.map(String)
    : typeof value === 'string'
      ? value.split(/\s+/)
      : [];
  const languageClass = classes.find((name) => name.startsWith('language-'));
  const language = languageClass?.slice('language-'.length) || 'text';
  return /^[\w-]+$/.test(language) ? language : 'text';
}

/** Apply Prism to renderer-owned code nodes before the allowlist is enforced. */
function highlightBlogCode(options: { enabled: boolean }) {
  return (tree: unknown) => {
    visit(tree as Parameters<typeof visit>[0], 'element', (candidate) => {
      const pre = candidate as unknown as TreeNode;
      if (!isElement(pre) || pre.tagName !== 'pre') return;

      const code = pre.children.find(
        (child): child is ElementNode =>
          isElement(child) && child.tagName === 'code'
      );
      if (!code) return;

      const language = prismLanguage(code);
      code.properties.className = [`language-${language}`];
      const source = markdownText(code).trim();

      if (
        !options.enabled ||
        !Object.prototype.hasOwnProperty.call(Prism.languages, language)
      ) {
        code.children = [{ type: 'text', value: source }];
        return;
      }

      try {
        const highlighted = Prism.highlight(
          source,
          Prism.languages[language],
          language
        );
        const fragment = prismFragmentParser.parse(highlighted) as unknown as
          | TreeNode
          | undefined;
        code.children = fragment?.children || [{ type: 'text', value: source }];
      } catch {
        code.children = [{ type: 'text', value: source }];
      }
    });
  };
}

function appendClass(node: ElementNode, className: string): void {
  const value = node.properties.className;
  const classes = Array.isArray(value)
    ? value.map(String)
    : typeof value === 'string'
      ? value.split(/\s+/)
      : [];
  if (!classes.includes(className)) classes.push(className);
  node.properties.className = classes;
}

function addColumnHeaderScopes(node: TreeNode, insideHead = false): void {
  if (!isElement(node)) return;

  const isInsideHead = insideHead || node.tagName === 'thead';
  if (
    isInsideHead &&
    node.tagName === 'th' &&
    node.properties.scope === undefined
  ) {
    node.properties.scope = 'col';
  }

  for (const child of node.children) {
    addColumnHeaderScopes(child, isInsideHead);
  }
}

function wrapTables(node: TreeNode): void {
  if (!node.children) return;

  node.children = node.children.map((child) => {
    wrapTables(child);
    if (!isElement(child) || child.tagName !== 'table') return child;

    addColumnHeaderScopes(child);
    appendClass(child, 'blog-data-table');
    return {
      type: 'element',
      tagName: 'div',
      properties: {
        className: ['blog-table-scroll'],
        dataBlogTableScroll: 'true',
        tabIndex: 0,
      },
      children: [child],
    } satisfies ElementNode;
  });
}

/** Restore only renderer-owned ids, then add trusted presentation policies. */
function finalizeBlogHtml(options: FinalizeOptions) {
  return (tree: unknown) => {
    const root = tree as TreeNode;

    visit(tree as Parameters<typeof visit>[0], 'element', (candidate) => {
      const node = candidate as unknown as TreeNode;
      if (!isElement(node)) return;

      const marker = node.properties[HEADING_MARKER];
      if (marker !== undefined) {
        const heading = options.headings.find(
          (candidate) => candidate.marker === marker
        );
        delete node.properties[HEADING_MARKER];
        if (heading) {
          node.tagName = `h${heading.level}`;
          node.properties.id = heading.id;
        }
      }

      if (node.tagName === 'a') {
        const href = node.properties.href;
        if (typeof href === 'string' && /^https?:\/\//i.test(href)) {
          node.properties.target = options.externalLinksTarget;
          if (options.externalLinksTarget === '_blank') {
            node.properties.rel = ['noopener', 'noreferrer'];
          } else {
            delete node.properties.rel;
          }
        }
      }
    });

    wrapTables(root);
  };
}

/**
 * Synchronous, blog-specific Markdown renderer.
 *
 * Raw authored HTML is parsed so safe structural tags can survive, then an
 * explicit schema removes executable markup before renderer-owned ids, link
 * policy, and table wrappers are added. The docs renderer intentionally has a
 * different trust model and must not be reused here.
 */
export function renderBlogMarkdown(
  content: string,
  options: MarkdownProcessorOptions = {}
): string {
  const headings: RenderHeading[] = [];
  const demote = blogHeadingDemotion(content, options.demoteHeadings);
  const markerNonce = randomUUID();

  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(prepareBlogMarkdown, { content, demote, headings, markerNonce })
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(highlightBlogCode, {
        enabled: options.enableSyntaxHighlight !== false,
      })
      .use(rehypeSanitize, blogSanitizeSchema)
      .use(finalizeBlogHtml, {
        headings,
        externalLinksTarget: options.externalLinksTarget || '_blank',
      })
      .use(rehypeStringify, {
        characterReferences: { useNamedReferences: true },
        closeSelfClosing: true,
      })
      .processSync(content)
  );
}
