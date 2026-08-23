# Contract: Rebrand Script

## Interface

```bash
./scripts/rebrand.sh <PROJECT_NAME> <OWNER> "<DESCRIPTION>" [--force] [--dry-run]
```

## Arguments

| Arg          | Type   | Required | Description                              |
| ------------ | ------ | -------- | ---------------------------------------- |
| PROJECT_NAME | string | Yes      | New project name (auto-sanitized)        |
| OWNER        | string | Yes      | GitHub username/org                      |
| DESCRIPTION  | string | Yes      | Project description (quoted)             |
| --force      | flag   | No       | Skip confirmation prompts                |
| --dry-run    | flag   | No       | Show what would change without modifying |

## Exit Codes

| Code | Meaning                                                    |
| ---- | ---------------------------------------------------------- |
| 0    | Success                                                    |
| 1    | Validation or rebrand failure                              |
| 2    | Re-rebrand scenario (no ScriptHammer found), user declined |
| 3    | Git not installed or not a git repo                        |

## Output Format

```
Rebranding ScriptHammer → MyApp
Owner: myuser
Description: My awesome app

Sanitizing project name: "My App!" → "my-app"

Updating file contents...
  ✓ package.json
  ✓ docker-compose.yml
  ✓ src/config/project.config.ts
  ... (200+ files)

Renaming files...
  ✓ ScriptHammerLogo.tsx → MyAppLogo.tsx
  ✓ LayeredScriptHammerLogo.tsx → LayeredMyAppLogo.tsx

Updating git remote...
  ✓ origin → github.com/myuser/my-app

Cleaning up...
  ✓ Deleted public/CNAME

Summary:
  Files modified: 215
  Files renamed: 3
  Time elapsed: 4.2s

Run 'docker compose up --build' to rebuild with new configuration.
```

## Behavior

### Name Sanitization

```
Input               → Output
"My App"           → "my-app"
"MyApp!"           → "myapp"
"my_cool_app"      → "my-cool-app"
"  Spaces  "       → "spaces"
"UPPERCASE"        → "uppercase" (for technical) / "UPPERCASE" (for display)
```

### Re-rebrand Detection

If the tracked-text scan finds exactly 0 case-insensitive, unmarked occurrences
of the four recorded source projections (display, slug, component, uppercase):

```
WARNING: This repository appears to have been rebranded already.
No unmarked case-insensitive "ScriptHammer" references found.

Current project name appears to be: OtherProject
Do you want to rebrand from "OtherProject" to "MyApp"? [y/N]
```

### Case-Preserving Substitution

For a target named `GeoLarp`:

```
ScriptHammer  → GeoLarp
scripthammer  → geolarp
Scripthammer  → Geolarp
SCRIPTHAMMER  → GEOLARP
ScriptHAMMER  → GeoLarp
```

Matches adjacent to identifier characters use an identifier-safe component
projection. Uppercase tokens always use the uppercase component projection, so
`SCRIPTHAMMER_TEST_DOMAIN` remains valid for a multiword display name. Lowercase
standalone tokens use the sanitized technical slug. A same-line
`rebrand:keep` marker is the current explicit content opt-out.

### Repository and Path Scope

Content and path discovery use one immutable, NUL-separated `git ls-files`
snapshot. This includes tracked extensionless files and future file types
without an allowlist.

Content rewriting excludes lockfiles and files that `grep -I` classifies as
binary. Path renaming still includes those files: it changes every brand-bearing
path component without reading or rewriting file bytes.

Before the first write, the script computes every target path and fails on an
existing-target or case-folding collision. After an applied run, it scans the
mapped tracked-text destinations and paths case-insensitively. Any unmarked old
brand is exit 1; success is not reported.

**Not content-rewritten**:

```
untracked/ignored files
pnpm-lock.yaml package-lock.json yarn.lock bun.lockb
binary files
```

## Idempotency

Running the script multiple times with the same identity produces the same
result and explicitly skips the contradictory old-equals-new postcondition.
The script persists display, slug, component, and uppercase projections in its
own identity state so a later re-rebrand can find identifiers and paths emitted
by the first run. Running with different arguments in a detected re-rebrand
scenario may prompt for confirmation unless `--force` is supplied. Prior path
moves must first be staged with `git add -A` (preferably committed). Automated
different-target re-rebrands reject ambiguous source projections and identities
that collide with stable rebrand tooling. The stable shell/helper implementation
is not rewritten as application brand content; the shell's four identity fields
are updated only after verification succeeds.
