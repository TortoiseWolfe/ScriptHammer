'use client';

import { useState, useEffect, useCallback } from 'react';
import { createLogger } from '@/lib/logger';

const logger = createLogger('hooks:codeBlockPreferences');

export interface CodeBlockPreferences {
  showLineNumbers: boolean;
  preferredTheme?: string;
  expandedBlocks: string[];
  lastUpdated: string;
}

const STORAGE_KEY = 'codeBlockPreferences';

const defaultPreferences: CodeBlockPreferences = {
  showLineNumbers: false,
  preferredTheme: undefined,
  expandedBlocks: [],
  lastUpdated: new Date().toISOString(),
};

export function useCodeBlockPreferences() {
  const [preferences, setPreferences] =
    useState<CodeBlockPreferences>(defaultPreferences);

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences(parsed);
      }
    } catch (error) {
      logger.error('Failed to load code block preferences', { error });
    }
  }, []);

  // Save preferences to localStorage
  const savePreferences = useCallback((newPrefs: CodeBlockPreferences) => {
    if (typeof window === 'undefined') return;

    try {
      const updated = {
        ...newPrefs,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setPreferences(updated);
    } catch (error) {
      logger.error('Failed to save code block preferences', { error });
    }
  }, []);

  const updatePreference = useCallback(
    <K extends keyof CodeBlockPreferences>(
      key: K,
      value: CodeBlockPreferences[K]
    ) => {
      const updated = { ...preferences, [key]: value };
      savePreferences(updated);
    },
    [preferences, savePreferences]
  );

  const toggleLineNumbers = useCallback(() => {
    updatePreference('showLineNumbers', !preferences.showLineNumbers);
  }, [preferences.showLineNumbers, updatePreference]);

  const toggleBlockExpansion = useCallback(
    (blockId: string) => {
      const expandedBlocks = preferences.expandedBlocks.includes(blockId)
        ? preferences.expandedBlocks.filter((id) => id !== blockId)
        : [...preferences.expandedBlocks, blockId];

      // Limit to 100 expanded blocks for memory management
      if (expandedBlocks.length > 100) {
        expandedBlocks.shift();
      }

      updatePreference('expandedBlocks', expandedBlocks);
    },
    [preferences.expandedBlocks, updatePreference]
  );

  const copyToClipboard = useCallback(
    async (content: string): Promise<boolean> => {
      try {
        await navigator.clipboard.writeText(content);
        return true;
      } catch (error) {
        logger.error('Failed to copy to clipboard', { error });
        return false;
      }
    },
    []
  );

  return {
    preferences,
    updatePreference,
    toggleLineNumbers,
    toggleBlockExpansion,
    copyToClipboard,
  };
}
