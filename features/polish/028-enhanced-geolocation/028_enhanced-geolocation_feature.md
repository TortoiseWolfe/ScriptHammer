# Feature: Enhanced Geolocation

**Feature ID**: 028
**Category**: polish
**Source**: ScriptHammer/docs/specs/015-enhanced-geolocation
**Status**: Ready for SpecKit

## Description

Platform-aware geolocation system that detects device type and selects appropriate location strategy. Desktop users get address search with autocomplete and click-to-set location. Mobile users get GPS with accuracy indicators. All users see clear accuracy feedback and have manual override options.

## User Scenarios

### US-1: Desktop Address Search (P1)

A desktop user searches for their address and the map shows their exact location.

**Acceptance Criteria**:

1. Given desktop user, when page loads, then search box is visible
2. Given typing address, when autocomplete appears, then addresses are suggested
3. Given address selected, when confirmed, then map centers on location with pin

### US-2: Desktop Click-to-Set Location (P2)

A desktop user clicks on the map to manually set their location when search doesn't work.

**Acceptance Criteria**:

1. Given map displayed, when user clicks, then marker is placed
2. Given existing marker, when dragged, then location updates
3. Given location set, when page revisited, then location is remembered

### US-3: Desktop IP Fallback (P2)

A desktop user sees IP-based location estimate with accuracy indicator when no interaction.

**Acceptance Criteria**:

1. Given no location interaction, when page loads, then IP-based location shown
2. Given IP location, when viewing indicator, then accuracy shows "City level"
3. Given low accuracy, when viewing options, then prompt to refine location appears

### US-4: Mobile GPS Location (P1)

A mobile user sees accurate GPS location on the map with real-time updates.

**Acceptance Criteria**:

1. Given mobile user, when permission granted, then GPS location acquired
2. Given GPS active, when accuracy improves, then position updates
3. Given moving, when location changes, then map updates smoothly

### US-5: Mobile Accuracy Indicator (P2)

A mobile user sees visual feedback about location accuracy.

**Acceptance Criteria**:

1. Given location active, when viewing map, then accuracy radius displayed
2. Given low accuracy, when viewing indicator, then color indicates confidence
3. Given GPS/WiFi source, when viewing indicator, then source is shown

### US-6: Location Preferences Persistence (P3)

User location preferences are remembered across sessions.

**Acceptance Criteria**:

1. Given manual correction, when page revisited, then correction persists
2. Given consent given, when page revisited, then consent remembered
3. Given clear data clicked, when confirmed, then all location data cleared

## Requirements

### Functional

**Platform Detection**

- FR-001: Detect if user is on mobile or desktop device
- FR-002: Select appropriate location strategy based on platform
- FR-003: Support manual override of detected platform

**Desktop Features**

- FR-004: Provide address search box with autocomplete
- FR-005: Allow clicking on map to set location
- FR-006: Support direct coordinate input
- FR-007: Remember manually set locations
- FR-008: Show IP-based estimate as fallback

**Mobile Features**

- FR-009: Request GPS permission appropriately
- FR-010: Use high accuracy mode on mobile
- FR-011: Implement battery-efficient tracking
- FR-012: Update position when accuracy improves significantly (>50m)

**Accuracy Indicators**

- FR-013: Display accuracy radius on map
- FR-014: Show location source (GPS/WiFi/IP/Manual)
- FR-015: Indicate confidence level visually
- FR-016: Display numerical accuracy (±meters)

**Geocoding**

- FR-017: Integrate with OpenStreetMap Nominatim
- FR-018: Handle rate limiting (1 req/sec)
- FR-019: Cache geocoding results
- FR-020: Provide reverse geocoding (coords → address)

### Non-Functional

- NFR-001: Initial location within 3 seconds on mobile
- NFR-002: Address search returns results within 500ms
- NFR-003: Manual location setting instant (<100ms)
- NFR-004: Mobile GPS achieves ±10m accuracy when available
- NFR-005: Desktop search provides exact coordinates
- NFR-006: IP fallback correctly identifies city 75% of time

### Privacy

- NFR-007: Request consent before any location access
- NFR-008: Explain each location method clearly
- NFR-009: Allow usage without location features
- NFR-010: Do not share location with third parties

### Out of Scope

- Real-time location sharing with other users
- Location history/tracking over time
- Route planning or navigation
- Offline map tiles
- Custom tile servers

## Success Criteria

- SC-001: Desktop location accuracy >95% correct city
- SC-002: Mobile location accuracy >90% within 100m
- SC-003: User manual corrections <5% of sessions
- SC-004: Performance regression <100ms added to load time
- SC-005: All test cases passing
- SC-006: Accessibility audit passed
