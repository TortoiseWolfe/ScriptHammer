/**
 * Unit tests for image processing
 * Feature 022: User Avatar Upload
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCroppedImage,
  compressImage,
  fileToDataURL,
} from '../image-processing';
import type { CroppedAreaPixels } from '../types';

describe('createCroppedImage', () => {
  let canvas: HTMLCanvasElement;
  let imageSrc: string;

  beforeEach(async () => {
    // Create a test image
    canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1000;

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'blue';
    ctx.fillRect(0, 0, 1000, 1000);

    // Draw a red square in the center for cropping
    ctx.fillStyle = 'red';
    ctx.fillRect(400, 400, 200, 200);

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png');
    });

    imageSrc = URL.createObjectURL(blob);
  });

  it('should create cropped image with correct dimensions', async () => {
    const croppedArea: CroppedAreaPixels = {
      x: 400,
      y: 400,
      width: 200,
      height: 200,
    };

    const croppedBlob = await createCroppedImage(imageSrc, croppedArea);

    expect(croppedBlob).toBeInstanceOf(Blob);
    expect(croppedBlob.type).toBe('image/webp');

    // Verify dimensions by loading the blob
    const img = await createImageBitmap(croppedBlob);
    expect(img.width).toBe(800);
    expect(img.height).toBe(800);
  });

  it('should convert to WebP format', async () => {
    const croppedArea: CroppedAreaPixels = {
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
    };

    const croppedBlob = await createCroppedImage(imageSrc, croppedArea);

    expect(croppedBlob.type).toBe('image/webp');
  });

  it('should handle edge crop areas', async () => {
    // Crop from top-left corner
    const croppedArea: CroppedAreaPixels = {
      x: 0,
      y: 0,
      width: 500,
      height: 500,
    };

    const croppedBlob = await createCroppedImage(imageSrc, croppedArea);

    expect(croppedBlob).toBeInstanceOf(Blob);
    expect(croppedBlob.size).toBeGreaterThan(0);
  });
});

describe('compressImage', () => {
  it('should compress image to 800x800px', async () => {
    // Create a test image
    const canvas = document.createElement('canvas');
    canvas.width = 2000;
    canvas.height = 2000;

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'green';
    ctx.fillRect(0, 0, 2000, 2000);

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png');
    });

    const compressedBlob = await compressImage(blob);

    // Verify dimensions
    const img = await createImageBitmap(compressedBlob);
    expect(img.width).toBe(800);
    expect(img.height).toBe(800);
  });

  it('should convert to WebP format', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1000;

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/jpeg');
    });

    const compressedBlob = await compressImage(blob);

    expect(compressedBlob.type).toBe('image/webp');
  });

  it('should reduce file size', async () => {
    // Create a large PNG
    const canvas = document.createElement('canvas');
    canvas.width = 2000;
    canvas.height = 2000;

    const ctx = canvas.getContext('2d')!;
    // Fill with random colors to prevent over-compression
    for (let y = 0; y < 2000; y += 10) {
      for (let x = 0; x < 2000; x += 10) {
        ctx.fillStyle = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`;
        ctx.fillRect(x, y, 10, 10);
      }
    }

    const originalBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png');
    });

    const compressedBlob = await compressImage(originalBlob);

    // WebP at 85% quality should be smaller than PNG
    expect(compressedBlob.size).toBeLessThan(originalBlob.size);
  });
});

describe('fileToDataURL', () => {
  it('should convert File to data URL', async () => {
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });

    const dataURL = await fileToDataURL(file);

    expect(dataURL).toMatch(/^data:text\/plain;base64,/);
  });

  it('should convert image File to data URL', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png');
    });

    const file = new File([blob], 'image.png', { type: 'image/png' });

    const dataURL = await fileToDataURL(file);

    expect(dataURL).toMatch(/^data:image\/png;base64,/);
  });

  it('should handle empty files', async () => {
    const file = new File([], 'empty.txt', { type: 'text/plain' });

    const dataURL = await fileToDataURL(file);

    expect(dataURL).toMatch(/^data:text\/plain;base64,/);
  });
});
