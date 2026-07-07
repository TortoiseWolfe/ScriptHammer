import { useEffect, useCallback } from 'react';

export type ShortcutCallback = (event: KeyboardEvent) => void;

export interface KeyboardShortcut {
  key: string;
  ctrlOrCmd?: boolean;
  shift?: boolean;
  alt?: boolean;
  callback: ShortcutCallback;
  description?: string;
}

/**
 * useKeyboardShortcuts hook
 *
 * Global keyboard shortcut management
 *
 * Examples:
 * - Ctrl+K or Cmd+K: Open search
 * - Escape: Close modals
 * - Ctrl+Enter: Submit form
 * - Ctrl+1-9: Navigate to item
 * - Arrow Up/Down: Navigate list
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const isCtrlOrCmd = shortcut.ctrlOrCmd
          ? event.ctrlKey || event.metaKey
          : true;
        const isShift = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const isAlt = shortcut.alt ? event.altKey : !event.altKey;

        if (event.key === shortcut.key && isCtrlOrCmd && isShift && isAlt) {
          shortcut.callback(event);
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Preset shortcuts for common actions
 */
export const shortcuts = {
  // Global shortcuts
  openSearch: (callback: ShortcutCallback): KeyboardShortcut => ({
    key: 'k',
    ctrlOrCmd: true,
    callback,
    description: 'Open search',
  }),

  closeModal: (callback: ShortcutCallback): KeyboardShortcut => ({
    key: 'Escape',
    callback,
    description: 'Close modal',
  }),

  // Form shortcuts
  submitForm: (callback: ShortcutCallback): KeyboardShortcut => ({
    key: 'Enter',
    ctrlOrCmd: true,
    callback,
    description: 'Submit form',
  }),

  // Navigation shortcuts
  previousItem: (callback: ShortcutCallback): KeyboardShortcut => ({
    key: 'ArrowUp',
    callback,
    description: 'Previous item',
  }),

  nextItem: (callback: ShortcutCallback): KeyboardShortcut => ({
    key: 'ArrowDown',
    callback,
    description: 'Next item',
  }),

  // Numbered shortcuts (1-9)
  jumpToItem: (
    number: number,
    callback: ShortcutCallback
  ): KeyboardShortcut => ({
    key: number.toString(),
    ctrlOrCmd: true,
    callback,
    description: `Jump to item ${number}`,
  }),
};
