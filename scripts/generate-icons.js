#!/usr/bin/env node

/**
 * Simple icon generator that creates placeholder PNG icons
 * Since we don't have image processing libraries, we'll create data URLs
 */

const fs = require('fs');
const path = require('path');

// Create a simple canvas-like PNG using a data URL approach
function createPlaceholderIcon(size) {
  // Create a simple SVG that can be used as a placeholder
  const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#1e40af"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.3}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">CK</text>
</svg>`;

  return svg.trim();
}

// Generate icons
const sizes = [192, 512];
const publicDir = path.join(__dirname, '..', 'public');

sizes.forEach((size) => {
  const svgContent = createPlaceholderIcon(size);
  const filename = `icon-${size}x${size}.svg`;
  const filepath = path.join(publicDir, filename);

  fs.writeFileSync(filepath, svgContent);
  console.log(`✓ Generated ${filename}`);
});

// Create maskable icon (with safe zone padding)
const maskableSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#1e40af"/>
  <circle cx="256" cy="256" r="192" fill="#60a5fa"/>
  <text x="256" y="256" font-family="Arial, sans-serif" font-size="120" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">CK</text>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon-maskable.svg'), maskableSvg.trim());
console.log('✓ Generated icon-maskable.svg');

// Create Apple touch icon
const appleTouchSvg = `
<svg width="180" height="180" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
  <rect width="180" height="180" fill="#1e40af" rx="36"/>
  <text x="90" y="90" font-family="Arial, sans-serif" font-size="60" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">CK</text>
</svg>`;

fs.writeFileSync(
  path.join(publicDir, 'apple-touch-icon.svg'),
  appleTouchSvg.trim()
);
console.log('✓ Generated apple-touch-icon.svg');

console.log('\nAll icons generated successfully!');
console.log(
  'Note: These are SVG icons. For true PNG support, install sharp or use an external service.'
);
