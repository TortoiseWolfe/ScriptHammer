import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import IntakeUploader from './IntakeUploader';
import type { IntakeAttachment } from '@/types/commerce';

// Only the two functions that reach the network are mocked. The validators stay
// REAL — they are the behaviour under test, and mocking them would leave this
// asserting that mocks return what they were told to.
vi.mock('@/lib/commerce/intake-upload', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/commerce/intake-upload')
  >('@/lib/commerce/intake-upload');
  return {
    ...actual,
    uploadIntakeFile: vi.fn(),
    removeIntakeFile: vi.fn().mockResolvedValue({}),
  };
});

import {
  uploadIntakeFile,
  removeIntakeFile,
  MAX_FILES,
} from '@/lib/commerce/intake-upload';

const attachment = (
  over: Partial<IntakeAttachment> = {}
): IntakeAttachment => ({
  path: 'uid/abc.png',
  name: 'roof.png',
  bytes: 2048,
  mime: 'image/png',
  kind: 'unspecified',
  ...over,
});

const makeFile = (name: string, size: number, type: string): File => {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

const drop = (files: File[]) => {
  const zone = screen.getByTestId('intake-dropzone');
  fireEvent.drop(zone, { dataTransfer: { files } });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('IntakeUploader', () => {
  it('renders the dropzone with the accepted formats and the cap', () => {
    render(<IntakeUploader value={[]} onChange={() => {}} />);
    expect(screen.getByTestId('intake-dropzone')).toBeInTheDocument();
    expect(screen.getByText(/HEIC or PDF/)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`max ${MAX_FILES}`))
    ).toBeInTheDocument();
  });

  it('is reachable and activatable by keyboard', () => {
    render(<IntakeUploader value={[]} onChange={() => {}} />);
    const zone = screen.getByTestId('intake-dropzone');
    expect(zone).toHaveAttribute('tabindex', '0');
    // Both Enter and Space, because a keyboard user will try either.
    fireEvent.keyDown(zone, { key: 'Enter' });
    fireEvent.keyDown(zone, { key: ' ' });
    expect(zone).toHaveAttribute('role', 'button');
  });

  it('refuses a file over 10 MB and names it', async () => {
    render(<IntakeUploader value={[]} onChange={() => {}} />);
    drop([makeFile('huge.png', 11 * 1024 * 1024, 'image/png')]);
    expect(await screen.findByRole('alert')).toHaveTextContent(/huge\.png/);
    expect(screen.getByRole('alert')).toHaveTextContent(/10 MB limit/);
    expect(uploadIntakeFile).not.toHaveBeenCalled();
  });

  it('refuses a disallowed type', async () => {
    render(<IntakeUploader value={[]} onChange={() => {}} />);
    drop([makeFile('evil.svg', 100, 'image/svg+xml')]);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /type not allowed/
    );
    expect(uploadIntakeFile).not.toHaveBeenCalled();
  });

  it('refuses files past the cap, counting what is already attached', async () => {
    const existing = Array.from({ length: MAX_FILES }, (_, i) =>
      attachment({ path: `uid/${i}.png` })
    );
    render(<IntakeUploader value={existing} onChange={() => {}} />);
    drop([makeFile('one-too-many.png', 100, 'image/png')]);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      `${MAX_FILES}-file limit`
    );
    expect(uploadIntakeFile).not.toHaveBeenCalled();
  });

  it('says the limit is also enforced server-side', async () => {
    render(<IntakeUploader value={[]} onChange={() => {}} />);
    drop([makeFile('evil.svg', 100, 'image/svg+xml')]);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /courtesy, not the control/
    );
  });

  it('uploads an accepted file and reports the attachment upward', async () => {
    const onChange = vi.fn();
    vi.mocked(uploadIntakeFile).mockResolvedValue({
      attachment: attachment({ path: 'uid/new.png' }),
    });
    render(<IntakeUploader value={[]} onChange={onChange} />);
    drop([makeFile('roof.png', 2048, 'image/png')]);
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        expect.objectContaining({ path: 'uid/new.png' }),
      ])
    );
  });

  it('surfaces an upload failure instead of silently dropping the file', async () => {
    vi.mocked(uploadIntakeFile).mockResolvedValue({ error: 'Network problem' });
    render(<IntakeUploader value={[]} onChange={() => {}} />);
    drop([makeFile('roof.png', 2048, 'image/png')]);
    expect(await screen.findByText('Network problem')).toBeInTheDocument();
  });

  describe('have / want tagging (FR-014)', () => {
    it('sets the tag and exposes it as aria-pressed', () => {
      const onChange = vi.fn();
      render(<IntakeUploader value={[attachment()]} onChange={onChange} />);
      fireEvent.click(screen.getByRole('button', { name: 'What I have' }));
      expect(onChange).toHaveBeenCalledWith([
        expect.objectContaining({ kind: 'current' }),
      ]);
    });

    it('clears the tag when the same chip is pressed again', () => {
      const onChange = vi.fn();
      render(
        <IntakeUploader
          value={[attachment({ kind: 'current' })]}
          onChange={onChange}
        />
      );
      const chip = screen.getByRole('button', { name: 'What I have' });
      expect(chip).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(chip);
      expect(onChange).toHaveBeenCalledWith([
        expect.objectContaining({ kind: 'unspecified' }),
      ]);
    });

    // The comp sets min-height:0 on these chips. This repo gates on 44px, so the
    // comp loses — asserted here so a future "match the comp" pass cannot quietly
    // undo it.
    it('keeps the chips at the 44px touch target', () => {
      render(<IntakeUploader value={[attachment()]} onChange={() => {}} />);
      for (const name of ['What I have', 'What I want']) {
        expect(screen.getByRole('button', { name })).toHaveClass('min-h-11');
      }
    });
  });

  it('removes an attachment and tells storage', async () => {
    const onChange = vi.fn();
    const a = attachment();
    render(<IntakeUploader value={[a]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: `Remove ${a.name}` }));
    expect(onChange).toHaveBeenCalledWith([]);
    await waitFor(() => expect(removeIntakeFile).toHaveBeenCalledWith(a.path));
  });

  // FR-018: accepted, but never rendered as a broken <img>.
  it('shows a generic chip for formats it cannot preview', () => {
    render(
      <IntakeUploader
        value={[
          attachment({
            path: 'uid/a.heic',
            name: 'a.heic',
            mime: 'image/heic',
          }),
          attachment({
            path: 'uid/b.pdf',
            name: 'b.pdf',
            mime: 'application/pdf',
          }),
        ]}
        onChange={() => {}}
      />
    );
    expect(screen.getByText('FILE')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  // Reported from production: the bucket did not exist, every row read "Bucket
  // not found", and underneath them the page still said "Tag each one". Telling
  // someone to do something they cannot see how to do is worse than saying
  // nothing — they assume the fault is theirs.
  describe('the tagging hint', () => {
    it('is absent when there is nothing to tag', () => {
      render(<IntakeUploader value={[]} onChange={() => {}} />);
      expect(screen.queryByText(/What I have/)).toBeNull();
      expect(screen.queryByText(/saves a round of emails/)).toBeNull();
    });

    it('is absent when every upload failed', async () => {
      vi.mocked(uploadIntakeFile).mockResolvedValue({
        error: 'Bucket not found',
      });
      render(<IntakeUploader value={[]} onChange={() => {}} />);
      drop([makeFile('roof.png', 2048, 'image/png')]);
      expect(await screen.findByText('Bucket not found')).toBeInTheDocument();
      expect(screen.queryByText(/saves a round of emails/)).toBeNull();
    });

    it('appears once a file is stored, and names the controls', () => {
      render(<IntakeUploader value={[attachment()]} onChange={() => {}} />);
      expect(screen.getByText(/saves a round of emails/)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'What I have' })
      ).toBeInTheDocument();
    });
  });

  it('stops accepting input once full', () => {
    const existing = Array.from({ length: MAX_FILES }, (_, i) =>
      attachment({ path: `uid/${i}.png` })
    );
    render(<IntakeUploader value={existing} onChange={() => {}} />);
    const zone = screen.getByTestId('intake-dropzone');
    expect(zone).toHaveAttribute('aria-disabled', 'true');
    expect(zone).toHaveAttribute('tabindex', '-1');
    expect(screen.getByText(/the limit/)).toBeInTheDocument();
  });

  it('disables every control when disabled', () => {
    render(
      <IntakeUploader value={[attachment()]} onChange={() => {}} disabled />
    );
    expect(screen.getByTestId('intake-dropzone')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.getByRole('button', { name: 'What I have' })).toBeDisabled();
  });
});
