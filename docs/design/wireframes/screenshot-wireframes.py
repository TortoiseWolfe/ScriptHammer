#!/usr/bin/env python3
"""
Wireframe Screenshot Tool v1.2

Takes standardized screenshots of SVG wireframes using Playwright.
Runs in Docker with self-contained live-server - no external dependencies.

Usage:
    python screenshot-wireframes.py 002                    # All SVGs in feature
    python screenshot-wireframes.py 002-cookie-consent     # Full feature name
    python screenshot-wireframes.py 002:01                 # Single SVG

Output:
    png/[feature]/[svg-name]/
        overview.png          # Full canvas (fit to view)
        quadrant-center.png   # Center region (overlaps all corners)
        quadrant-tl.png       # Top-left quarter
        quadrant-tr.png       # Top-right quarter
        quadrant-bl.png       # Bottom-left quarter
        quadrant-br.png       # Bottom-right quarter
        manifest.json         # Paths + validator results

Method:
    - Viewport: 3840x2160 (2x native)
    - SVG forced to zoom=2 (fills viewport exactly)
    - Playwright clips capture 1920x1080 regions
    - Each clip shows 960x540 SVG pixels at 2x detail
    - 5 quadrant shots tile to cover entire 1920x1080 SVG canvas
"""

import sys
import json
import subprocess
import time
import signal
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional

# Playwright imports - will fail gracefully if not installed
try:
    from playwright.sync_api import sync_playwright, Page
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    print("WARNING: Playwright not installed. Run: pip install playwright && playwright install chromium")

# PIL for resizing overview (Claude API has 2000px limit for multi-image requests)
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("WARNING: PIL not installed. Overview images will be full size. Run: pip install Pillow")

# Import validator for auto-validation (handle hyphenated filename)
import importlib.util
spec = importlib.util.spec_from_file_location("validate_wireframe", Path(__file__).parent / "validate-wireframe.py")
validate_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validate_module)
WireframeValidator = validate_module.WireframeValidator
IssueLogger = validate_module.IssueLogger

# Configuration
WIREFRAMES_DIR = Path(__file__).parent
SERVER_PORT = 8080
VIEWPORT_WIDTH = 3840  # 2x native 1920
VIEWPORT_HEIGHT = 2160  # 2x native 1080
SCREENSHOT_TIMEOUT = 10000  # ms

# Standard quadrant tiling - clips assemble like puzzle pieces
# At zoom=2, viewport is 3840×2160, SVG fills it exactly
# Each clip is 1920×1080 (half viewport), showing 960×540 SVG pixels
QUADRANT_CLIPS = {
    'tl': {'x': 0, 'y': 0, 'width': 1920, 'height': 1080},          # SVG 0-960 × 0-540
    'tr': {'x': 1920, 'y': 0, 'width': 1920, 'height': 1080},       # SVG 960-1920 × 0-540
    'center': {'x': 960, 'y': 540, 'width': 1920, 'height': 1080},  # SVG 480-1440 × 270-810
    'bl': {'x': 0, 'y': 1080, 'width': 1920, 'height': 1080},       # SVG 0-960 × 540-1080
    'br': {'x': 1920, 'y': 1080, 'width': 1920, 'height': 1080},    # SVG 960-1920 × 540-1080
}


def find_feature_dir(feature_arg: str) -> Optional[Path]:
    """Find feature directory from argument (e.g., '002' or '002-cookie-consent')."""
    # Try exact match first
    for dir_path in WIREFRAMES_DIR.iterdir():
        if dir_path.is_dir() and dir_path.name.startswith(feature_arg):
            return dir_path

    # Try with leading zeros
    if feature_arg.isdigit():
        padded = feature_arg.zfill(3)
        for dir_path in WIREFRAMES_DIR.iterdir():
            if dir_path.is_dir() and dir_path.name.startswith(padded):
                return dir_path

    return None


def find_svg_files(feature_dir: Path, svg_num: Optional[str] = None) -> List[Path]:
    """Find SVG files in feature directory."""
    svg_files = sorted(feature_dir.glob('*.svg'))

    if svg_num:
        # Filter to specific SVG number (e.g., '01')
        padded = svg_num.zfill(2)
        svg_files = [f for f in svg_files if f.name.startswith(padded)]

    return svg_files


def start_server() -> subprocess.Popen:
    """Start HTTP server for serving wireframes.

    Uses Python's http.server instead of live-server to avoid
    auto-reload issues when PNG files are created during screenshots.
    """
    print(f"Starting HTTP server on port {SERVER_PORT}...")

    # Use Python http.server (no auto-reload) to avoid context destruction
    proc = subprocess.Popen(
        [sys.executable, '-m', 'http.server', str(SERVER_PORT)],
        cwd=WIREFRAMES_DIR,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

    # Wait for server to start
    time.sleep(2)
    return proc


def stop_server(proc: subprocess.Popen):
    """Stop the live-server."""
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()


def take_screenshots(page: Page, svg_path: Path, output_dir: Path) -> Dict:
    """Take all screenshots for a single SVG."""
    output_dir.mkdir(parents=True, exist_ok=True)

    feature_name = svg_path.parent.name
    svg_name = svg_path.stem

    # Navigate to SVG in viewer
    url = f"http://localhost:{SERVER_PORT}/index.html#{feature_name}/{svg_path.name}"
    print(f"  Navigating to: {url}")
    page.goto(url, wait_until='networkidle')

    # Wait for SVG to be present in viewer
    page.wait_for_selector('#viewer svg', timeout=10000)
    page.wait_for_timeout(1000)

    screenshots = {}

    # Overview screenshot at 100% (full viewport)
    overview_path = output_dir / 'overview.png'
    page.screenshot(path=str(overview_path), full_page=False)

    # Resize overview to 1920x1080 (Claude API has 2000px limit for multi-image requests)
    if PIL_AVAILABLE:
        img = Image.open(overview_path)
        img = img.resize((1920, 1080), Image.LANCZOS)
        img.save(overview_path)
        print(f"    Saved: overview.png (resized to 1920x1080)")
    else:
        print(f"    Saved: overview.png (full size - PIL not available)")

    screenshots['overview'] = str(overview_path.relative_to(WIREFRAMES_DIR))

    # Wait for page to fully stabilize after fitToView animations
    page.wait_for_timeout(500)

    # Quadrant screenshots - use setViewerState API which sets manualZoomActive
    page.evaluate("""
        const viewer = document.querySelector('#viewer');
        viewer.style.transition = 'none';
    """)

    # Pan and zoom values for 1920×1080 canvas
    # CENTER at zoom=2 shows 960×540 (exact center)
    # Corners at zoom=1.9 show ~1010×568 (captures true corners + ~100px overlap)
    # Sequence: CENTER first, then corners (matching original MCP Toolkit)
    pan_positions = [
        ('center', 0, 0, 2.0),        # Canvas center at zoom=2
        ('tl', 864, 486, 1.9),        # Top-left corner with overlap
        ('tr', -864, 486, 1.9),       # Top-right corner with overlap
        ('br', -864, -486, 1.9),      # Bottom-right corner with overlap
        ('bl', 864, -486, 1.9),       # Bottom-left corner with overlap
    ]

    # Clip coordinates: center 1920x1080 region of 3840x2160 viewport
    clip_x = (VIEWPORT_WIDTH - 1920) // 2   # 960
    clip_y = (VIEWPORT_HEIGHT - 1080) // 2  # 540
    clip = {'x': clip_x, 'y': clip_y, 'width': 1920, 'height': 1080}

    for quadrant_name, pan_x, pan_y, zoom_level in pan_positions:
        # Set CSS transform with per-quadrant zoom level
        page.evaluate(f"""
            const viewer = document.querySelector('#viewer');
            viewer.style.transform = 'translate(-50%, -50%) translate({pan_x}px, {pan_y}px) scale({zoom_level})';
        """)
        page.wait_for_timeout(50)  # Brief wait for render

        quadrant_path = output_dir / f'quadrant-{quadrant_name}.png'
        page.screenshot(path=str(quadrant_path), full_page=False, clip=clip)
        screenshots[f'quadrant_{quadrant_name}'] = str(quadrant_path.relative_to(WIREFRAMES_DIR))
        print(f"    Saved: quadrant-{quadrant_name}.png (pan: {pan_x}, {pan_y}, zoom: {zoom_level})")

    # Reset for next SVG
    page.evaluate("""
        const viewer = document.querySelector('#viewer');
        viewer.style.transition = '';
        window.resetViewerState();
    """)

    return screenshots


def run_validator(svg_path: Path) -> Dict:
    """Run the SVG validator and return results."""
    validator = WireframeValidator(svg_path)
    issues = validator.validate()

    return {
        'error_count': len(issues),
        'errors': [
            {
                'code': issue.code,
                'message': issue.message,
                'line': issue.line
            }
            for issue in issues
        ]
    }


def create_manifest(output_dir: Path, svg_path: Path, screenshots: Dict, validation: Dict) -> Path:
    """Create manifest.json with all results."""
    manifest = {
        'generated': datetime.now().isoformat(),
        'svg_file': str(svg_path.relative_to(WIREFRAMES_DIR)),
        'feature': svg_path.parent.name,
        'screenshots': screenshots,
        'validation': validation
    }

    manifest_path = output_dir / 'manifest.json'
    manifest_path.write_text(json.dumps(manifest, indent=2))
    return manifest_path


def process_svg(page: Page, svg_path: Path) -> Dict:
    """Process a single SVG: screenshots + validation."""
    feature_name = svg_path.parent.name
    svg_name = svg_path.stem
    output_dir = WIREFRAMES_DIR / 'png' / feature_name / svg_name

    print(f"\nProcessing: {svg_path.name}")

    # Take screenshots
    screenshots = take_screenshots(page, svg_path, output_dir)

    # Run validator
    print(f"  Running validator...")
    validation = run_validator(svg_path)
    print(f"    Found {validation['error_count']} errors")

    # Create manifest
    manifest_path = create_manifest(output_dir, svg_path, screenshots, validation)
    print(f"  Manifest: {manifest_path.relative_to(WIREFRAMES_DIR)}")

    return {
        'svg': str(svg_path.relative_to(WIREFRAMES_DIR)),
        'output_dir': str(output_dir.relative_to(WIREFRAMES_DIR)),
        'manifest': str(manifest_path.relative_to(WIREFRAMES_DIR)),
        'screenshots': len(screenshots),
        'errors': validation['error_count']
    }


def main():
    if not PLAYWRIGHT_AVAILABLE:
        print("ERROR: Playwright is required. Install with:")
        print("  pip install playwright && playwright install chromium")
        sys.exit(1)

    if len(sys.argv) < 2:
        print("Usage: python screenshot-wireframes.py <feature> [svg-num]")
        print("       python screenshot-wireframes.py 002")
        print("       python screenshot-wireframes.py 002:01")
        sys.exit(1)

    # Parse arguments
    arg = sys.argv[1]
    svg_num = None

    if ':' in arg:
        feature_arg, svg_num = arg.split(':')
    else:
        feature_arg = arg

    # Find feature directory
    feature_dir = find_feature_dir(feature_arg)
    if not feature_dir:
        print(f"ERROR: Feature not found: {feature_arg}")
        print(f"Available features: {[d.name for d in WIREFRAMES_DIR.iterdir() if d.is_dir() and d.name[0].isdigit()]}")
        sys.exit(1)

    # Find SVG files
    svg_files = find_svg_files(feature_dir, svg_num)
    if not svg_files:
        print(f"ERROR: No SVG files found in {feature_dir.name}")
        sys.exit(1)

    print(f"{'='*60}")
    print(f"WIREFRAME SCREENSHOT TOOL v1.0")
    print(f"{'='*60}")
    print(f"Feature: {feature_dir.name}")
    print(f"SVGs to process: {len(svg_files)}")
    print(f"Resolution: {VIEWPORT_WIDTH}x{VIEWPORT_HEIGHT} (2x)")

    # Start server
    server_proc = start_server()

    results = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={'width': VIEWPORT_WIDTH, 'height': VIEWPORT_HEIGHT}
            )
            page = context.new_page()

            for svg_path in svg_files:
                result = process_svg(page, svg_path)
                results.append(result)

            browser.close()
    finally:
        stop_server(server_proc)

    # Summary
    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")

    total_screenshots = sum(r['screenshots'] for r in results)
    total_errors = sum(r['errors'] for r in results)

    print(f"SVGs processed: {len(results)}")
    print(f"Screenshots taken: {total_screenshots}")
    print(f"Validation errors: {total_errors}")

    for result in results:
        status = "PASS" if result['errors'] == 0 else f"FAIL ({result['errors']} errors)"
        print(f"  {result['svg']}: {status}")

    # Write summary manifest
    summary_path = WIREFRAMES_DIR / 'png' / feature_dir.name / 'summary.json'
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps({
        'generated': datetime.now().isoformat(),
        'feature': feature_dir.name,
        'results': results
    }, indent=2))
    print(f"\nSummary: {summary_path.relative_to(WIREFRAMES_DIR)}")

    # Fix permissions to match host user
    fix_permissions(summary_path.parent)


def fix_permissions(output_dir: Path):
    """Fix permissions on output files to match host user.

    Reads HOST_UID and HOST_GID from environment (set by docker-compose).
    Falls back to 1000:1000 which is typical for WSL2 users.
    """
    import os

    host_uid = int(os.environ.get('HOST_UID', 1000))
    host_gid = int(os.environ.get('HOST_GID', 1000))

    print(f"\nFixing permissions to {host_uid}:{host_gid}...")

    try:
        # Fix all files and subdirectories
        for path in output_dir.rglob('*'):
            os.chown(path, host_uid, host_gid)

        # Fix the output directory itself
        os.chown(output_dir, host_uid, host_gid)

        print("  Permissions fixed.")
    except PermissionError as e:
        print(f"  Warning: Could not fix permissions: {e}")
    except Exception as e:
        print(f"  Warning: Permission fix failed: {e}")


if __name__ == '__main__':
    main()
