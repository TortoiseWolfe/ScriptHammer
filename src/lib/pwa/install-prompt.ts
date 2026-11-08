'use client';

/**
 * One shared holder for the browser's install prompt (#1262, item 1).
 *
 * The browser fires `beforeinstallprompt` once and honours a single `prompt()`
 * call on that event. GlobalNav and PWAInstall are both mounted in the layout and
 * each used to listen on its own, call preventDefault() and keep its own copy of
 * the event, so whichever button the visitor tapped second silently did nothing.
 * Now the event is captured once, here, and both components read it from here:
 * a tap on either one uses the event up for both.
 */

import { useSyncExternalStore } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface InstallPromptState {
  /** The saved browser event, or null when none is on offer. */
  deferredPrompt: BeforeInstallPromptEvent | null;
  /** True once the browser reports the app was installed. */
  installed: boolean;
}

const INITIAL_STATE: InstallPromptState = {
  deferredPrompt: null,
  installed: false,
};

let state: InstallPromptState = INITIAL_STATE;
const listeners = new Set<() => void>();
let attached = false;

function setState(next: InstallPromptState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function handleBeforeInstallPrompt(e: Event) {
  e.preventDefault();
  setState({ ...state, deferredPrompt: e as BeforeInstallPromptEvent });
}

function handleAppInstalled() {
  setState({ deferredPrompt: null, installed: true });
}

/** Attach the two window listeners, once for the whole page. */
function ensureListening() {
  if (attached || typeof window === 'undefined') return;
  attached = true;
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
}

// Listen from the moment this module loads, so an event the browser fires
// before a component has mounted is not lost.
ensureListening();

export function subscribeInstallPrompt(listener: () => void): () => void {
  ensureListening();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getInstallPromptState(): InstallPromptState {
  return state;
}

/**
 * Show the browser's install prompt. The saved event is cleared first, so a
 * second caller cannot call prompt() on it again. Returns the visitor's choice,
 * or null when no prompt was on offer.
 */
export async function promptInstall(): Promise<
  'accepted' | 'dismissed' | null
> {
  const { deferredPrompt } = state;
  if (!deferredPrompt) return null;
  setState({ ...state, deferredPrompt: null });
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  return outcome;
}

/** React hook: the shared install-prompt state. */
export function useInstallPrompt(): InstallPromptState {
  return useSyncExternalStore(
    subscribeInstallPrompt,
    getInstallPromptState,
    () => INITIAL_STATE
  );
}

/** Test helper: forget any saved event and installed flag. */
export function resetInstallPromptForTests() {
  setState(INITIAL_STATE);
}
