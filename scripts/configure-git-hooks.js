#!/usr/bin/env node

/**
 * Configure versioned hooks for this checkout and every linked worktree.
 *
 * Husky 9 writes ignored shims under .husky/_, then points core.hooksPath at
 * that generated directory. A linked worktree does not have those shims, so
 * Git silently runs no hooks there. The real hooks are already tracked in
 * .husky; point Git directly at that directory instead.
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_HOOKS = ['pre-commit', 'pre-push'];

function runGit(args, options = {}) {
  return spawnSync('git', args, {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
  });
}

function fail(message) {
  console.error('ERROR: ' + message);
  process.exit(1);
}

const rootResult = runGit(['rev-parse', '--show-toplevel']);

// Package managers run lifecycle scripts outside a checkout when packing or
// installing dependencies. There is nothing to configure in that case. An
// unresolved .git pointer is different: that means a worktree was mounted
// without its parent repository, and continuing would leave hooks unchecked.
if (rootResult.status !== 0) {
  if (fs.existsSync(path.join(process.cwd(), '.git'))) {
    fail(
      'Git metadata is present but cannot be resolved. Mount the parent repository at the path recorded by .git.'
    );
  }
  process.exit(0);
}

const repositoryRoot = rootResult.stdout.trim();

for (const hook of REQUIRED_HOOKS) {
  const hookPath = path.join(repositoryRoot, '.husky', hook);
  if (!fs.existsSync(hookPath)) {
    fail('Required Git hook is missing: ' + hookPath);
  }
  if ((fs.statSync(hookPath).mode & 0o111) === 0) {
    fail('Required Git hook is not executable: ' + hookPath);
  }
}

const configureResult = runGit(
  ['config', '--local', 'core.hooksPath', '.husky'],
  { cwd: repositoryRoot }
);
if (configureResult.status !== 0) {
  fail(configureResult.stderr.trim() || 'Could not configure core.hooksPath.');
}

const hooksPathResult = runGit(
  ['config', '--local', '--get', 'core.hooksPath'],
  { cwd: repositoryRoot }
);
if (
  hooksPathResult.status !== 0 ||
  hooksPathResult.stdout.trim() !== '.husky'
) {
  fail('core.hooksPath was not configured to the tracked .husky directory.');
}

console.log('Configured versioned Git hooks from .husky.');
