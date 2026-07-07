#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Map of files and their any type fixes
const fixes = {
  'src/app/api/blog/posts/[id]/route.ts': [
    { line: 25, old: 'any', new: 'unknown' },
  ],
  'src/app/api/blog/posts/route.ts': [{ line: 29, old: 'any', new: 'unknown' }],
  'src/app/api/blog/sync/route.ts': [{ line: 36, old: 'any', new: 'unknown' }],
  'src/app/blog/[slug]/page.tsx': [
    { line: 20, old: '(p: any)', new: '(p: BlogPost)' },
    { line: 106, old: '(post: any)', new: '(post: BlogPost)' },
  ],
  'src/lib/blog/database.ts': [
    { line: 56, old: 'any', new: 'unknown' },
    { line: 66, old: 'any', new: 'unknown' },
  ],
  'src/lib/blog/markdown-processor.ts': [
    {
      line: 351,
      old: 'options?: any',
      new: 'options?: Record<string, unknown>',
    },
  ],
  'src/services/blog/social-service.ts': [
    { line: 39, old: 'any', new: 'unknown' },
    { line: 73, old: 'any', new: 'unknown' },
    { line: 250, old: 'any', new: 'unknown' },
  ],
  'src/services/blog/storage-service.ts': [
    { line: 229, old: 'any', new: 'unknown' },
    { line: 276, old: 'any', new: 'unknown' },
  ],
  'src/services/blog/sync-service.ts': [
    { line: 58, old: 'any', new: 'unknown' },
    { line: 270, old: 'any', new: 'unknown' },
  ],
  'src/tests/contract/blog-authors.test.ts': [
    { line: 166, old: 'any', new: 'unknown' },
  ],
  'src/tests/contract/blog-conflicts.test.ts': [
    { line: 8, old: 'any', new: 'unknown' },
  ],
  'src/tests/contract/blog-posts-create.test.ts': [
    { line: 7, old: 'any', new: 'unknown' },
  ],
  'src/tests/contract/blog-posts-list.test.ts': [
    { line: 127, old: 'any', new: 'BlogPost[]' },
    { line: 137, old: 'any', new: 'BlogPost[]' },
    { line: 148, old: 'any', new: 'BlogPost[]' },
    { line: 158, old: 'any', new: 'BlogPost[]' },
  ],
  'src/tests/contract/blog-posts-update.test.ts': [
    { line: 10, old: 'any', new: 'unknown' },
  ],
  'src/tests/contract/blog-sync.test.ts': [
    { line: 8, old: 'any', new: 'unknown' },
    { line: 28, old: 'any', new: 'unknown' },
  ],
  'src/types/blog.ts': [
    { line: 74, old: 'Record<string, any>', new: 'Record<string, unknown>' },
  ],
  'src/types/metadata.ts': [
    { line: 83, old: 'Record<string, any>', new: 'Record<string, unknown>' },
  ],
  'src/types/storage.ts': [
    { line: 17, old: 'any', new: 'unknown' },
    { line: 117, old: 'data: any', new: 'data: unknown' },
  ],
  'src/types/sync.ts': [
    { line: 9, old: 'Record<string, any>', new: 'Record<string, unknown>' },
    { line: 23, old: 'Record<string, any>', new: 'Record<string, unknown>' },
    { line: 33, old: 'local: any', new: 'local: unknown' },
    { line: 34, old: 'remote: any', new: 'remote: unknown' },
    { line: 49, old: 'payload?: any', new: 'payload?: unknown' },
    { line: 80, old: 'errors?: any[]', new: 'errors?: unknown[]' },
    { line: 95, old: '(data: any)', new: '(data: unknown)' },
    { line: 101, old: 'local: any', new: 'local: unknown' },
    { line: 102, old: 'remote: any', new: 'remote: unknown' },
    { line: 103, old: 'base?: any', new: 'base?: unknown' },
    { line: 105, old: 'merged?: any', new: 'merged?: unknown' },
  ],
};

// Process each file
Object.entries(fixes).forEach(([filePath, changes]) => {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping ${filePath} - file not found`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');
  let modified = false;

  // Apply each fix
  changes.forEach((change) => {
    const regex = new RegExp(
      change.old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'g'
    );
    const newContent = content.replace(regex, change.new);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(fullPath, content);
    console.log(`✓ Fixed ${filePath}`);
  }
});

console.log('Done fixing any types!');
