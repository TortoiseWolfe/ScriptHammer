# Use Next.js as the Framework

- Status: accepted
- Deciders: Project team
- Date: 2025-09-10

## Context and Problem Statement

We need to choose a web framework for CRUDkit that supports static site generation, server-side rendering, and modern React patterns while being deployable to GitHub Pages.

## Decision Drivers

- GitHub Pages compatibility for free hosting
- Modern developer experience
- Strong ecosystem and community support
- Built-in optimization features
- TypeScript support out of the box
- Easy PWA implementation

## Considered Options

- Next.js
- Gatsby
- Remix
- Plain React with Vite
- Astro

## Decision Outcome

Chosen option: "Next.js", because it provides the best balance of features, performance, and developer experience while supporting static export for GitHub Pages deployment.

### Positive Consequences

- Static export capability with `output: 'export'`
- App Router for modern React patterns
- Built-in image optimization
- Automatic code splitting
- Excellent TypeScript support
- Large ecosystem of examples and plugins
- Easy migration path to server-side features if needed

### Negative Consequences

- Some server-side features unavailable in static export mode
- Larger bundle size compared to minimal frameworks
- Learning curve for App Router patterns

## Pros and Cons of the Options

### Next.js

- Good, because of comprehensive feature set
- Good, because of static export support
- Good, because of excellent documentation
- Good, because of built-in optimizations
- Bad, because of complexity for simple sites
- Bad, because some features require server

### Gatsby

- Good, because optimized for static sites
- Good, because of GraphQL data layer
- Bad, because of complex build process
- Bad, because of declining community momentum

### Remix

- Good, because of excellent routing
- Good, because of progressive enhancement
- Bad, because limited static export support
- Bad, because newer with smaller ecosystem

### Plain React with Vite

- Good, because of simplicity
- Good, because of fast build times
- Bad, because requires manual setup for many features
- Bad, because no built-in routing or SSG

### Astro

- Good, because of multi-framework support
- Good, because of excellent performance
- Bad, because less React-focused
- Bad, because smaller ecosystem
