import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  useInstallPrompt,
  promptInstall,
  resetInstallPromptForTests,
} from './install-prompt';

type FakePrompt = Event & {
  prompt: ReturnType<typeof vi.fn>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/** Fire the browser's install prompt, as Chrome does once per page. */
const fireBrowserPrompt = async (): Promise<FakePrompt> => {
  const event = new Event('beforeinstallprompt', {
    cancelable: true,
  }) as FakePrompt;
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: 'accepted' as const });
  await act(async () => {
    window.dispatchEvent(event);
  });
  return event;
};

/** Two buttons, like GlobalNav and PWAInstall, reading one shared prompt. */
function TwoInstallButtons() {
  const { deferredPrompt } = useInstallPrompt();
  return (
    <>
      {['nav', 'pill'].map((name) => (
        <button
          key={name}
          disabled={!deferredPrompt}
          onClick={() => void promptInstall()}
        >
          {name}
        </button>
      ))}
    </>
  );
}

beforeEach(() => {
  resetInstallPromptForTests();
});

describe('install prompt store (#1262)', () => {
  it('keeps the browser prompt and stops the browser showing its own bar', async () => {
    render(<TwoInstallButtons />);
    const event = await fireBrowserPrompt();
    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByRole('button', { name: 'nav' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'pill' })).toBeEnabled();
  });

  it('keeps a prompt the browser fired before any component mounted', async () => {
    await fireBrowserPrompt();
    render(<TwoInstallButtons />);
    expect(screen.getByRole('button', { name: 'nav' })).toBeEnabled();
  });

  it('calls prompt() once, and a tap on one button turns off the other', async () => {
    const user = userEvent.setup();
    render(<TwoInstallButtons />);
    const event = await fireBrowserPrompt();

    await user.click(screen.getByRole('button', { name: 'nav' }));

    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'pill' })).toBeDisabled();
    // Nothing left to prompt: a second caller gets no outcome and no second call.
    expect(await promptInstall()).toBeNull();
    expect(event.prompt).toHaveBeenCalledTimes(1);
  });

  it('returns what the visitor chose', async () => {
    const event = await fireBrowserPrompt();
    event.userChoice = Promise.resolve({ outcome: 'dismissed' as const });
    expect(await promptInstall()).toBe('dismissed');
  });

  it('drops the prompt and records the install when the app is installed', async () => {
    let installed = false;
    function Probe() {
      installed = useInstallPrompt().installed;
      return null;
    }
    render(
      <>
        <TwoInstallButtons />
        <Probe />
      </>
    );
    await fireBrowserPrompt();
    await act(async () => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(installed).toBe(true);
    expect(screen.getByRole('button', { name: 'nav' })).toBeDisabled();
  });
});
