# PRP-008: Google Analytics 4 Integration - Implementation Plan

## Executive Summary

Implement a privacy-conscious Google Analytics 4 (GA4) integration that respects user consent, automatically tracks Web Vitals, and provides comprehensive event tracking capabilities. The implementation will be fully integrated with the existing consent management system from PRP-007.

## Goals & Objectives

### Primary Goals

1. **Privacy-First Analytics**: Only load GA4 after explicit user consent
2. **Web Vitals Integration**: Automatically send performance metrics to GA4
3. **Event Tracking**: Track key user interactions and behaviors
4. **Type Safety**: Full TypeScript support for all analytics functions
5. **Performance**: Zero impact when analytics consent is denied

### Success Criteria

- [ ] GA4 loads only after analytics consent granted
- [ ] Web Vitals automatically tracked to GA4
- [ ] Custom events properly categorized and tracked
- [ ] Debug mode available for development
- [ ] CSP headers updated for Google domains
- [ ] Works seamlessly with all 32 themes
- [ ] No negative impact on Lighthouse scores
- [ ] Privacy mode when consent denied

## Technical Architecture

### Component Structure

**Note**: The GoogleAnalytics component will be generated using the component generator to ensure proper 5-file structure:

```bash
docker compose exec scripthammer pnpm run generate:component
# Select: atomic
# Name: GoogleAnalytics
# Path: analytics/GoogleAnalytics
```

This will automatically create:

```
src/
├── components/
│   └── atomic/
│       └── analytics/
│           └── GoogleAnalytics/
│               ├── index.tsx                           # Barrel export
│               ├── GoogleAnalytics.tsx                 # Main component
│               ├── GoogleAnalytics.test.tsx            # Unit tests
│               ├── GoogleAnalytics.stories.tsx         # Storybook
│               └── GoogleAnalytics.accessibility.test.tsx # A11y tests
├── utils/
│   ├── analytics.ts          # GA4 utilities
│   └── web-vitals.ts         # UPDATE: GA4 integration
├── hooks/
│   └── useAnalytics.ts       # Analytics hook
└── types/
    └── analytics.types.ts    # TypeScript definitions
```

### Data Flow

1. **Consent Check**: ConsentContext provides analytics consent state
2. **Script Loading**: GoogleAnalytics component conditionally loads gtag.js
3. **Initialization**: GA4 initialized with consent mode
4. **Event Tracking**: Events sent only when consent is granted
5. **Web Vitals**: Performance metrics automatically sent to GA4

## Implementation Phases

### Phase 1: Core Infrastructure (Day 1, Hours 1-2)

- [ ] T001: Create analytics TypeScript types
- [ ] T002: Implement analytics utilities
- [ ] T003: Create useAnalytics hook
- [ ] T004: Update web-vitals integration

### Phase 2: Component Development (Day 1, Hours 2-4)

- [ ] T005: Generate GoogleAnalytics component with `pnpm run generate:component`
- [ ] T006: Implement consent-aware script loading in GoogleAnalytics.tsx
- [ ] T007: Add page view tracking with route changes
- [ ] T008: Write component tests (already created by generator)
- [ ] T009: Update Storybook stories (already created by generator)
- [ ] T010: Update accessibility tests (already created by generator)

### Phase 3: Integration (Day 1, Hours 4-5)

- [ ] T011: Update CSP headers in next.config.ts
- [ ] T012: Integrate GoogleAnalytics in app layout
- [ ] T013: Add environment configuration
- [ ] T014: Update .env.example

### Phase 4: Event Tracking (Day 1, Hours 5-6)

- [ ] T015: Add theme change tracking
- [ ] T016: Track PWA install events
- [ ] T017: Implement form submission tracking
- [ ] T018: Add error tracking

### Phase 5: Testing & Documentation (Day 1, Hours 6-8)

- [ ] T019: Integration testing with consent flow
- [ ] T020: E2E tests for GA4 loading
- [ ] T021: Performance impact testing
- [ ] T022: Update documentation

## Risk Mitigation

### Identified Risks

1. **Ad Blocker Interference**
   - **Risk**: Ad blockers prevent GA4 from loading
   - **Mitigation**: Graceful degradation, no errors thrown
   - **Implementation**: Try-catch blocks, existence checks

2. **Performance Impact**
   - **Risk**: GA4 scripts slow down page load
   - **Mitigation**: Async loading with afterInteractive strategy
   - **Implementation**: Next.js Script component optimization

3. **Privacy Compliance**
   - **Risk**: Tracking without proper consent
   - **Mitigation**: Strict consent checking, GA4 consent mode
   - **Implementation**: Integration with ConsentContext

4. **CSP Violations**
   - **Risk**: Security headers block GA4 resources
   - **Mitigation**: Properly configured CSP headers
   - **Implementation**: Update next.config.ts with Google domains

## Dependencies

### External Dependencies

- Google Analytics 4 property (must be created)
- gtag.js library (loaded from Google CDN)

### Internal Dependencies

- ConsentContext (PRP-007) ✅ Completed
- Web Vitals utilities ✅ Existing
- Next.js Script component ✅ Available

### Environment Requirements

- `NEXT_PUBLIC_GA_MEASUREMENT_ID` environment variable
- GA4 property configured in Google Analytics

## Testing Strategy

### Unit Tests

- Analytics utilities functions
- useAnalytics hook behavior
- Consent state handling

### Integration Tests

- GoogleAnalytics component with consent
- Web Vitals reporting to GA4
- Event tracking with consent changes

### E2E Tests

- GA4 loads only with consent
- Events appear in DebugView
- Page navigation tracking
- CSP compliance

### Performance Tests

- Lighthouse scores unchanged
- No blocking resources
- Async loading verification

## Rollback Plan

If issues arise:

1. Remove GoogleAnalytics from layout
2. Comment out CSP header changes
3. Web Vitals continue logging to console
4. No data dependencies to clean up

## Documentation Requirements

### User Documentation

- GA4 setup instructions in README
- Environment variable configuration
- Event tracking guide

### Developer Documentation

- Analytics hook usage examples
- Custom event implementation
- Testing with GA4 DebugView

### Inline Documentation

- JSDoc comments for all functions
- TypeScript interfaces documented
- Usage examples in comments

## Success Metrics

### Technical Metrics

- [ ] 100% test coverage for analytics code
- [ ] Zero TypeScript errors
- [ ] No CSP violations in console
- [ ] Lighthouse performance score unchanged

### Business Metrics

- [ ] GA4 receiving data when consent granted
- [ ] Web Vitals tracked for all page loads
- [ ] Custom events categorized correctly
- [ ] Real-time data visible in GA4

## Timeline

**Estimated Duration**: 6-8 hours (1 day)

- Hour 1-2: Core infrastructure
- Hour 2-4: Component development
- Hour 4-5: Integration
- Hour 5-6: Event tracking
- Hour 6-8: Testing and documentation

## Next Steps

After plan approval:

1. Generate detailed tasks.md
2. Create GA4 property if not exists
3. Begin TDD implementation
4. Regular testing in GA4 DebugView
5. Documentation as we go
