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
| 1    | Invalid arguments                                          |
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

If grep finds 0 occurrences of "ScriptHammer":

```
WARNING: This repository appears to have been rebranded already.
No "ScriptHammer" references found.

Current project name appears to be: OtherProject
Do you want to rebrand from "OtherProject" to "MyApp"? [y/N]
```

### File Patterns

**Included**:

```
*.ts *.tsx *.js *.jsx *.json *.md *.yml *.yaml *.sh *.html *.css
```

**Excluded**:

```
node_modules/ .next/ out/ .git/ *.lock pnpm-lock.yaml package-lock.json
```

## Idempotency

Running the script multiple times with the same arguments produces the same result. Running with different arguments in a re-rebrand scenario will prompt for confirmation.
