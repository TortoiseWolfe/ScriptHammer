# Design Terminal Context

**Design roles**: UIDesigner

## Role Responsibilities

| Role       | Job                                        | Reports To |
| ---------- | ------------------------------------------ | ---------- |
| UIDesigner | Visual design execution, component styling | Architect  |

## Key Skills

| Role       | Skills                                         |
| ---------- | ---------------------------------------------- |
| UIDesigner | `/style-guide`, `/color-review`, `/asset-spec` |

## UIDesigner Focus

- Visual design execution (colors, typography, spacing)
- Component visual styling and polish
- Visual consistency across wireframes
- Icon and asset specification
- Theme variant designs (dark mode, light mode)
- Brand application to UI elements

## Integration with Wireframe Pipeline

UIDesigner works closely with:

```
UXDesigner → UIDesigner (visual specs) → WireframeGenerators → WireframeQA
                                                 ↑
                   UIDesigner reviews ───────────┘
```

- **UXDesigner** (receives interaction patterns and design system guidance)
- **WireframeGenerators** (provides visual specifications)
- **WireframeQA** (validates visual consistency)

## Visual Design Standards

| Element          | Standard                    |
| ---------------- | --------------------------- |
| Panel background | `#e8d4b8` (never white)     |
| Touch targets    | 44px minimum                |
| Color contrast   | WCAG AA compliance          |
| Typography       | Consistent sizing hierarchy |

## Communication

| Manager    | Receives From                         |
| ---------- | ------------------------------------- |
| Architect  | UIDesigner                            |
| UXDesigner | UIDesigner (design pattern questions) |

## Persistence Rule

Write to: `docs/interoffice/audits/YYYY-MM-DD-ui-designer-[topic].md`
