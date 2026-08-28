---
title: Hello, world
author: TortoiseWolfe
date: 2026-08-27
slug: hello-world
tags:
  - example
categories:
  - example
excerpt: The one post a fresh fork keeps. It exists to show the format — read it once, then delete it and write your own.
featuredImage: /blog-images/hello-world/featured.svg
featuredImageAlt: A dark card reading "Hello, world." above the words "An example post. Delete it and write your own."
ogImage: /blog-images/hello-world/og.png
ogTitle: Hello, world
ogDescription: The example post every fork of this template starts with.
twitterCard: summary_large_image
---

# Hello, world

This is the only post a freshly rebranded fork keeps. Everything else in
`public/blog/` belongs to the template and is removed by `scripts/rebrand.sh`, because a
new project should not publish the template's posts under its own name.

Read this once, then delete it.

## How a post works

A post is one markdown file in `public/blog/`. The frontmatter above is the whole
contract:

- `title`, `date`, `excerpt` — what the blog index and the post page render.
- `slug` — the URL. It overrides the filename, so `hello-world.md` need not be
  `/blog/hello-world/`. Keep them the same unless you have a reason.
- `tags`, `categories` — the filters on the blog index.
- `featuredImage` — **what a reader sees**, on the card and at the top of the post. A
  post without one is blank on the site.
- `ogImage` — the social card, shown when someone pastes the link. Use a PNG, 1200×630.

Both images must exist on disk; a test fails the build if they do not.

## The one thing that will catch you out

`public/blog/*.md` is **not** what the site serves. The site, the sitemap, the RSS feed
and the JSON feed all read `src/lib/blog/blog-data.json`, a committed index — and
generating it is deliberately not part of the build.

So after adding, editing, **or deleting** a post:

```bash
docker compose exec scripthammer pnpm generate:blog
```

and commit the resulting `blog-data.json` diff. Skip it and nothing happens: your edit
never ships, and a deleted post stays live, still in the sitemap, still in the feed.

`scripts/__tests__/blog-index-matches-disk.test.js` fails when the two sides disagree, so
CI will tell you — but it is quicker to remember than to be told.

## Writing your own

Copy this file, change the frontmatter, replace the body, regenerate the index:

```bash
cp public/blog/hello-world.md public/blog/my-first-post.md
# edit it, then:
docker compose exec scripthammer pnpm generate:blog
```

Then delete this one.
