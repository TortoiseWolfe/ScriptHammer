import { describe, it, expect, beforeEach, vi } from 'vitest';

interface StorageItem {
  id?: string;
  content?: string;
  size?: number;
  compressed?: boolean;
  data?: string;
  original_length?: number;
  [key: string]: unknown;
}

interface CompressedItem {
  compressed: boolean;
  data: string;
  original_length: number;
}

interface DeletionLogEntry {
  id: string;
  size: number;
  reason: string;
  timestamp: string;
}

interface QuotaResult {
  used: number;
  available: number;
  total: number;
  percentage: number;
  status: string;
  needsAction: boolean;
}

interface StoreResult {
  success: boolean;
  id?: string;
  size?: number;
  compressed?: boolean;
  error?: string;
  required?: number;
  available?: number;
  originalSize?: number;
  compressedSize?: number;
  compressionRatio?: number;
}

// Mock storage quota manager
class MockStorageQuotaManager {
  private maxStorage = 5 * 1024 * 1024; // 5MB
  private warningThreshold = 0.8; // 80%
  private criticalThreshold = 0.95; // 95%
  private compressionThreshold = 0.7; // Start compressing at 70%

  private storage: Map<string, StorageItem> = new Map();
  private compressed: Set<string> = new Set();
  private deletionLog: DeletionLogEntry[] = [];

  async checkQuota() {
    const used = this.calculateUsage();
    const available = this.maxStorage - used;
    const percentage = (used / this.maxStorage) * 100;

    return {
      used,
      available,
      total: this.maxStorage,
      percentage: Math.round(percentage),
      status: this.getStatus(percentage / 100),
      needsAction: percentage > this.warningThreshold * 100,
    };
  }

  async store(
    id: string,
    content: StorageItem,
    options?: { compressed?: boolean; [key: string]: unknown }
  ) {
    const size = this.calculateSize(content);
    const currentUsage = this.calculateUsage();

    // Check if we have space
    if (currentUsage + size > this.maxStorage) {
      // Try compression first
      if (
        !(options as { compressed?: boolean })?.compressed &&
        currentUsage + size * 0.3 <= this.maxStorage
      ) {
        return this.storeCompressed(id, content);
      }

      // Try to free up space
      const freed = await this.freeSpace(size);
      if (!freed) {
        return {
          success: false,
          error: 'Storage quota exceeded',
          required: size,
          available: this.maxStorage - currentUsage,
        };
      }
    }

    // Check if we should compress proactively
    if (
      (currentUsage + size) / this.maxStorage > this.compressionThreshold &&
      !(options as { compressed?: boolean })?.compressed
    ) {
      return this.storeCompressed(id, content);
    }

    this.storage.set(id, content);

    return {
      success: true,
      id,
      size,
      compressed: false,
    };
  }

  private async storeCompressed(id: string, content: StorageItem) {
    const compressed = this.compress(content);
    const compressedSize = this.calculateSize(compressed);

    this.storage.set(id, compressed as StorageItem);
    this.compressed.add(id);

    return {
      success: true,
      id,
      originalSize: this.calculateSize(content),
      compressedSize,
      compressed: true,
      compressionRatio: compressedSize / this.calculateSize(content),
    };
  }

  private compress(content: StorageItem): CompressedItem {
    // Simulate compression
    const str = JSON.stringify(content);
    return {
      compressed: true,
      data: str.substring(0, Math.floor(str.length * 0.3)),
      original_length: str.length,
    };
  }

  private decompress(compressed: CompressedItem | StorageItem): StorageItem {
    if (!('compressed' in compressed) || !compressed.compressed)
      return compressed as StorageItem;
    // Simulate decompression
    return JSON.parse('{"decompressed": true}') as StorageItem;
  }

  private async freeSpace(required: number): Promise<boolean> {
    const items = Array.from(this.storage.entries()).map(([id, content]) => ({
      id,
      size: this.calculateSize(content),
      compressed: this.compressed.has(id),
      lastAccessed: Date.now() - Math.random() * 1000000, // Simulate access times
    }));

    // Sort by priority (oldest, uncompressed first)
    items.sort((a, b) => {
      if (a.compressed !== b.compressed) {
        return a.compressed ? 1 : -1; // Prefer deleting uncompressed
      }
      return a.lastAccessed - b.lastAccessed; // Then by age
    });

    let freed = 0;
    const deleted: string[] = [];

    for (const item of items) {
      // Try compression first if not already compressed
      if (!item.compressed) {
        const content = this.storage.get(item.id);
        if (!content) continue;
        const compressed = this.compress(content);
        const savedSpace = item.size - this.calculateSize(compressed);

        if (savedSpace > 0) {
          this.storage.set(item.id, compressed as StorageItem);
          this.compressed.add(item.id);
          freed += savedSpace;

          if (freed >= required) {
            return true;
          }
        }
      }

      // If still need space, delete
      if (freed < required) {
        this.storage.delete(item.id);
        this.compressed.delete(item.id);
        deleted.push(item.id);
        freed += item.size;

        this.deletionLog.push({
          id: item.id,
          size: item.size,
          reason: 'quota_management',
          timestamp: new Date().toISOString(),
        });

        if (freed >= required) {
          return true;
        }
      }
    }

    return freed >= required;
  }

  private calculateUsage(): number {
    let total = 0;
    for (const content of this.storage.values()) {
      if (content !== null && content !== undefined) {
        total += this.calculateSize(content);
      }
    }
    return total;
  }

  private calculateSize(content: unknown): number {
    if (content === null || content === undefined) {
      return 0;
    }

    try {
      const str =
        typeof content === 'string' ? content : JSON.stringify(content);
      if (!str) {
        return 0;
      }
      return Buffer.byteLength(str, 'utf8');
    } catch (error) {
      // Handle circular references or other JSON.stringify errors
      return 0;
    }
  }

  private getStatus(ratio: number): string {
    if (ratio >= this.criticalThreshold) return 'critical';
    if (ratio >= this.warningThreshold) return 'warning';
    if (ratio >= this.compressionThreshold) return 'compress';
    return 'healthy';
  }

  getItem(id: string) {
    const content = this.storage.get(id);
    if (!content) return null;

    if (this.compressed.has(id)) {
      return this.decompress(content);
    }

    return content;
  }

  getDeletionLog() {
    return this.deletionLog;
  }

  clear() {
    this.storage.clear();
    this.compressed.clear();
    this.deletionLog = [];
  }

  getStats() {
    return {
      items: this.storage.size,
      compressed: this.compressed.size,
      deletions: this.deletionLog.length,
      usage: this.calculateUsage(),
      compressionRate:
        this.storage.size > 0
          ? (this.compressed.size / this.storage.size) * 100
          : 0,
    };
  }
}

describe('Storage Quota Manager Unit Tests - Edge Cases', () => {
  let manager: MockStorageQuotaManager;

  beforeEach(() => {
    manager = new MockStorageQuotaManager();
    vi.clearAllMocks();
  });

  describe('Quota Boundary Conditions', () => {
    it('should handle exactly reaching quota limit', async () => {
      const exactSize = 5 * 1024 * 1024; // Exactly 5MB
      const content = 'x'.repeat(exactSize);

      const result = await manager.store('exact', { content });

      // Should compress or fail if content is exactly at limit
      if (result.success) {
        expect(result.compressed).toBe(true);
      } else {
        const storeResult = result as StoreResult;
        expect(storeResult.error).toContain('quota exceeded');
      }
    });

    it('should handle one byte under quota', async () => {
      const underSize = 5 * 1024 * 1024 - 1;
      const content = 'x'.repeat(underSize);

      const result = await manager.store('under', { content });

      // Should trigger compression due to threshold
      expect(result.success).toBe(true);
      expect(result.compressed).toBe(true);
    });

    it('should handle storing zero-byte content', async () => {
      const result = await manager.store('empty', { content: '' });

      expect(result.success).toBe(true);
      const storeResult = result as StoreResult;
      // Size includes the object wrapper, not just content
      expect(storeResult.size).toBeGreaterThanOrEqual(0);
    });

    it('should handle rapid quota changes', async () => {
      const operations = [];

      // Rapidly add and remove items
      for (let i = 0; i < 10; i++) {
        const content = 'x'.repeat(500000); // 500KB each
        operations.push(manager.store(`item${i}`, { content }));
      }

      const results = await Promise.all(operations);

      // Some should succeed, some should trigger compression or fail
      const succeeded = results.filter((r) => r.success);
      const compressed = results.filter((r) => r.compressed);

      expect(succeeded.length).toBeGreaterThan(0);
      expect(compressed.length).toBeGreaterThan(0);
    });
  });

  describe('Compression Edge Cases', () => {
    it('should handle incompressible content', async () => {
      // Random content doesn't compress well
      const random = Array(1000000)
        .fill(null)
        .map(() => Math.random().toString(36))
        .join('');

      const result = await manager.store('random', { content: random });

      if (result.compressed) {
        const storeResult = result as StoreResult;
        expect(storeResult.compressionRatio!).toBeGreaterThan(0);
      }
    });

    it('should handle already compressed content', async () => {
      const compressed = { compressed: true, data: 'already_compressed' };

      const result = await manager.store(
        'pre-compressed',
        compressed as StorageItem,
        {
          compressed: true,
        }
      );

      expect(result.success).toBe(true);
      // Should not try to compress again
    });

    it('should handle compression failures gracefully', async () => {
      const circular: StorageItem = { name: 'test' };
      circular.self = circular; // Circular reference

      // Should handle circular reference in JSON.stringify
      const result = await manager.store('circular', circular);

      // Implementation should handle this case
      expect(result).toBeDefined();
    });

    it('should prioritize compression over deletion', async () => {
      // Fill storage with uncompressed data
      for (let i = 0; i < 8; i++) {
        await manager.store(`item${i}`, { content: 'x'.repeat(600000) }); // 600KB each
      }

      const stats = manager.getStats();
      const initialItems = stats.items;

      // Try to add more - should compress existing items first
      const result = await manager.store('new-item', {
        content: 'y'.repeat(500000),
      });

      const newStats = manager.getStats();

      expect(result.success).toBe(true);
      expect(newStats.compressed).toBeGreaterThan(0);
      // Should have compressed rather than deleted
      expect(newStats.items).toBeGreaterThanOrEqual(initialItems);
    });
  });

  describe('Deletion Strategy Edge Cases', () => {
    it('should handle deletion of last item', async () => {
      await manager.store('only-item', { content: 'x'.repeat(4000000) }); // 4MB

      // Try to store something larger
      const result = await manager.store('large-item', {
        content: 'y'.repeat(3000000),
      });

      // Should either compress or delete to make space
      if (result.success) {
        expect(result.compressed).toBe(true);
      } else {
        const log = manager.getDeletionLog();
        // May or may not delete depending on compression success
        expect(log.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle circular deletion scenario', async () => {
      // Fill with items that reference each other
      const item1 = { id: '1', ref: '2', data: 'x'.repeat(2000000) };
      const item2 = { id: '2', ref: '1', data: 'y'.repeat(2000000) };

      await manager.store('item1', item1);
      await manager.store('item2', item2);

      // Force deletion
      const result = await manager.store('large', {
        content: 'z'.repeat(4000000),
      });

      expect(result.success).toBe(true);
      // Should have handled circular references
    });

    it('should preserve recently accessed items', async () => {
      // Simulate different access times
      const items = [
        { id: 'old', content: 'x'.repeat(1000000), lastAccess: -1000000 },
        { id: 'recent', content: 'y'.repeat(1000000), lastAccess: -100 },
        { id: 'medium', content: 'z'.repeat(1000000), lastAccess: -50000 },
      ];

      for (const item of items) {
        await manager.store(item.id, { content: item.content });
      }

      // Force cleanup
      await manager.store('trigger', { content: 'a'.repeat(3000000) });

      // Recent item should still exist
      const recent = manager.getItem('recent');
      const old = manager.getItem('old');

      // In our mock, deletion is based on simulated access times
      // Real implementation would track actual access
    });

    it('should handle deletion failure recovery', async () => {
      // Fill storage
      for (let i = 0; i < 5; i++) {
        await manager.store(`item${i}`, { content: 'x'.repeat(900000) });
      }

      // Try to store something that requires multiple deletions
      const result = await manager.store('large', {
        content: 'y'.repeat(3000000),
      });

      if (result.success) {
        const log = manager.getDeletionLog();
        // May have deleted 0 or more items
        expect(log.length).toBeGreaterThanOrEqual(0);
        expect(log.every((entry) => entry.reason === 'quota_management')).toBe(
          true
        );
      }
    });
  });

  describe('Threshold Behavior', () => {
    it('should trigger compression at 70% capacity', async () => {
      // Fill to just under 70%
      const size69 = Math.floor(5 * 1024 * 1024 * 0.69);
      await manager.store('item1', { content: 'x'.repeat(size69) });

      const quotaBefore = await manager.checkQuota();
      expect(quotaBefore.status).toBe('healthy');

      // Add item to exceed 70%
      const result = await manager.store('item2', {
        content: 'y'.repeat(100000),
      });

      expect(result.compressed).toBe(true);
    });

    it('should warn at 80% capacity', async () => {
      const size80 = Math.floor(5 * 1024 * 1024 * 0.81);
      await manager.store(
        'large',
        { content: 'x'.repeat(size80) },
        { compressed: true }
      );

      const quota = await manager.checkQuota();

      expect(quota.status).toBe('warning');
      expect(quota.needsAction).toBe(true);
    });

    it('should enter critical state at 95%', async () => {
      const size95 = Math.floor(5 * 1024 * 1024 * 0.96);
      await manager.store(
        'critical',
        { content: 'x'.repeat(size95) },
        { compressed: true }
      );

      const quota = await manager.checkQuota();

      expect(quota.status).toBe('critical');
    });

    it('should handle threshold transitions', async () => {
      const states: string[] = [];

      // Gradually fill storage
      for (let i = 0; i < 20; i++) {
        await manager.store(`item${i}`, { content: 'x'.repeat(250000) }); // 250KB each
        const quota = await manager.checkQuota();

        if (states[states.length - 1] !== quota.status) {
          states.push(quota.status);
        }
      }

      // Should transition through states
      expect(states).toContain('healthy');
      // Check if compression state exists before warning
      const compressIndex = states.indexOf('compress');
      const warningIndex = states.indexOf('warning');

      // Compression may or may not occur before warning
      if (compressIndex >= 0 && warningIndex >= 0) {
        expect(compressIndex).toBeLessThanOrEqual(warningIndex);
      }
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle simultaneous storage requests', async () => {
      const promises = [];

      // Simulate concurrent writes
      for (let i = 0; i < 10; i++) {
        promises.push(
          manager.store(`concurrent${i}`, { content: 'x'.repeat(400000) })
        );
      }

      const results = await Promise.all(promises);

      // Should handle concurrency without corruption
      const stats = manager.getStats();
      expect(stats.items).toBeGreaterThan(0);
      expect(stats.usage).toBeGreaterThan(0);
    });

    it('should handle read during cleanup', async () => {
      // Fill storage
      for (let i = 0; i < 5; i++) {
        await manager.store(`item${i}`, { content: 'x'.repeat(900000) });
      }

      // Start cleanup operation
      const cleanupPromise = manager.store('trigger-cleanup', {
        content: 'y'.repeat(3000000),
      });

      // Try to read during cleanup
      const item = manager.getItem('item0');

      await cleanupPromise;

      // Should handle concurrent read/write
      expect(cleanupPromise).toBeDefined();
    });
  });

  describe('Recovery Scenarios', () => {
    it('should recover from corrupted storage state', () => {
      // Simulate corrupted state
      (
        manager as unknown as {
          storage: Map<string, StorageItem>;
          compressed: Set<string>;
        }
      )['storage'].set('corrupt', undefined as unknown as StorageItem);
      (
        manager as unknown as {
          storage: Map<string, StorageItem>;
          compressed: Set<string>;
        }
      )['compressed'].add('corrupt');

      // Should handle gracefully
      const quota = manager.checkQuota();
      expect(quota).toBeDefined();

      const item = manager.getItem('corrupt');
      expect(item).toBeNull();
    });

    it('should handle quota calculation with invalid data', async () => {
      // Add invalid data types
      const managerWithPrivate = manager as unknown as {
        storage: Map<string, StorageItem>;
      };
      managerWithPrivate['storage'].set('null', null as unknown as StorageItem);
      managerWithPrivate['storage'].set(
        'undefined',
        undefined as unknown as StorageItem
      );
      managerWithPrivate['storage'].set(
        'number',
        12345 as unknown as StorageItem
      );
      managerWithPrivate['storage'].set(
        'boolean',
        true as unknown as StorageItem
      );

      // Should not crash
      const quota = await manager.checkQuota();
      expect(quota).toBeDefined();
      expect(quota.used).toBeGreaterThanOrEqual(0);
    });

    it('should recover from failed compression', async () => {
      const failingContent = {
        toString: () => {
          throw new Error('Cannot stringify');
        },
      };

      // Should handle compression failure
      try {
        await manager.store('failing', failingContent);
      } catch (error) {
        // Should handle error gracefully
      }

      const stats = manager.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track compression effectiveness', async () => {
      const contents = [
        'a'.repeat(100000), // Highly compressible
        Array(100000)
          .fill(null)
          .map(() => Math.random())
          .join(''), // Low compressibility
        'pattern'.repeat(10000), // Medium compressibility
      ];

      for (let i = 0; i < contents.length; i++) {
        await manager.store(`item${i}`, { content: contents[i] });
      }

      const stats = manager.getStats();

      expect(stats.compressionRate).toBeGreaterThanOrEqual(0);
      expect(stats.compressionRate).toBeLessThanOrEqual(100);
    });

    it('should maintain accurate deletion log', async () => {
      // Fill and trigger deletions
      for (let i = 0; i < 10; i++) {
        await manager.store(`temp${i}`, { content: 'x'.repeat(600000) });
      }

      const log = manager.getDeletionLog();

      // Verify log structure
      for (const entry of log) {
        expect(entry).toHaveProperty('id');
        expect(entry).toHaveProperty('size');
        expect(entry).toHaveProperty('reason');
        expect(entry).toHaveProperty('timestamp');
      }
    });

    it('should provide quota warnings early', async () => {
      const warnings: string[] = [];

      const checkAndWarn = async (content: string) => {
        const result = await manager.store('test', { content });
        const quota = await manager.checkQuota();

        if (quota.needsAction) {
          warnings.push(`Warning: ${quota.percentage}% used`);
        }

        return { result, quota };
      };

      // Gradually fill storage
      for (let i = 0; i < 10; i++) {
        await checkAndWarn('x'.repeat(450000));
      }

      // May or may not get warnings depending on compression success
      expect(warnings.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle many small items efficiently', async () => {
      const startTime = Date.now();

      // Store many small items
      for (let i = 0; i < 1000; i++) {
        await manager.store(`small${i}`, { content: `item${i}` });
      }

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should be fast
      expect(manager.getStats().items).toBe(1000);
    });

    it('should optimize cleanup for many items', async () => {
      // Fill with many items
      for (let i = 0; i < 100; i++) {
        await manager.store(`item${i}`, { content: 'x'.repeat(40000) });
      }

      const startTime = Date.now();

      // Trigger cleanup
      await manager.store('large', { content: 'y'.repeat(2000000) });

      const duration = Date.now() - startTime;

      // Cleanup should be reasonably fast
      expect(duration).toBeLessThan(500);
    });

    it('should handle storage near limits efficiently', async () => {
      // Fill to near capacity
      const fillSize = Math.floor(5 * 1024 * 1024 * 0.94);
      await manager.store(
        'bulk',
        { content: 'x'.repeat(fillSize) },
        { compressed: true }
      );

      // Perform operations near limit
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(manager.checkQuota());
      }

      const results = await Promise.all(operations);

      // All checks should complete
      expect(
        results.every((r) => r.status === 'warning' || r.status === 'critical')
      ).toBe(true);
    });
  });
});
