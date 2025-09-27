#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Mock data for different component types
const mockData = {
  AuthorProfile: {
    author: `{
      id: 'author-1',
      name: 'Test Author',
      bio: 'Test bio',
      avatar: '/avatar.jpg',
      socials: { twitter: '@test' },
      stats: { posts: 10, views: 1000 }
    }`,
  },
  BlogPostCard: {
    post: `{
      id: 'post-1',
      slug: 'test-post',
      title: 'Test Post',
      content: 'Test content',
      excerpt: 'Test excerpt',
      status: 'published',
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: { id: 'author-1', name: 'Test Author' },
      metadata: { tags: ['test'], categories: [], readingTime: 5, wordCount: 100 },
      seo: { title: 'Test Post', description: 'Test excerpt' }
    }`,
  },
  BlogPostViewer: {
    post: `{
      id: 'post-1',
      slug: 'test-post',
      title: 'Test Post',
      content: 'Test content',
      excerpt: 'Test excerpt',
      status: 'published',
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: { id: 'author-1', name: 'Test Author' },
      metadata: { tags: ['test'], categories: [], readingTime: 5, wordCount: 100 },
      seo: { title: 'Test Post', description: 'Test excerpt' }
    }`,
  },
  ConflictResolver: {
    conflict: `{
      id: 'conflict-1',
      type: 'post',
      entityId: 'post-1',
      localVersion: { content: 'Local content', timestamp: new Date().toISOString() },
      remoteVersion: { content: 'Remote content', timestamp: new Date().toISOString() },
      baseVersion: { content: 'Base content', timestamp: new Date().toISOString() },
      createdAt: new Date().toISOString(),
      status: 'pending'
    }`,
    onResolve: `jest.fn()`,
  },
  SocialShareButtons: {
    shareOptions: `{
      title: 'Test Title',
      text: 'Test text',
      url: 'https://example.com'
    }`,
  },
};

function fixTestFile(filePath) {
  const componentName = path.basename(path.dirname(filePath));
  const content = fs.readFileSync(filePath, 'utf8');

  // Get the mock props for this component
  const props = mockData[componentName];
  if (!props) return;

  // Build props string
  const propsStr = Object.entries(props)
    .map(([key, value]) => `      ${key}: ${value}`)
    .join(',\n');

  // Fix the test file
  let newContent = content;

  // Fix test with no props
  newContent = newContent.replace(
    /render\(<\w+ \/>\)/g,
    `render(<${componentName} ${Object.keys(props)
      .map((k) => `${k}={${props[k]}}`)
      .join(' ')} />)`
  );

  // Fix test with children only
  newContent = newContent.replace(
    /render\(<\w+>Test \w+<\/\w+>\)/g,
    `render(<${componentName} ${Object.keys(props)
      .map((k) => `${k}={${props[k]}}`)
      .join(' ')} />)`
  );

  // Fix test with className only
  newContent = newContent.replace(
    /render\(<\w+ className="custom-class" \/>\)/g,
    `render(<${componentName} ${Object.keys(props)
      .map((k) => `${k}={${props[k]}}`)
      .join(' ')} className="custom-class" />)`
  );

  fs.writeFileSync(filePath, newContent);
  console.log(`Fixed: ${filePath}`);
}

// Process all test files
const componentsDir = path.join(process.cwd(), 'src/components/molecular');
const components = fs.readdirSync(componentsDir);

components.forEach((component) => {
  const testFile = path.join(componentsDir, component, `${component}.test.tsx`);
  if (fs.existsSync(testFile)) {
    fixTestFile(testFile);
  }
});

console.log('Test files fixed!');
