# Plan: Fix Quadrant Screenshot Calculations

## Problem Analysis

The current quadrant capture is broken because:

1. **Arbitrary pan values (±1600, ±1000)** don't account for the actual coordinate system
2. **At 280% zoom, only ~607×364 canvas pixels are visible** of a 1600×1000 canvas
3. **A 2×2 grid can't cover the full canvas** - we need at least 3×3 (9 shots) at 280%
4. **Massive middle sections are skipped** between quadrant corners

### Current vs Required Coverage

| Approach                | Shots | Coverage                            |
| ----------------------- | ----- | ----------------------------------- |
| Current 2×2             | 4     | ~40% (corners only, middle skipped) |
| Required 3×3            | 9     | 100% with overlap                   |
| Alternative 2×2 at 160% | 4     | ~100% (lower detail)                |

## Root Cause

The transform in `index.html:1801`:

```javascript
viewer.style.transform = `translate(-50%, -50%) translate(${panX}px, ${panY}px) scale(${zoom})`;
```

**Pan values are viewport-space pixel offsets from center, applied BEFORE scaling.**

### Correct Formula

To position view at canvas coordinates (x, y):

```javascript
panX = (centerX - canvasWidth / 2) * zoom;
panY = (centerY - canvasHeight / 2) * zoom;
```

Where `centerX, centerY` = the canvas coordinate you want at viewport center.

## Recommended Solution

### Option A: Use Lower Zoom (160%) for 2×2 Coverage

At 160% zoom, visible area = ~1063×638 canvas pixels → 4 shots cover full 1600×1000.

**Pan values for 160% zoom (1.6x):**
| Quadrant | Canvas Center | panX | panY |
|----------|---------------|------|------|
| TL | (400, 250) | -480 | -400 |
| TR | (1200, 250) | 800 | -400 |
| BL | (400, 750) | -480 | 400 |
| BR | (1200, 750) | 800 | 400 |

### Option B: Use 3×3 Grid at 280% for Detail

9 shots with proper overlap:
| Position | Canvas Center | panX | panY |
|----------|---------------|------|------|
| TL | (267, 167) | -1067 | -933 |
| TC | (800, 167) | 0 | -933 |
| TR | (1333, 167) | 1067 | -933 |
| ML | (267, 500) | -1067 | 0 |
| MC | (800, 500) | 0 | 0 |
| MR | (1333, 500) | 1067 | 0 |
| BL | (267, 833) | -1067 | 933 |
| BC | (800, 833) | 0 | 933 |
| BR | (1333, 833) | 1067 | 933 |

### Option C: Add Helper Function to Viewer

Add `panToCanvasPoint(x, y)` function that calculates correct pan values automatically.

## Files to Modify

1. **`.claude/commands/wireframe-review.md`** - Update pan value calculations in Step 2
2. **`docs/design/wireframes/index.html`** (optional) - Add helper functions for grid positioning

## Implementation Steps

### Step 1: Choose zoom level based on need

```javascript
// For detail review (280% = 2.8x), use 3×3 grid
// For quick overview (160% = 1.6x), use 2×2 grid
```

### Step 2: Calculate pan values using correct formula

```javascript
// Helper function to add to the review process
function canvasToPan(canvasX, canvasY, zoom, canvasW = 1600, canvasH = 1000) {
  return {
    panX: (canvasX - canvasW / 2) * zoom,
    panY: (canvasY - canvasH / 2) * zoom,
  };
}

// For 2×2 at 160% zoom:
const quadW = 1600 / 2; // 800
const quadH = 1000 / 2; // 500
const TL = canvasToPan(quadW / 2, quadH / 2, 1.6); // (400, 250)
const TR = canvasToPan(1600 - quadW / 2, quadH / 2, 1.6); // (1200, 250)
const BL = canvasToPan(quadW / 2, 1000 - quadH / 2, 1.6); // (400, 750)
const BR = canvasToPan(1600 - quadW / 2, 1000 - quadH / 2, 1.6); // (1200, 750)
```

### Step 3: Update wireframe-review.md skill

Replace the hardcoded pan values with calculated values based on:

- SVG dimensions (from viewBox)
- Zoom level
- Viewport size

## Testing Both Variants

To test, we need to:

1. **Test Option A (160% zoom)**: Capture 4 quadrants and verify they tile together
2. **Test Option B (280% zoom)**: Capture 9 grid positions and verify full coverage

### Quick Test Commands

For 160% zoom (Option A), use browser_evaluate:

```javascript
// TL: panX=-480, panY=-400
zoom = 1.6;
panX = -480;
panY = -400;
viewer.style.transform = `translate(-50%, -50%) translate(${panX}px, ${panY}px) scale(${zoom})`;
```

### Visual Verification

After capturing all shots, they should tile together with:

- No gaps (missing middle sections)
- Minimal overlap (efficient coverage)
- Edges of SVG visible in corner shots
