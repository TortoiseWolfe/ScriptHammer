/**
 * Company Queue Adapter
 *
 * Ported from SpokeToWork fork (Feature 050 - Code Consolidation).
 * Handles offline queuing for company sync with conflict resolution.
 *
 * Note: This adapter provides conflict resolution capabilities
 * for multi-tenant company data synchronization. The `companies`
 * table isn't part of this repo's schema yet — the Supabase client
 * is cast through `any` for those calls. This adapter is included
 * for architectural completeness and will activate cleanly once
 * the companies feature lands.
 *
 * @module lib/offline-queue/company-adapter
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { BaseOfflineQueue } from './base-queue';
import {
  CompanyQueueItem,
  ConflictResolution,
  DEFAULT_QUEUE_CONFIG,
} from './types';
import { supabase } from '@/lib/supabase/client';

/**
 * Company queue for offline company sync with conflict resolution
 *
 * @example
 * ```typescript
 * // Queue a company update
 * await companyQueue.queueChange('update', 'company-123', {
 *   name: 'Updated Name',
 * }, { localVersion: 3, serverVersion: 2 });
 *
 * // Process queue when back online
 * const result = await companyQueue.sync();
 *
 * // Check for conflicts
 * const conflicts = await companyQueue.getConflicts();
 * ```
 */
export class CompanyQueueAdapter extends BaseOfflineQueue<CompanyQueueItem> {
  /** Conflicts storage */
  private conflicts: Map<
    string,
    {
      localVersion: Record<string, unknown>;
      serverVersion: Record<string, unknown>;
      detectedAt: string;
    }
  > = new Map();

  constructor() {
    super({
      dbName: 'CompanyQueue',
      tableName: 'syncQueue',
      ...DEFAULT_QUEUE_CONFIG,
    });
  }

  /**
   * Queue a company change
   */
  async queueChange(
    action: 'create' | 'update' | 'delete',
    companyId: string,
    payload: Record<string, unknown> | null,
    versions: { localVersion: number; serverVersion: number }
  ): Promise<CompanyQueueItem> {
    return await this.queue({
      companyId,
      action,
      payload,
      localVersion: versions.localVersion,
      serverVersion: versions.serverVersion,
    } as Omit<CompanyQueueItem, 'id' | 'status' | 'retries' | 'createdAt'>);
  }

  /**
   * Process a single company queue item
   */
  protected async processItem(item: CompanyQueueItem): Promise<void> {
    // Check for conflicts before processing
    const conflict = await this.checkForConflict(item);
    if (conflict) {
      this.storeConflict(item.companyId, conflict.local, conflict.server);
      throw new Error(
        `Conflict detected for company ${item.companyId}. Manual resolution required.`
      );
    }

    switch (item.action) {
      case 'create':
        await this.executeCreate(item);
        break;
      case 'update':
        await this.executeUpdate(item);
        break;
      case 'delete':
        await this.executeDelete(item);
        break;
      default:
        throw new Error(`Unknown action: ${item.action}`);
    }
  }

  /**
   * Check for version conflict
   *
   * Note: Uses 'any' cast because 'companies' table is not in this
   * repo's generated Supabase types.
   */
  private async checkForConflict(item: CompanyQueueItem): Promise<{
    local: Record<string, unknown>;
    server: Record<string, unknown>;
  } | null> {
    if (item.action === 'create') {
      return null; // No conflict possible for new items
    }

    const { data: serverCompany, error } = await (supabase as any)
      .from('companies')
      .select('*')
      .eq('id', item.companyId)
      .single();

    if (error || !serverCompany) {
      return null; // Item doesn't exist on server
    }

    // Check if server version is newer than what we expected
    const serverVersion = (serverCompany as Record<string, unknown>)
      .version as number;
    if (serverVersion > item.serverVersion) {
      return {
        local: item.payload || {},
        server: serverCompany as Record<string, unknown>,
      };
    }

    return null;
  }

  /**
   * Store a conflict for later resolution
   */
  private storeConflict(
    companyId: string,
    localVersion: Record<string, unknown>,
    serverVersion: Record<string, unknown>
  ): void {
    this.conflicts.set(companyId, {
      localVersion,
      serverVersion,
      detectedAt: new Date().toISOString(),
    });
    this.logger.warn('Conflict stored', { companyId });
  }

  /**
   * Get all unresolved conflicts
   */
  getConflicts(): Array<{
    companyId: string;
    localVersion: Record<string, unknown>;
    serverVersion: Record<string, unknown>;
    detectedAt: string;
  }> {
    return Array.from(this.conflicts.entries()).map(([companyId, data]) => ({
      companyId,
      ...data,
    }));
  }

  /**
   * Resolve a conflict
   */
  async resolveConflict(
    companyId: string,
    resolution: 'local' | 'server'
  ): Promise<ConflictResolution> {
    const conflict = this.conflicts.get(companyId);
    if (!conflict) {
      throw new Error(`No conflict found for company ${companyId}`);
    }

    if (resolution === 'local') {
      // Apply local version to server
      await (supabase as any)
        .from('companies')
        .update(conflict.localVersion)
        .eq('id', companyId);
    }
    // If 'server', we don't need to do anything - server already has correct version

    this.conflicts.delete(companyId);
    this.logger.info('Conflict resolved', { companyId, resolution });

    return {
      companyId,
      resolution,
      resolvedAt: new Date().toISOString(),
    };
  }

  /**
   * Execute create operation
   */
  private async executeCreate(item: CompanyQueueItem): Promise<void> {
    if (!item.payload) {
      throw new Error('Create operation requires payload');
    }

    const { error } = await (supabase as any)
      .from('companies')
      .insert(item.payload);

    if (error) {
      throw new Error(`Failed to create company: ${error.message}`);
    }
  }

  /**
   * Execute update operation
   */
  private async executeUpdate(item: CompanyQueueItem): Promise<void> {
    if (!item.payload) {
      throw new Error('Update operation requires payload');
    }

    const { error } = await (supabase as any)
      .from('companies')
      .update({
        ...item.payload,
        version: item.localVersion + 1,
      })
      .eq('id', item.companyId);

    if (error) {
      throw new Error(`Failed to update company: ${error.message}`);
    }
  }

  /**
   * Execute delete operation
   */
  private async executeDelete(item: CompanyQueueItem): Promise<void> {
    const { error } = await (supabase as any)
      .from('companies')
      .delete()
      .eq('id', item.companyId);

    if (error) {
      throw new Error(`Failed to delete company: ${error.message}`);
    }
  }
}

// Export singleton instance
export const companyQueue = new CompanyQueueAdapter();
