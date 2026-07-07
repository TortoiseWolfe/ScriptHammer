# Avatar Test Fixtures

This directory contains test images for avatar upload E2E tests.

## Test Files

- `valid-small.jpg` - 200x200px JPEG (~10KB) - Minimum valid dimensions
- `valid-medium.png` - 1024x1024px PNG (~500KB) - Typical upload size
- `invalid-toolarge.jpg` - Mock file >5MB - Tests size limit rejection
- `invalid-corrupted.jpg` - Corrupted file - Tests decode validation

## Usage

These fixtures are used in:

- E2E tests (`e2e/avatar/upload.spec.ts`)
- Integration tests (`tests/integration/avatar/upload.integration.test.ts`)
- Manual testing via quickstart.md

## Creating Real Test Images

To add actual image files for manual testing:

```bash
# From project root
# Download or create test images and place them in this directory
```

For automated tests, we use data URLs and Blob objects instead of files.
