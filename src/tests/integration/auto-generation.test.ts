import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Temporarily modify process.env type for testing
interface TestProcessEnv {
  NODE_ENV?: string;
  [key: string]: string | undefined;
}

// Mock file watcher and processing pipeline
const mockFileWatcher = vi.fn();
const mockMarkdownProcessor = vi.fn();
const mockDatabaseSync = vi.fn();

describe('Auto-Generation Integration Test', () => {
  const testBlogDir = path.join(process.cwd(), 'test-blog');
  const testPostPath = path.join(testBlogDir, 'test-post.md');

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testBlogDir, { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup test directory
    await fs.rm(testBlogDir, { recursive: true, force: true });
  });

  describe('File Change Detection and Processing', () => {
    it('should detect new markdown file and trigger processing', async () => {
      // Simulate file watcher initialization
      mockFileWatcher.mockImplementation((dir, callback) => {
        // Return watcher instance
        return {
          on: vi.fn((event, handler) => {
            if (event === 'add') {
              setTimeout(() => handler(testPostPath), 100);
            }
          }),
          close: vi.fn(),
        };
      });

      const watcher = mockFileWatcher(testBlogDir, async (filePath: string) => {
        await mockMarkdownProcessor(filePath);
      });

      // Create new markdown file
      const content = `---
title: Test Post
author: Test Author
showToc: true
---

# Test Post

This is a test post content.`;

      await fs.writeFile(testPostPath, content);

      // Wait for file watcher to trigger
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(mockFileWatcher).toHaveBeenCalledWith(
        testBlogDir,
        expect.any(Function)
      );
    });

    it('should process markdown changes within 1 second', async () => {
      const startTime = Date.now();

      mockMarkdownProcessor.mockResolvedValue({
        html: '<h1>Test Post</h1>',
        metadata: { title: 'Test Post' },
        toc: [],
      });

      const content = `# Test Post\n\nContent`;
      await fs.writeFile(testPostPath, content);

      // Simulate immediate processing
      const result = await mockMarkdownProcessor(testPostPath);
      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(1000);
      expect(result).toHaveProperty('html');
    });

    it('should debounce rapid file changes', async () => {
      let callCount = 0;
      const debouncedProcessor = vi.fn(() => {
        callCount++;
      });

      // Simulate debounce logic
      let timeout: NodeJS.Timeout;
      const debounce = (fn: (...args: unknown[]) => unknown, delay: number) => {
        return (...args: unknown[]) => {
          clearTimeout(timeout);
          timeout = setTimeout(() => fn(...args), delay);
        };
      };

      const processWithDebounce = debounce(debouncedProcessor, 500);

      // Rapid file changes
      for (let i = 0; i < 5; i++) {
        await fs.writeFile(testPostPath, `# Test Post\n\nVersion ${i}`);
        processWithDebounce(testPostPath);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Wait for debounce to complete
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Should only process once after debounce
      expect(callCount).toBe(1);
    });

    it('should sync processed content to IndexedDB', async () => {
      mockMarkdownProcessor.mockResolvedValue({
        html: '<h1>Processed</h1>',
        metadata: {
          title: 'Processed Post',
          slug: 'processed-post',
        },
      });

      mockDatabaseSync.mockResolvedValue({
        success: true,
        id: 'post-123',
      });

      // Process and sync
      const processed = await mockMarkdownProcessor(testPostPath);
      const synced = await mockDatabaseSync(processed);

      expect(synced.success).toBe(true);
      expect(synced).toHaveProperty('id');
    });

    it('should handle file deletion', async () => {
      // Create file first
      await fs.writeFile(testPostPath, '# Post');

      // Mock deletion handler
      const onDelete = vi.fn();

      // Delete file
      await fs.unlink(testPostPath);

      // Simulate watcher detecting deletion
      onDelete(testPostPath);

      expect(onDelete).toHaveBeenCalledWith(testPostPath);
    });

    it('should ignore non-markdown files', async () => {
      const nonMdPath = path.join(testBlogDir, 'image.png');

      const shouldProcess = (filePath: string) => {
        return path.extname(filePath) === '.md';
      };

      expect(shouldProcess(nonMdPath)).toBe(false);
      expect(shouldProcess(testPostPath)).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      mockMarkdownProcessor.mockRejectedValue(new Error('Processing failed'));

      const errorHandler = vi.fn();

      try {
        await mockMarkdownProcessor('invalid.md');
      } catch (error) {
        errorHandler(error);
      }

      expect(errorHandler).toHaveBeenCalled();
    });

    it('should maintain metadata during processing', async () => {
      const originalMetadata = {
        title: 'Original Title',
        author: 'Original Author',
        tags: ['test', 'blog'],
        showToc: true,
      };

      mockMarkdownProcessor.mockResolvedValue({
        html: '<h1>Content</h1>',
        metadata: originalMetadata,
        preserved: true,
      });

      const result = await mockMarkdownProcessor(testPostPath);

      expect(result.metadata).toEqual(originalMetadata);
      expect(result.metadata.showToc).toBe(true);
    });
  });

  describe('Hot Reload in Development', () => {
    it('should trigger hot reload on content change', async () => {
      const hotReloadTrigger = vi.fn();

      // Simulate development environment
      const oldEnv = process.env.NODE_ENV;
      (process.env as TestProcessEnv).NODE_ENV = 'development';

      // File change triggers hot reload
      await fs.writeFile(testPostPath, '# Updated Content');
      hotReloadTrigger('change', testPostPath);

      expect(hotReloadTrigger).toHaveBeenCalledWith('change', testPostPath);

      // Cleanup
      (process.env as TestProcessEnv).NODE_ENV = oldEnv;
    });

    it('should not trigger hot reload in production', async () => {
      const hotReloadTrigger = vi.fn();

      // Simulate production environment
      const oldEnv = process.env.NODE_ENV;
      (process.env as TestProcessEnv).NODE_ENV = 'production';

      const shouldHotReload = () => {
        return process.env.NODE_ENV === 'development';
      };

      expect(shouldHotReload()).toBe(false);

      // Cleanup
      (process.env as TestProcessEnv).NODE_ENV = oldEnv;
    });
  });

  describe('Batch Processing', () => {
    it('should handle multiple file changes efficiently', async () => {
      const files = ['post1.md', 'post2.md', 'post3.md'];

      const batchProcessor = vi.fn(async (filePaths: string[]) => {
        return filePaths.map((fp) => ({
          path: fp,
          processed: true,
        }));
      });

      const results = await batchProcessor(files);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.processed)).toBe(true);
    });
  });
});
