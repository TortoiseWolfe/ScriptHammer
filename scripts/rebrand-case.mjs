#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const KEEP_MARKER = 'rebrand:keep';

const asciiLower = (value) =>
  value.replace(/[A-Z]/g, (character) => character.toLowerCase());

const asciiUpper = (value) =>
  value.replace(/[a-z]/g, (character) => character.toUpperCase());

const regexEscape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const asciiCasePattern = (value) =>
  [...value]
    .map((character) => {
      if (/[A-Za-z]/.test(character)) {
        const lower = asciiLower(character);
        return `[${lower}${asciiUpper(lower)}]`;
      }
      return regexEscape(character);
    })
    .join('');

const uniqueAsciiCaseInsensitive = (values) => {
  const seen = new Set();
  return values
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .filter((value) => {
      const folded = asciiLower(value);
      if (seen.has(folded)) return false;
      seen.add(folded);
      return true;
    });
};

export function createIdentity({
  sourceDisplay,
  sourceSlug,
  sourceComponent,
  sourceUpper,
  targetDisplay,
  targetSlug,
  targetComponent,
}) {
  const sources = uniqueAsciiCaseInsensitive([
    sourceDisplay,
    sourceSlug,
    sourceComponent,
    sourceUpper,
  ]);
  if (sources.length === 0)
    throw new Error('at least one source identity is required');

  return {
    sources,
    sourceDisplay,
    sourceSlug,
    sourceComponent,
    sourceUpper,
    targetDisplay,
    targetSlug,
    targetComponent,
    // Uppercase source tokens include real identifiers such as
    // SCRIPTHAMMER_TEST_DOMAIN. COMPONENT_NAME is separator-free, so its uppercase // rebrand:keep
    // projection remains a valid identifier even for a display name with spaces.
    targetUpper: asciiUpper(targetComponent),
  };
}

const identityPattern = (identity, global = true) =>
  new RegExp(
    `(?:${identity.sources.map(asciiCasePattern).join('|')})`,
    global ? 'g' : ''
  );

// Deliberately independent from the substitution regex. The postcondition is a
// second implementation of ASCII-folded fixed-string search, so a regression
// in identityPattern/asciiCasePattern cannot make replacement and verification
// miss the same spelling together.
const containsSourceIdentity = (value, identity) => {
  const folded = asciiLower(value);
  return identity.sources.some((source) => folded.includes(asciiLower(source)));
};

const caseStyle = (value) => {
  const letters = value.replace(/[^A-Za-z]/g, '');
  if (letters && letters === asciiLower(letters)) return 'lower';
  if (letters && letters === asciiUpper(letters)) return 'upper';
  if (
    letters &&
    letters[0] === asciiUpper(letters[0]) &&
    letters.slice(1) === asciiLower(letters.slice(1))
  ) {
    return 'title';
  }
  return 'mixed';
};

const titleProjection = (value) => {
  const lower = asciiLower(value);
  return lower.replace(/[A-Za-z]/, (character) => asciiUpper(character));
};

const identifierCharacter = (character) => /[A-Za-z0-9_]/.test(character ?? '');

const hasPathSeparator = (token) => {
  if (token.includes('/')) return true;
  // JSON strings encode newlines, quotes, and other control characters with a
  // backslash. Treating every such escape as a Windows path made the generated
  // blog index choose component casing while its Markdown source chose display
  // casing. Remove JSON/JavaScript escapes before looking for a real backslash
  // separator; `C:\\Brand\\file` still retains both path separators.
  const withoutEscapes = token
    .replace(/\\(?:["'\\/bfnrtv0]|u[0-9A-Fa-f]{4})/g, '')
    // Token scanning stops at the quote in JSON's \"...\" encoding, leaving
    // the escape introducer at one edge. It is not a path separator.
    .replace(/^\\+|\\+$/g, '');
  return withoutEscapes.includes('\\');
};

export function replacementForMatch(
  match,
  identity,
  { identifierAdjacent = false, pathSegment = false } = {}
) {
  // On a re-rebrand, the exact stored projection is stronger evidence than
  // its generic letter shape. `Geolarp` can be both display and component; the // rebrand:keep
  // surrounding identifier/path context distinguishes those two uses. A
  // separator-bearing component is distinct and always remains a component.
  if (match === identity.sourceDisplay) {
    return pathSegment || identifierAdjacent
      ? identity.targetComponent
      : identity.targetDisplay;
  }
  if (match === identity.sourceComponent && match !== identity.sourceDisplay) {
    return identity.targetComponent;
  }
  if (match === identity.sourceSlug && match !== identity.sourceDisplay) {
    return identifierAdjacent
      ? asciiLower(identity.targetComponent)
      : identity.targetSlug;
  }
  if (match === identity.sourceUpper && match !== identity.sourceDisplay) {
    return identity.targetUpper;
  }

  switch (caseStyle(match)) {
    case 'lower':
      return pathSegment || !identifierAdjacent
        ? identity.targetSlug
        : asciiLower(identity.targetComponent);
    case 'upper':
      return identity.targetUpper;
    case 'title':
      return titleProjection(
        pathSegment || identifierAdjacent
          ? identity.targetComponent
          : identity.targetDisplay
      );
    default:
      return pathSegment || identifierAdjacent
        ? identity.targetComponent
        : identity.targetDisplay;
  }
}

const replaceLine = (line, identity) => {
  if (line.includes(KEEP_MARKER)) return line;
  const pattern = identityPattern(identity);
  return line.replace(pattern, (match, offset, wholeLine) => {
    const before = wholeLine[offset - 1];
    const after = wholeLine[offset + match.length];
    const beforeIsEscapeCode =
      wholeLine[offset - 2] === '\\' && /["'\\/bfnrtv0]/.test(before ?? '');
    let tokenStart = offset;
    let tokenEnd = offset + match.length;
    while (
      tokenStart > 0 &&
      /[A-Za-z0-9_./\\-]/.test(wholeLine[tokenStart - 1])
    ) {
      tokenStart -= 1;
    }
    while (
      tokenEnd < wholeLine.length &&
      /[A-Za-z0-9_./\\-]/.test(wholeLine[tokenEnd])
    ) {
      tokenEnd += 1;
    }
    const token = wholeLine.slice(tokenStart, tokenEnd);
    return replacementForMatch(match, identity, {
      identifierAdjacent:
        (!beforeIsEscapeCode && identifierCharacter(before)) ||
        identifierCharacter(after),
      pathSegment:
        hasPathSeparator(token) || /\.[A-Za-z0-9]{1,10}$/.test(token),
    });
  });
};

export function replaceBrandText(text, identity) {
  const pieces = text.split(/(\r\n|\n|\r)/);
  for (let index = 0; index < pieces.length; index += 2) {
    pieces[index] = replaceLine(pieces[index], identity);
  }
  return pieces.join('');
}

export function mapBrandPath(relativePath, identity) {
  return relativePath
    .split('/')
    .map((segment) =>
      segment.replace(identityPattern(identity), (match) =>
        replacementForMatch(match, identity, { pathSegment: true })
      )
    )
    .join('/');
}

export function findBrandSurvivors(text, identity) {
  const survivors = [];
  const lines = text.split(/\r\n|\n|\r/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.includes(KEEP_MARKER)) continue;
    if (containsSourceIdentity(line, identity)) {
      survivors.push({ line: index + 1, text: line });
    }
  }
  return survivors;
}

const readNulPaths = () =>
  fs.readFileSync(0).toString('utf8').split('\0').filter(Boolean);

const relativeFromRoot = (root, absolutePath) => {
  const relative = path.relative(root, absolutePath);
  if (
    relative === '' ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`tracked path escapes repository root: ${absolutePath}`);
  }
  return relative.split(path.sep).join('/');
};

const pathExists = (target) => {
  try {
    fs.lstatSync(target);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
};

export function planPathRenames(root, absolutePaths, identity) {
  const entries = absolutePaths.map((oldAbsolute) => {
    const metadata = fs.lstatSync(oldAbsolute);
    if (metadata.isSymbolicLink()) {
      const target = fs.readlinkSync(oldAbsolute);
      if (containsSourceIdentity(target, identity)) {
        throw new Error(
          `tracked symlink target contains the current brand: ${relativeFromRoot(root, oldAbsolute)} → ${target}`
        );
      }
    }
    const oldRelative = relativeFromRoot(root, oldAbsolute);
    const newRelative = mapBrandPath(oldRelative, identity);
    return {
      oldAbsolute,
      oldRelative,
      newAbsolute: path.join(root, ...newRelative.split('/')),
      newRelative,
      changed: oldRelative !== newRelative,
    };
  });

  const targetKeys = new Map();
  for (const entry of entries) {
    const key = asciiLower(entry.newRelative);
    const prior = targetKeys.get(key);
    if (prior && (prior.changed || entry.changed)) {
      throw new Error(
        `rebrand path collision: ${prior.oldRelative} and ${entry.oldRelative} both map to ${entry.newRelative}`
      );
    }
    targetKeys.set(key, entry);
  }

  const sourceKeys = new Set(
    entries.map((entry) => asciiLower(entry.oldAbsolute))
  );
  for (const entry of entries.filter(({ changed }) => changed)) {
    if (
      pathExists(entry.newAbsolute) &&
      !sourceKeys.has(asciiLower(entry.newAbsolute))
    ) {
      throw new Error(
        `rebrand target already exists: ${entry.newRelative} (from ${entry.oldRelative})`
      );
    }

    let parent = path.dirname(entry.newAbsolute);
    while (parent !== root && parent.startsWith(`${root}${path.sep}`)) {
      if (pathExists(parent) && !fs.lstatSync(parent).isDirectory()) {
        throw new Error(
          `rebrand target parent is not a directory: ${path.relative(root, parent)}`
        );
      }
      parent = path.dirname(parent);
    }
  }

  // A file-by-file collision check is not enough. Moving
  // assets/scripthammer-intro/a.png into an already-existing // rebrand:keep
  // assets/geolarp-intro/ directory would silently merge two directory trees // rebrand:keep
  // even when their filenames differ. Model every source directory once and
  // reject both case-folding collisions and pre-existing destination trees.
  const directoryEntries = new Map();
  for (const entry of entries) {
    let oldDirectory = path.dirname(entry.oldRelative);
    while (oldDirectory !== '.') {
      if (!directoryEntries.has(oldDirectory)) {
        const newDirectory = mapBrandPath(oldDirectory, identity);
        directoryEntries.set(oldDirectory, {
          oldRelative: oldDirectory,
          newRelative: newDirectory,
          oldAbsolute: path.join(root, ...oldDirectory.split('/')),
          newAbsolute: path.join(root, ...newDirectory.split('/')),
          changed: oldDirectory !== newDirectory,
        });
      }
      oldDirectory = path.posix.dirname(oldDirectory);
    }
  }

  const directoryTargets = new Map();
  for (const directory of directoryEntries.values()) {
    const key = asciiLower(directory.newRelative);
    const prior = directoryTargets.get(key);
    if (
      prior &&
      prior.oldRelative !== directory.oldRelative &&
      (prior.changed || directory.changed)
    ) {
      throw new Error(
        `rebrand directory collision: ${prior.oldRelative} and ${directory.oldRelative} both map to ${directory.newRelative}`
      );
    }
    directoryTargets.set(key, directory);
  }

  for (const [key, directory] of directoryTargets) {
    const file = targetKeys.get(key);
    if (file) {
      throw new Error(
        `rebrand file/directory collision: ${file.oldRelative} maps to the directory target ${directory.newRelative}`
      );
    }
  }

  const sourceDirectoryKeys = new Set(
    [...directoryEntries.values()].map((directory) =>
      asciiLower(directory.oldAbsolute)
    )
  );
  for (const directory of [...directoryEntries.values()].filter(
    ({ changed }) => changed
  )) {
    if (
      pathExists(directory.newAbsolute) &&
      !sourceDirectoryKeys.has(asciiLower(directory.newAbsolute))
    ) {
      throw new Error(
        `rebrand target directory already exists: ${directory.newRelative} (from ${directory.oldRelative})`
      );
    }
  }

  return entries;
}

const removeEmptySourceDirectories = (root, entries) => {
  const directories = new Set();
  for (const entry of entries) {
    let current = path.dirname(entry.oldAbsolute);
    while (current !== root && current.startsWith(`${root}${path.sep}`)) {
      directories.add(current);
      current = path.dirname(current);
    }
  }
  for (const directory of [...directories].sort(
    (a, b) => b.length - a.length
  )) {
    try {
      fs.rmdirSync(directory);
    } catch (error) {
      if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code)) throw error;
    }
  }
};

export function applyPathRenames(root, entries) {
  const changed = entries.filter(({ changed: didChange }) => didChange);
  if (changed.length === 0) return;

  const staging = fs.mkdtempSync(path.join(root, '.rebrand-paths-'));
  const staged = [];
  try {
    for (let index = 0; index < changed.length; index += 1) {
      const entry = changed[index];
      const temporary = path.join(staging, String(index));
      fs.renameSync(entry.oldAbsolute, temporary);
      staged.push({ entry, temporary, placed: false });
    }

    for (const item of staged) {
      fs.mkdirSync(path.dirname(item.entry.newAbsolute), { recursive: true });
      fs.renameSync(item.temporary, item.entry.newAbsolute);
      item.placed = true;
    }

    removeEmptySourceDirectories(root, changed);
    fs.rmdirSync(staging);
  } catch (error) {
    for (const item of [...staged].reverse()) {
      try {
        fs.mkdirSync(path.dirname(item.entry.oldAbsolute), { recursive: true });
        if (item.placed && pathExists(item.entry.newAbsolute)) {
          fs.renameSync(item.entry.newAbsolute, item.entry.oldAbsolute);
        } else if (pathExists(item.temporary)) {
          fs.renameSync(item.temporary, item.entry.oldAbsolute);
        }
      } catch {
        // Preserve the original error. The staging directory and paths in its
        // diagnostic make any exceptional manual recovery explicit.
      }
    }
    throw error;
  }
}

const reportPath = (prefix, relativePath) => {
  process.stdout.write(`${prefix}\t${JSON.stringify(relativePath)}\n`);
};

const replaceContentCommand = (root, paths, identity, dryRun) => {
  let changed = 0;
  for (const absolutePath of paths) {
    const before = fs.readFileSync(absolutePath, 'utf8');
    const after = replaceBrandText(before, identity);
    if (after === before) continue;
    changed += 1;
    reportPath(
      dryRun ? 'WOULD_UPDATE' : 'UPDATED',
      relativeFromRoot(root, absolutePath)
    );
    if (!dryRun) fs.writeFileSync(absolutePath, after);
  }
  process.stdout.write(`COUNT\t${changed}\n`);
};

const countCommand = (paths, identity) => {
  let count = 0;
  for (const absolutePath of paths) {
    const text = fs.readFileSync(absolutePath, 'utf8');
    for (const line of text.split(/\r\n|\n|\r/)) {
      if (line.includes(KEEP_MARKER)) continue;
      count += [...line.matchAll(identityPattern(identity))].length;
    }
  }
  process.stdout.write(`${count}\n`);
};

const pathCommand = (root, paths, identity, mode) => {
  const plan = planPathRenames(root, paths, identity);
  const changed = plan.filter(({ changed: didChange }) => didChange);
  if (mode === 'apply') applyPathRenames(root, plan);
  if (mode !== 'check') {
    for (const entry of changed) {
      reportPath(
        mode === 'dry' ? 'WOULD_RENAME' : 'RENAMED',
        `${entry.oldRelative} → ${entry.newRelative}`
      );
    }
    process.stdout.write(`COUNT\t${changed.length}\n`);
  }
};

const verifyCommand = (root, sourcePaths, identity) => {
  const problems = [];
  for (const oldAbsolute of sourcePaths) {
    const oldRelative = relativeFromRoot(root, oldAbsolute);
    const newRelative = mapBrandPath(oldRelative, identity);
    const current = path.join(root, ...newRelative.split('/'));
    if (!pathExists(current)) {
      problems.push(`${newRelative}: missing after rebrand`);
      continue;
    }
    if (containsSourceIdentity(newRelative, identity)) {
      problems.push(`${newRelative}: old brand remains in tracked path`);
    }
    const text = fs.readFileSync(current, 'utf8');
    for (const survivor of findBrandSurvivors(text, identity)) {
      problems.push(
        `${newRelative}:${survivor.line}: ${JSON.stringify(survivor.text)}`
      );
    }
  }

  if (problems.length > 0) {
    process.stderr.write('Old brand remains outside rebrand:keep:\n');
    for (const problem of problems) process.stderr.write(`  ${problem}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    'Verified: no old-brand text or tracked paths remain outside rebrand:keep.\n'
  );
};

const verifyPathsCommand = (root, sourcePaths, identity) => {
  const problems = [];
  for (const oldAbsolute of sourcePaths) {
    const oldRelative = relativeFromRoot(root, oldAbsolute);
    const newRelative = mapBrandPath(oldRelative, identity);
    const current = path.join(root, ...newRelative.split('/'));
    if (!pathExists(current)) {
      problems.push(`${newRelative}: missing after rebrand`);
    } else if (containsSourceIdentity(newRelative, identity)) {
      problems.push(`${newRelative}: old brand remains in tracked path`);
    }
  }

  if (problems.length > 0) {
    process.stderr.write('Old brand remains in tracked paths:\n');
    for (const problem of problems) process.stderr.write(`  ${problem}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    'Verified: no old-brand tracked paths remain after rebrand.\n'
  );
};

const verifyCurrentCommand = (root, sourcePaths, identity) => {
  const problems = [];
  for (const current of sourcePaths) {
    if (!pathExists(current)) {
      problems.push(
        `${relativeFromRoot(root, current)}: missing before path rename`
      );
      continue;
    }
    const text = fs.readFileSync(current, 'utf8');
    for (const survivor of findBrandSurvivors(text, identity)) {
      problems.push(
        `${relativeFromRoot(root, current)}:${survivor.line}: ${JSON.stringify(survivor.text)}`
      );
    }
  }
  if (problems.length > 0) {
    process.stderr.write('Old brand remains outside rebrand:keep:\n');
    for (const problem of problems) process.stderr.write(`  ${problem}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    'Verified: no old-brand tracked text remains before path moves.\n'
  );
};

export const validateIdentityTransition = (identity, values = []) => {
  const ambiguousSource =
    identity.sourceDisplay === identity.sourceSlug ||
    identity.sourceDisplay === identity.sourceUpper ||
    identity.sourceComponent === identity.sourceUpper;
  if (ambiguousSource) {
    throw new Error(
      'current display identity is indistinguishable from its slug or uppercase projection; automated re-rebrand is unsafe'
    );
  }

  const invalidTargets = [
    identity.targetDisplay,
    identity.targetSlug,
    identity.targetComponent,
    identity.targetUpper,
  ].filter((value) => containsSourceIdentity(value, identity));
  if (invalidTargets.length > 0) {
    throw new Error(
      `target identity still contains the current brand: ${JSON.stringify(invalidTargets)}`
    );
  }
  const invalid = values.filter(
    (value) => value && containsSourceIdentity(value, identity)
  );
  if (invalid.length > 0) {
    throw new Error(
      `rebrand input still contains the current brand: ${JSON.stringify(invalid)}`
    );
  }
};

const validateFileCommand = (identity, file) => {
  if (!file) throw new Error('validate-file requires a path');
  const text = fs.readFileSync(path.resolve(file), 'utf8');
  if (containsSourceIdentity(text, identity)) {
    throw new Error(`brand-mark SVG still contains the current brand: ${file}`);
  }
};

export const validateRuntimePaths = (root, identity, files) => {
  const conflicts = [];
  for (const file of files) {
    if (containsSourceIdentity(file, identity)) {
      conflicts.push(`${file} (path)`);
      continue;
    }
    const survivors = findBrandSurvivors(
      fs.readFileSync(path.resolve(root, file), 'utf8'),
      identity
    );
    if (survivors.length > 0) conflicts.push(`${file} (implementation)`);
  }
  if (conflicts.length > 0) {
    throw new Error(
      `current identity collides with stable rebrand tooling; automated re-rebrand is unsafe: ${JSON.stringify(conflicts)}`
    );
  }
};

const updateStateCommand = (scriptPath, identity) => {
  let source = fs.readFileSync(scriptPath, 'utf8');
  const assignments = new Map([
    ['ORIGINAL_NAME', identity.targetDisplay],
    ['ORIGINAL_NAME_LOWER', identity.targetSlug],
    ['ORIGINAL_COMPONENT_NAME', identity.targetComponent],
    ['ORIGINAL_NAME_UPPER', identity.targetUpper],
  ]);
  for (const [name, value] of assignments) {
    const pattern = new RegExp(`^${name}=.*$`, 'gm');
    const matches = source.match(pattern) ?? [];
    if (matches.length !== 1) {
      throw new Error(
        `expected exactly one ${name} assignment, found ${matches.length}`
      );
    }
    source = source.replace(
      pattern,
      `${name}=${JSON.stringify(value)} # rebrand:keep`
    );
  }
  fs.writeFileSync(scriptPath, source);
};

const main = () => {
  const [
    command,
    rootArgument,
    sourceDisplay,
    sourceSlug,
    sourceComponent,
    sourceUpper,
    targetDisplay,
    targetSlug,
    targetComponent,
    ...extras
  ] = process.argv.slice(2);
  if (!command || !rootArgument || !targetComponent) {
    throw new Error(
      'command, root, four source names, and three target names are required'
    );
  }
  const root = path.resolve(rootArgument);
  const identity = createIdentity({
    sourceDisplay,
    sourceSlug,
    sourceComponent,
    sourceUpper,
    targetDisplay,
    targetSlug,
    targetComponent,
  });

  if (command === 'update-state') {
    if (!extras[0])
      throw new Error('update-state requires the rebrand.sh path');
    updateStateCommand(path.resolve(extras[0]), identity);
    return;
  }
  if (command === 'validate-target') {
    validateIdentityTransition(identity, extras);
    return;
  }
  if (command === 'validate-file') {
    validateFileCommand(identity, extras[0]);
    return;
  }
  if (command === 'validate-runtime') {
    validateRuntimePaths(root, identity, extras);
    return;
  }

  const paths = readNulPaths();
  switch (command) {
    case 'count':
      countCommand(paths, identity);
      break;
    case 'content-dry':
      replaceContentCommand(root, paths, identity, true);
      break;
    case 'content-apply':
      replaceContentCommand(root, paths, identity, false);
      break;
    case 'paths-check':
      pathCommand(root, paths, identity, 'check');
      break;
    case 'paths-dry':
      pathCommand(root, paths, identity, 'dry');
      break;
    case 'paths-apply':
      pathCommand(root, paths, identity, 'apply');
      break;
    case 'verify':
      verifyCommand(root, paths, identity);
      break;
    case 'verify-paths':
      verifyPathsCommand(root, paths, identity);
      break;
    case 'verify-current':
      verifyCurrentCommand(root, paths, identity);
      break;
    default:
      throw new Error(`unknown command: ${command}`);
  }
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`ERROR: ${error.message}\n`);
    process.exitCode = 1;
  }
}
