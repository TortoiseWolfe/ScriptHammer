# PRP-015: Enhanced Geolocation Accuracy

## Status: PROPOSED

**Priority**: P2 - High
**Target Release**: v0.4.0
**Estimated Effort**: 4 weeks

## Problem

Desktop browsers using IP-based geolocation can show users "several cities away" from their actual location due to inherent limitations of IP geolocation (50-75% city-level accuracy). This significantly impacts user experience for location-based features.

## Solution

Implement a hybrid geolocation approach that uses platform-appropriate strategies:

- **Desktop**: Address search (primary) with map clicking and IP fallback
- **Mobile**: GPS (primary) with WiFi/Cell tower fallback
- **Universal**: Manual correction and location persistence

## Key Features

1. **Address Search with Autocomplete** - OpenStreetMap Nominatim integration
2. **Click-to-Set Location** - Direct map interaction
3. **Accuracy Indicators** - Visual and textual confidence levels
4. **Smart Fallbacks** - Platform-specific strategy chains
5. **Location Persistence** - Remember manual corrections

## Benefits

- **Accuracy**: >95% correct city (desktop), >90% within 100m (mobile)
- **User Control**: Multiple methods to set/correct location
- **Transparency**: Clear indication of accuracy and source
- **Performance**: Battery-efficient mobile tracking
- **Privacy**: GDPR compliant, local-only storage

## Implementation Plan

### Week 1: Core Infrastructure

- Platform detection
- Strategy pattern implementation
- Accuracy calculations

### Week 2: Desktop Features

- Nominatim integration
- Address search UI
- Map interaction handlers

### Week 3: Mobile Optimization

- Battery-efficient tracking
- Continuous updates
- Accuracy monitoring

### Week 4: Polish & Testing

- Visual indicators
- E2E test coverage
- Performance optimization

## Technical Approach

```typescript
// Strategy selection based on platform
const locationStrategy = isMobile()
  ? new GPSStrategy()
  : new AddressSearchStrategy();

// Fallback chain
const fallbackChain = [
  primaryStrategy,
  new WiFiStrategy(),
  new IPStrategy(),
  new ManualStrategy(),
];
```

## Success Metrics

- User manual corrections: <5% of sessions
- Performance impact: <100ms load time increase
- User satisfaction: >4.5/5 rating
- Adoption rate: >80% use enhanced features

## Dependencies

- OpenStreetMap Nominatim API (no key required)
- Browser Geolocation API
- Existing MapContainer component
- Consent management system

## Risks & Mitigation

| Risk                  | Mitigation                         |
| --------------------- | ---------------------------------- |
| API rate limits       | Implement caching and queueing     |
| Battery drain         | Smart tracking with idle detection |
| Privacy concerns      | Clear consent, local-only storage  |
| Browser compatibility | Progressive enhancement fallbacks  |

## References

- [Full Constitution](../../specs/015-enhanced-geolocation/constitution.md)
- [Detailed Requirements](../../specs/015-enhanced-geolocation/requirements.md)
- [Nominatim API Docs](https://nominatim.org/release-docs/latest/api/Search/)
- [W3C Geolocation Spec](https://www.w3.org/TR/geolocation/)

## Related PRPs

- PRP-014: Geolocation Map (Completed) - Basic implementation
- PRP-016: Offline Maps (Future) - Would benefit from accurate location

## Notes

This PRP addresses feedback from initial PRP-014 implementation where desktop users reported inaccurate IP-based positioning. The hybrid approach ensures optimal experience across all platforms while maintaining battery efficiency and privacy.
