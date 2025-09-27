#!/usr/bin/env node

/**
 * Generate author configuration from environment variables
 * This script runs at build time to create a static config file
 * that can be imported in the static build
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env file if it exists
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Load .env.local if it exists (takes precedence)
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}

// Check if author-generated.ts already exists and has real content
const outputPath = path.join(
  process.cwd(),
  'src',
  'config',
  'author-generated.ts'
);

// If the file already exists and doesn't have default values, skip generation
if (fs.existsSync(outputPath)) {
  const existingContent = fs.readFileSync(outputPath, 'utf8');
  if (
    !existingContent.includes('"Your Name"') &&
    !existingContent.includes('default.jpg')
  ) {
    console.log(
      '✅ Author configuration already exists with real data, skipping generation'
    );
    process.exit(0);
  }
}

// Generate the author configuration
const authorConfig = {
  name: process.env.NEXT_PUBLIC_AUTHOR_NAME || 'Your Name',
  github: process.env.NEXT_PUBLIC_AUTHOR_GITHUB || '',
  role: process.env.NEXT_PUBLIC_AUTHOR_ROLE || 'Developer',
  bio:
    process.env.NEXT_PUBLIC_AUTHOR_BIO || 'Building modern web applications.',
  avatar:
    process.env.NEXT_PUBLIC_AUTHOR_AVATAR || '/images/authors/default.jpg',
  social: {
    github: process.env.NEXT_PUBLIC_AUTHOR_GITHUB
      ? `https://github.com/${process.env.NEXT_PUBLIC_AUTHOR_GITHUB}`
      : '',
    twitter: process.env.NEXT_PUBLIC_AUTHOR_TWITTER
      ? `https://twitter.com/${process.env.NEXT_PUBLIC_AUTHOR_TWITTER}`
      : '',
    linkedin: process.env.NEXT_PUBLIC_AUTHOR_LINKEDIN
      ? `https://linkedin.com/in/${process.env.NEXT_PUBLIC_AUTHOR_LINKEDIN}`
      : '',
    twitch: process.env.NEXT_PUBLIC_AUTHOR_TWITCH
      ? `https://twitch.tv/${process.env.NEXT_PUBLIC_AUTHOR_TWITCH}`
      : '',
    website: process.env.NEXT_PUBLIC_AUTHOR_WEBSITE || '',
    email: process.env.NEXT_PUBLIC_AUTHOR_EMAIL || '',
  },
  disqus: {
    shortname: process.env.NEXT_PUBLIC_DISQUS_SHORTNAME || '',
  },
};

// Generate TypeScript file content
const fileContent = `/**
 * Auto-generated author configuration
 * Generated from .env file at build time
 * DO NOT EDIT MANUALLY - Edit .env instead
 */

export const authorConfig = ${JSON.stringify(authorConfig, null, 2)} as const;

export type AuthorConfig = typeof authorConfig;
`;

// Write to file (outputPath already defined at the top)
fs.writeFileSync(outputPath, fileContent);

console.log('✅ Author configuration generated from .env');
console.log(`   Name: ${authorConfig.name}`);
console.log(`   Role: ${authorConfig.role}`);
console.log(`   Output: ${outputPath}`);
