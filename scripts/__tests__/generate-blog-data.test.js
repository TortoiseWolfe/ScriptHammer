const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { generateBlogData, generateId } = require('../generate-blog-data');

function makeCheckout(posts, writeOrder) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'scripthammer-blog-data-')
  );
  const blogDir = path.join(root, 'public', 'blog');
  const outputDir = path.join(root, 'src', 'lib', 'blog');

  fs.mkdirSync(blogDir, { recursive: true });
  for (const fileName of writeOrder) {
    const filePath = path.join(blogDir, fileName);
    fs.writeFileSync(filePath, posts[fileName]);
  }

  return {
    root,
    blogDir,
    outputDir,
    outputFile: path.join(outputDir, 'blog-data.json'),
  };
}

async function generateIndex(checkout) {
  const log = console.log;
  console.log = () => {};
  try {
    await generateBlogData({
      blogDir: checkout.blogDir,
      outputDir: checkout.outputDir,
      outputFile: checkout.outputFile,
    });
  } finally {
    console.log = log;
  }
  return fs.readFileSync(checkout.outputFile, 'utf8');
}

function setAllFileTimes(directory, time) {
  for (const fileName of fs.readdirSync(directory)) {
    fs.utimesSync(path.join(directory, fileName), time, time);
  }
}

const POSTS = {
  'alpha.md': `---
title: Alpha Post
date: 2026-02-01
tags:
  - alpha
categories:
  - tests
---

Alpha content.
`,
  'beta.md': `---
title: Beta Post
date: 2026-02-01
updatedAt: 2026-02-03T12:00:00-05:00
tags:
  - beta
categories:
  - tests
---

Beta content.
`,
};

test('the blog index is byte-stable across regenerations and fresh checkouts', async (t) => {
  const firstCheckout = makeCheckout(POSTS, ['alpha.md', 'beta.md']);
  const secondCheckout = makeCheckout(POSTS, ['beta.md', 'alpha.md']);
  t.after(() => {
    fs.rmSync(firstCheckout.root, { recursive: true, force: true });
    fs.rmSync(secondCheckout.root, { recursive: true, force: true });
  });

  setAllFileTimes(firstCheckout.blogDir, new Date('2001-01-01T00:00:00Z'));
  const firstOutput = await generateIndex(firstCheckout);

  setAllFileTimes(firstCheckout.blogDir, new Date('2040-01-01T00:00:00Z'));
  const regeneratedOutput = await generateIndex(firstCheckout);
  assert.strictEqual(
    regeneratedOutput,
    firstOutput,
    'changing filesystem timestamps must not dirty the committed index'
  );

  setAllFileTimes(secondCheckout.blogDir, new Date('2030-06-01T00:00:00Z'));
  const freshCheckoutOutput = await generateIndex(secondCheckout);
  assert.strictEqual(
    freshCheckoutOutput,
    firstOutput,
    'the same source files must generate identical output in a fresh checkout'
  );

  const index = JSON.parse(firstOutput);
  assert.equal('generated' in index, false);
  assert.deepStrictEqual(
    index.posts.map((post) => ({
      id: post.id,
      slug: post.slug,
      publishedAt: post.publishedAt,
      updatedAt: post.updatedAt,
    })),
    [
      {
        id: generateId('alpha-post', '2026-02-01T00:00:00.000Z'),
        slug: 'alpha-post',
        publishedAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z',
      },
      {
        id: generateId('beta-post', '2026-02-01T00:00:00.000Z'),
        slug: 'beta-post',
        publishedAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-03T17:00:00.000Z',
      },
    ],
    'same-date posts sort by slug and all generated dates normalize to UTC'
  );
});

test('a blog post without a valid authored date fails before writing an index', async (t) => {
  const missingDate = makeCheckout(
    {
      'missing-date.md': `---
title: Missing Date
---

This cannot be published deterministically.
`,
    },
    ['missing-date.md']
  );
  const invalidDate = makeCheckout(
    {
      'invalid-date.md': `---
title: Invalid Date
date: definitely-not-a-date
---

This cannot be published deterministically.
`,
    },
    ['invalid-date.md']
  );
  t.after(() => {
    fs.rmSync(missingDate.root, { recursive: true, force: true });
    fs.rmSync(invalidDate.root, { recursive: true, force: true });
  });

  await assert.rejects(() => generateIndex(missingDate), /must define a date/);
  await assert.rejects(() => generateIndex(invalidDate), /invalid date/);
  assert.equal(fs.existsSync(missingDate.outputFile), false);
  assert.equal(fs.existsSync(invalidDate.outputFile), false);
});
