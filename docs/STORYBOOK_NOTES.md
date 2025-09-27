# Storybook Setup Notes

## Current Status

Using Storybook 9.1.5 with Next.js 15.5

## Temporarily Removed Packages (Incompatible with Storybook 9.1.5)

The following packages are still on version 8.6.14 and cause build errors with Storybook 9.1.5:

### Removed Packages:

1. **@storybook/addon-essentials** (8.6.14)
   - **Missing features:**
     - Controls addon (for live prop editing)
     - Actions addon (for logging callbacks)
     - Backgrounds addon (for background color switching)
     - Viewport addon (for responsive testing)
     - Toolbars addon (for custom toolbars)
     - Measure addon (for measuring components)
     - Outline addon (for component boundaries)
     - Highlight addon (for highlighting elements)

2. **@storybook/addon-interactions** (8.6.14)
   - **Missing features:**
     - Interactive testing in Storybook UI
     - Play functions for automated interactions
     - Step-by-step debugging

3. **@storybook/blocks** (8.6.14)
   - **Missing features:**
     - Pre-built documentation blocks
     - MDX story components
     - Auto-generated prop tables

4. **@storybook/test** (8.6.14)
   - **Missing features:**
     - Built-in testing utilities
     - Vitest integration
     - Testing-library utilities

## What's Still Working:

- ✅ Basic Storybook UI
- ✅ Story rendering
- ✅ Next.js integration
- ✅ Documentation generation (@storybook/addon-docs)
- ✅ Component linking (@storybook/addon-links)
- ✅ Onboarding experience (@storybook/addon-onboarding)
- ✅ Chromatic integration for visual testing

## Workarounds:

- **Controls**: Edit props directly in story files for now
- **Viewport**: Use browser dev tools for responsive testing
- **Actions**: Use console.log for callback debugging
- **Testing**: Run tests separately with Jest/Vitest

## When to Re-add:

Check periodically if these packages have been updated to 9.x:

```bash
npm view @storybook/addon-essentials dist-tags.latest
npm view @storybook/addon-interactions dist-tags.latest
npm view @storybook/blocks dist-tags.latest
npm view @storybook/test dist-tags.latest
```

Once they reach 9.x, add them back to package.json and .storybook/main.ts
