# Batch PATCH Scripts for SVG Wireframes

Automated fixes for common SVG wireframe issues identified in the QC process.

## Scripts

| Script                       | Issue Code    | Description                                        |
| ---------------------------- | ------------- | -------------------------------------------------- |
| `fix-signature-003.py`       | SIGNATURE-003 | Left-align signature blocks (x=40, no text-anchor) |
| `fix-g044-footer-corners.py` | G-044         | Add `rx="8"` to footer/nav rect elements           |
| `fix-g047-key-concepts.py`   | G-047         | Add "Key Concepts:" row at y=730                   |
| `run-all-patches.sh`         | All           | Master runner for all patches                      |

## Usage

### Run All Patches

```bash
# Preview changes (dry run)
./run-all-patches.sh --dry-run

# Apply all patches
./run-all-patches.sh
```

### Run Individual Patches

```bash
# Dry run individual fix
python fix-signature-003.py --dry-run

# Apply individual fix
python fix-signature-003.py

# Fix specific files only
python fix-signature-003.py docs/design/wireframes/003-user-authentication/01-registration-sign-in.svg
```

### Run Only One Fix Type

```bash
./run-all-patches.sh --fix signature  # Only SIGNATURE-003
./run-all-patches.sh --fix g044       # Only G-044
./run-all-patches.sh --fix g047       # Only G-047
```

## Issue Details

### SIGNATURE-003: Left-Align Signature

**Problem**: Signature at y=1060 is centered (`x="960"` with `text-anchor="middle"`)

**Fix**: Change to `x="40"` and remove `text-anchor="middle"`

**Correct format**:

```xml
<text x="40" y="1060" font-family="system-ui, sans-serif" font-size="18" font-weight="bold" fill="#374151">NNN:NN | Feature Name | ScriptHammer</text>
```

### G-044: Footer/Nav Rounded Corners

**Problem**: Footer and mobile nav rect elements missing `rx` attribute

**Fix**: Add `rx="8"` to matching rect elements

**Detection**: Rects with large width (1000-1300px) at y=640-720 (desktop footer) or width 340-360px at y=664-720 (mobile nav)

### G-047: Key Concepts Row

**Problem**: Missing "Key Concepts:" row in annotation panel

**Fix**: Insert standardized row before signature block:

```xml
<text x="40" y="730" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#374151">Key Concepts:</text>
<text x="140" y="730" font-family="system-ui, sans-serif" font-size="14" fill="#6b7280">term1 | term2 | term3</text>
```

## Post-Patch Workflow

1. **Review changes**: `git diff docs/design/wireframes/`
2. **Run validator**: `cd docs/design/wireframes && python validate-wireframe.py --all`
3. **Visual check**: Start viewer with `npm run dev` and inspect affected wireframes
4. **Commit**: `git add -A && git commit -m 'fix(wireframes): batch PATCH for SIGNATURE-003, G-044, G-047'`

## Adding New Patch Scripts

When creating new batch fix scripts:

1. Follow the existing pattern (dry-run support, file processing loop)
2. Add to `run-all-patches.sh`
3. Update this README
4. Test with `--dry-run` first
