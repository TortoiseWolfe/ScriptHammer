# SVG Validation Checklist

Quick reference for Generator terminals. Full rules in `validate-wireframe.py`.

## Structure

- [ ] `viewBox="0 0 1920 1080" width="1920" height="1080"`
- [ ] Desktop mockup: x=40, y=60, 1280×720
- [ ] Mobile mockup: x=1360, y=60, 360×720
- [ ] Annotation panel starts at y=800

## Colors (Light Theme)

- [ ] Panels: `#e8d4b8` (NO `#ffffff`)
- [ ] Primary button: `#8b5cf6`
- [ ] Secondary button: `#f5f0e6`
- [ ] Tertiary button: `#dcc8a8`
- [ ] Toggle OFF: `#6b7280`, ON: `#22c55e`

## Typography

- [ ] Annotation titles: 16px bold `#1f2937`
- [ ] Narrative text: 14px regular `#374151`
- [ ] Callout numbers: 14px bold white on `#dc2626`

## Callouts

- [ ] Numbered circles on mockups (①②③)
- [ ] Matching annotations in panel below
- [ ] US-anchored groups with badge pills (US cyan, FR blue, SC orange)

## Mobile

- [ ] Content starts at y >= 78 (after header)
- [ ] Touch targets minimum 44px
- [ ] All desktop callouts mirrored on mobile

## Badges

- [ ] US: `#0891b2` (cyan)
- [ ] FR: `#2563eb` (blue)
- [ ] SC: `#f97316` (orange)
- [ ] Badges contained within parent bounds

## Validate

```bash
python3 docs/design/wireframes/validate-wireframe.py [file.svg]
```

Must show `STATUS: PASS` before committing.
