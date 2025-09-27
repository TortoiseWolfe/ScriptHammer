# Implementation Plan: Geolocation Map

**Branch**: `014-geolocation-map` | **Date**: 2025-01-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-geolocation-map/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path
   → ✓ Feature spec loaded
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → ✓ Project Type detected: web (Next.js app)
   → ✓ Structure Decision: Option 1 (Single project)
3. Evaluate Constitution Check section below
   → ✓ No violations found
   → ✓ Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → ✓ Technical decisions documented
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → ✓ Design artifacts generated
6. Re-evaluate Constitution Check section
   → ✓ No new violations
   → ✓ Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Task generation approach documented
8. STOP - Ready for /tasks command
```

## Summary

Interactive map component with geolocation support using Leaflet.js. Implements privacy-first location permissions with GDPR compliance, offline tile caching for PWA support, and full accessibility. No API keys required using OpenStreetMap tiles.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 18+
**Primary Dependencies**: Next.js 15.5, React 19.1, Leaflet 1.9.4, react-leaflet 4.2.1
**Storage**: localStorage for consent, IndexedDB for offline tiles
**Testing**: Vitest + React Testing Library + Playwright
**Target Platform**: Web (PWA-enabled, all modern browsers)
**Project Type**: web - Next.js application
**Performance Goals**: < 100KB bundle impact, < 2s initial load, 60fps interactions
**Constraints**: No vendor lock-in, WCAG AA compliant, offline-capable
**Scale/Scope**: Single map component with multiple instances support

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Simplicity**: ✅

- Projects: 1 (Next.js app with integrated components)
- Using framework directly? Yes (React-Leaflet wraps Leaflet directly)
- Single data model? Yes (GeolocationState for location data)
- Avoiding patterns? Yes (no unnecessary abstractions)

**Architecture**: ✅

- Component follows atomic design pattern (existing)
- 5-file component structure enforced
- Hooks for reusable logic (useGeolocation)
- Utils for map configuration

**Testing (NON-NEGOTIABLE)**: ✅

- RED-GREEN-Refactor cycle planned
- Tests before implementation in task order
- Order: Component tests → Integration → E2E
- Real browser APIs tested (mocked appropriately)
- Integration tests for permission flows

**Observability**: ✅

- Console logging for permission states
- Error boundaries for map failures
- Debug mode for tile loading

**Versioning**: ✅

- Following existing package.json versioning
- No breaking changes to existing APIs

## Project Structure

### Documentation (this feature)

```
specs/014-geolocation-map/
├── spec.md              # Feature specification (existing)
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
# Option 1: Single project (SELECTED - Next.js app)
src/
├── components/
│   ├── map/                    # Map-specific components
│   │   ├── MapContainer/       # Main map component (5-file)
│   │   ├── LocationButton/     # Geolocation trigger (5-file)
│   │   ├── LocationMarker/     # User position marker (5-file)
│   │   └── GeolocationConsent/ # Privacy consent UI (5-file)
├── hooks/
│   └── useGeolocation.ts       # Geolocation hook
├── utils/
│   └── map-utils.ts           # Map utilities
└── contexts/
    └── consent-context.tsx     # Extended for geolocation

app/
├── map/
│   └── page.tsx               # Map demo page

tests/
├── components/
│   └── map/                   # Component tests
├── integration/
│   └── geolocation-flow.test.tsx
└── e2e/
    └── map.spec.ts
```

**Structure Decision**: Option 1 (Single project) - Fits existing Next.js architecture

## Phase 0: Outline & Research

### Research Tasks Completed:

1. **Leaflet vs Google Maps vs Mapbox**
   - Decision: Leaflet
   - Rationale: Open-source, no API keys, community support
   - Alternatives: Google Maps (requires API key), Mapbox (requires account)

2. **React-Leaflet vs vanilla Leaflet**
   - Decision: React-Leaflet
   - Rationale: React integration, component lifecycle management
   - Alternatives: Vanilla (more control but manual React integration)

3. **Permission handling patterns**
   - Decision: Permissions API + fallback
   - Rationale: Modern API with graceful degradation
   - Alternatives: Direct geolocation (no pre-check capability)

4. **SSR issues with Leaflet**
   - Decision: Dynamic import with ssr: false
   - Rationale: Leaflet requires window object
   - Alternatives: None for Next.js

5. **Offline tile caching strategy**
   - Decision: Service Worker with Cache API
   - Rationale: PWA integration, existing SW setup
   - Alternatives: IndexedDB (more complex for binary data)

**Output**: See research.md for detailed findings

## Phase 1: Design & Contracts

### Entities (data-model.md):

- **GeolocationState**: User location and permission state
- **MapConfiguration**: Map settings and defaults
- **MarkerData**: Custom marker information
- **ConsentState**: Extended for geolocation consent

### API Contracts:

- No backend APIs (client-side only)
- Browser APIs: Geolocation, Permissions
- External: OpenStreetMap tile server (no auth)

### Component Contracts:

- **MapContainer**: Props interface for map configuration
- **useGeolocation**: Hook interface for location access
- **LocationButton**: Props for permission UI
- **GeolocationConsent**: Modal props and events

### Test Scenarios (quickstart.md):

1. First-time user requests location
2. User denies location permission
3. User revokes permission after granting
4. Map loads without location features
5. Custom markers display correctly
6. Offline map tile loading

### CLAUDE.md Updates:

- Added Leaflet/React-Leaflet to dependencies
- Added geolocation patterns to component examples
- Updated testing notes for permission mocking

**Output**: data-model.md, contracts/, quickstart.md, CLAUDE.md updated

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during /plan_

**Task Generation Strategy**:

- Setup tasks: Dependencies, CSP configuration
- Component generation: Use existing generator (5-file pattern)
- Test tasks [P]: One per component, one per flow
- Implementation: Hook first, then components
- Integration: GDPR consent extension
- Polish: Accessibility, performance, documentation

**Ordering Strategy**:

- Dependencies before components
- Hook before components that use it
- Tests before implementation (TDD)
- Core functionality before enhancements
- Mark [P] for parallel component development

**Estimated Output**: 30-35 numbered tasks following TDD approach

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following TDD)
**Phase 5**: Validation (run tests, execute quickstart.md, Lighthouse audit)

## Complexity Tracking

_No violations - section empty_

## Progress Tracking

_This checklist is updated during execution flow_

**Phase Status**:

- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

---

_Based on existing project patterns - See CLAUDE.md and component structure_
