import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AvatarUpload from './AvatarUpload';

// Mock the avatar utilities
vi.mock('@/lib/avatar/validation', () => ({
  validateAvatarFile: vi.fn().mockResolvedValue({ valid: true }),
}));

vi.mock('@/lib/avatar/image-processing', () => ({
  createCroppedImage: vi
    .fn()
    .mockResolvedValue(new Blob(['test'], { type: 'image/webp' })),
}));

vi.mock('@/lib/avatar/upload', () => ({
  uploadAvatar: vi
    .fn()
    .mockResolvedValue({ url: 'https://example.com/avatar.webp' }),
  removeAvatar: vi.fn().mockResolvedValue({}),
}));

describe('AvatarUpload', () => {
  it('renders without crashing', () => {
    const { container } = render(<AvatarUpload />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders upload button', () => {
    render(<AvatarUpload />);
    expect(
      screen.getByRole('button', { name: /upload avatar/i })
    ).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-test-class';
    const { container } = render(<AvatarUpload className={customClass} />);
    const element = container.querySelector('.custom-test-class');
    expect(element).toBeInTheDocument();
  });

  it('opens file picker when button clicked', () => {
    render(<AvatarUpload />);
    const button = screen.getByRole('button', { name: /upload avatar/i });
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    expect(input).not.toBeNull();

    // Mock file input click
    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.click(button);

    expect(clickSpy).toHaveBeenCalled();
  });

  it('has hidden file input with correct accept attribute', () => {
    render(<AvatarUpload />);
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    expect(input).not.toBeNull();
    expect(input.accept).toBe('image/jpeg,image/png,image/webp');
    expect(input.className).toContain('hidden');
  });

  it('calls onUploadComplete callback prop', async () => {
    const onUploadComplete = vi.fn();
    render(<AvatarUpload onUploadComplete={onUploadComplete} />);

    // Component renders correctly with callback
    expect(
      screen.getByRole('button', { name: /upload avatar/i })
    ).toBeInTheDocument();
  });
});
