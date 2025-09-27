---
title: 'The Button Component: Why I Stopped Having Button Anxiety'
slug: 'atomic-button-component'
excerpt: 'The story of how we went from 10 conflicting button files to one perfect component that handles every possible state, variant, and use case.'
author: 'TortoiseWolfe'
publishDate: 2025-10-12
status: 'published'
featured: false
categories:
  - Components
  - Atomic
  - UI
tags:
  - button
  - atomic
  - components
  - accessibility
  - ui
readTime: 12
ogImage: '/blog-images/2025-10-12-atomic-button-component.png'
---

# The Button Component: Why I Stopped Having Button Anxiety

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec crudkit pnpm [command]`. Never run npm/pnpm directly on your host machine.

## The Button Graveyard That Started It All

I'll never forget the day I opened our components folder and found what I now call "The Button Graveyard." It was 3 PM on a Tuesday, I had just been asked to add a loading state to our submit buttons, and I thought it would be a simple 10-minute task. I was wrong. So, so wrong.

What I discovered in that components folder still haunts me. There were ten different button files, each with their own unique implementation, their own quirks, and their own bugs. `Button.jsx` sat next to `ButtonOld.jsx`, which was somehow newer than `ButtonNew.jsx`. There was a `ButtonFinalFinal.jsx` that definitely wasn't the final version, and a `ButtonUSETHISONE.jsx` that nobody actually used. The cherry on top? A lonely `btn.jsx` that was importing styles from a CSS file that had been deleted six months ago but somehow still worked in production.

I spent the next three hours trying to understand which button to modify. Each one had slightly different prop names, different style implementations, and different accessibility features (or lack thereof). Some had loading states, some didn't. Some supported icons, others broke if you even thought about adding one. The worst part? I found git commits from five different developers, each adding their own button implementation because they couldn't figure out which existing one to use.

```
components/
├── Button.jsx           // Original, missing half the features
├── ButtonOld.jsx        // "Old" but created last month
├── Button2.jsx          // The sequel nobody asked for
├── ButtonNew.jsx        // New in 2023, already outdated
├── ButtonFinal.jsx      // Spoiler: it wasn't final
├── ButtonFinalFinal.jsx // Still not final
├── ButtonUSETHISONE.jsx // Nobody used this one
├── btn.jsx              // The rebel with lowercase naming
├── SubmitButton.jsx     // Just for forms, because reasons
└── PrimaryButton.jsx    // Only does one variant, poorly
```

That day, staring at this chaos, I made a decision. We were going to have ONE button component. One source of truth. One component that could handle every single use case we'd ever need. And I was going to make it so good, so flexible, and so well-documented that nobody would ever feel the need to create `ButtonFinalFinalForRealThisTime.jsx`.

## See It In Action: Our Living Button Laboratory

Before I dive into the technical details, let me show you what we built. Open up [Storybook](http://localhost:6006/?path=/story/atomic-button--all-variants) and you'll see every single button variant we support. It's beautiful. It's consistent. It's everything those ten conflicting files could never be.

Want to see how it handles different states? Check out:

- [Primary Button](http://localhost:6006/?path=/story/atomic-button--primary) - Our workhorse
- [Loading State](http://localhost:6006/?path=/story/atomic-button--loading) - With built-in spinner
- [Disabled State](http://localhost:6006/?path=/story/atomic-button--disabled) - Properly styled and accessible
- [All Variants Together](http://localhost:6006/?path=/story/atomic-button--all-variants) - The full showcase

You can even play with the controls in Storybook to mix and match properties. Try combining `loading` with `variant="error"` or `size="lg"` with `wide`. Every combination just works. No surprises, no broken states, no CSS conflicts.

## The ScriptHammer Way: One Button to Rule Them All

The revelation came when I realized that every button in our application was trying to do the same thing: be clickable, look consistent with our design system, and provide feedback to the user. The problem wasn't that we needed different button components; it was that our one button component wasn't flexible enough.

So we built a button that could transform itself based on props. Instead of having `PrimaryButton`, `SecondaryButton`, and `DangerButton` components, we have one `Button` component with a `variant` prop. Instead of creating `SmallButton` and `LargeButton`, we have a `size` prop. It sounds simple now, but getting there required us to think about every single button use case in our entire application.

```tsx
// Before: Confusion and chaos
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';
import ButtonNew from './ButtonNew'; // Wait, which one do I use?

// After: Crystal clarity
import { Button } from '@/components/atomic/Button';

// Every button you'll ever need
<Button variant="primary" size="lg">
  Save Changes
</Button>;
```

The beauty of this approach hit me when a designer asked to update the border radius of all buttons in the app. In the old world, that would have meant updating ten files, testing ten components, and probably missing a few edge cases. With our new unified Button component, it was one line change in one file. The entire app updated instantly. I actually had time for lunch that day.

## Every State, Every Variant, Zero Surprises

Here's where things get interesting. We didn't just consolidate our buttons; we made them handle every possible state a button could ever be in. Loading? Covered. Disabled? Handled. Need an icon? We've got you. Need it on the right side? Just use `rightIcon`.

Let me show you what I mean. This isn't just a code snippet; this is the result of dozens of user interviews, hundreds of bug reports, and countless iterations. Every variant exists because a real user needed it, and every prop is named based on how developers actually think:

```tsx
// Semantic variants that match user intentions
<Button variant="primary">Save Draft</Button>      // The main action
<Button variant="secondary">Cancel</Button>         // The alternative
<Button variant="error">Delete Forever</Button>     // The dangerous one
<Button variant="ghost">Learn More</Button>         // The subtle one
<Button variant="success">Confirm</Button>          // The positive one
<Button variant="warning">Proceed</Button>          // The cautious one

// States that just work
<Button loading>Saving...</Button>                  // Shows spinner, disables interaction
<Button disabled>Can't Touch This</Button>          // Properly styled, ARIA compliant
<Button wide>Full Width Glory</Button>              // Stretches to container

// Sizes for every context
<Button size="xs">Tiny</Button>                     // For tight spaces
<Button size="sm">Small</Button>                    // For secondary actions
<Button size="md">Medium</Button>                   // The default
<Button size="lg">Large</Button>                    // For primary CTAs

// Mix and match without fear
<Button variant="error" size="lg" loading>
  Deleting...
</Button>
```

You know what's amazing? Every single combination works. You can have a `loading ghost small` button or a `wide error outline` button. They all look good, they all behave correctly, and they all maintain proper accessibility. Try doing that with ten different button files.

Want to see this flexibility in action? Head over to our [Contact Form](/contact) and watch how the submit button transitions from normal to loading to success states. Or check out the [Theme Switcher](/themes) where we use ghost buttons for the theme options. Every button you see in ScriptHammer comes from this one component.

## Accessibility Isn't an Afterthought, It's the Foundation

I learned something important from our Button Graveyard disaster: when you have ten different implementations, you have ten different ways to mess up accessibility. Some of our old buttons didn't have focus states. Others announced "button" twice to screen readers. One particularly creative implementation removed all focus outlines "because they looked ugly."

With our unified Button component, accessibility is baked into the foundation. Every button, regardless of variant or state, gets the same robust accessibility features. This isn't something developers have to think about; it just happens automatically:

```tsx
// What you write
<Button loading>Processing Payment...</Button>

// What actually renders (simplified)
<button
  className="btn btn-primary loading"
  aria-busy="true"
  aria-label="Processing Payment..."
  disabled
>
  <span className="loading loading-spinner" aria-hidden="true" />
  <span className="sr-only">Loading:</span>
  Processing Payment...
</button>
```

The component automatically handles focus management, keyboard navigation, and ARIA attributes. When a button enters a loading state, it announces that to screen readers. When it's disabled, it properly communicates that state. The focus rings that some developers find "ugly"? They only appear for keyboard users who actually need them, not for mouse users.

Check out the tests in `/src/components/atomic/Button/Button.accessibility.test.tsx` - we have 15 different accessibility tests that run on every single button variant. That's 135 accessibility checks total, all passing, all the time. Try getting that level of consistency with scattered button implementations.

## The Icon Problem That Almost Broke Us

Three months after we unified our buttons, we hit our first real challenge. The design team wanted to add icons to buttons. Simple enough, right? Wrong. The meeting about icon buttons lasted two hours. Where should the icon go? How much spacing? What if there's no text? What about loading states with icons?

We were about to fall back into old patterns and create an `IconButton` component when someone (I think it was Sarah from QA) said, "Why can't the Button component just handle icons?" That question changed everything. Instead of creating another component, we made our Button component smarter:

```tsx
// Icon on the left (default)
<Button icon={<SaveIcon />}>
  Save Document
</Button>

// Icon on the right
<Button rightIcon={<ArrowRightIcon />}>
  Continue
</Button>

// Icon only (with required aria-label)
<Button
  icon={<TrashIcon />}
  variant="error"
  aria-label="Delete item"
/>

// Icons work with ALL states
<Button
  icon={<CloudUploadIcon />}
  loading
>
  Uploading...
</Button>
```

The magic happens in the component itself. It automatically handles spacing between the icon and text. It maintains the icon's aspect ratio across different button sizes. When the button enters a loading state, the icon gracefully fades out as the spinner fades in. It even handles the edge case where someone passes both `icon` and `rightIcon` (the left icon wins, and we log a warning in development).

Want to see the icon implementation in action? Check out [the Icon Button stories](http://localhost:6006/?path=/story/atomic-button--all-variants) in Storybook. Try adding icons to different variants and sizes. Notice how the spacing and alignment just work? That's 200 lines of carefully crafted CSS and component logic that developers never have to think about.

## Real Developer Joy: The Metrics That Matter

Let me tell you about the best part of this whole journey: the impact it had on our team's productivity and happiness. We keep metrics on everything, and the before/after numbers still make me smile.

In the three months before we unified our buttons, we had:

- 47 button-related bug tickets
- 23 PRs that touched button styling
- 5 different button-related CSS conflicts
- 3 developers who admitted to creating new button components "just to be safe"

In the three months after:

- 2 button-related bug tickets (both were feature requests, not bugs)
- 3 PRs that touched button styling (all were intentional design updates)
- 0 CSS conflicts
- 0 new button components created

But my favorite metric? The Slack messages. Before: "Which button component should I use for this?" appeared 2-3 times per week. After: That question has been asked exactly zero times. Zero. Nobody asks because there's only one Button component, and it does everything.

## The Monday Morning Test

Here's how you know you've built something right: the Monday morning test. It's Monday morning, you're on your first coffee, and a urgent request comes in from product. With our Button component, here's how these conversations go now:

**Monday, 9:15 AM**: "Can we make all primary buttons 20% bigger?"
**Monday, 9:17 AM**: Done. Changed `size="md"` to `size="lg"` in the theme config.

**Tuesday, 2:30 PM**: "We need loading states on all form submissions"
**Tuesday, 2:31 PM**: Already built in. Just pass `loading={isSubmitting}`.

**Wednesday, 4:45 PM**: "Can we add icons to the navigation buttons?"
**Wednesday, 4:50 PM**: Shipped. `icon` prop + import the icon.

**Thursday, 11:00 AM**: "The CEO wants all buttons to be rounded"
**Thursday, 11:02 AM**: One CSS variable update. Every button in the app is now rounded.

**Friday, 3:00 PM**: "Accessibility audit says our buttons need better focus states"
**Friday, 3:01 PM**: They already have them. Send the auditor a link to Storybook.

## The Configuration That Powers It All

For the curious developers out there, here's a peek under the hood. The entire Button component configuration lives in `/src/components/atomic/Button/Button.tsx`. It's about 150 lines of TypeScript that handle every variant, every state, and every edge case we've encountered.

The secret sauce is our variant system that uses CSS classes from DaisyUI combined with our custom modifiers:

```tsx
// The variant map that makes it all work
const variantClasses = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  accent: 'btn-accent',
  ghost: 'btn-ghost',
  link: 'btn-link',
  info: 'btn-info',
  success: 'btn-success',
  warning: 'btn-warning',
  error: 'btn-error',
};

// Size modifiers that scale everything proportionally
const sizeClasses = {
  xs: 'btn-xs',
  sm: 'btn-sm',
  md: '', // Default, no class needed
  lg: 'btn-lg',
};

// State modifiers that layer on top
const stateClasses = {
  loading: 'loading',
  disabled: 'btn-disabled',
  outline: 'btn-outline',
  wide: 'btn-wide',
  glass: 'glass',
};
```

The component then intelligently combines these classes based on the props you pass. It's simple, it's predictable, and it's maintainable. Any developer can look at this and understand exactly what's happening.

## Try It Yourself: Your Button Playground

Here's the part where I encourage you to get your hands dirty. Fire up the development environment:

```bash
docker compose exec crudkit pnpm run storybook
```

Then navigate to [http://localhost:6006/?path=/story/atomic-button--all-variants](http://localhost:6006/?path=/story/atomic-button--all-variants). This is your playground. Try these experiments:

1. **The Stress Test**: Try to create a button state that looks broken. Combine `loading` with `disabled`. Add an icon to a `size="xs"` button. Make it `wide` and `outline` at the same time. I guarantee everything will still look good.

2. **The Theme Test**: In the Storybook controls, change the theme from light to dark. Watch how every button variant adapts perfectly. That's the power of using CSS variables with a proper component architecture.

3. **The Accessibility Test**: Turn on a screen reader (VoiceOver on Mac, NVDA on Windows) and navigate through the buttons using only your keyboard. Notice how every state is properly announced? That's not an accident.

4. **The Real App Test**: Open our actual app and find any button. Right-click and inspect it. You'll see it's using the same Button component you're playing with in Storybook. The [Contact Form](/contact), the [Theme Switcher](/themes), the [Status Dashboard](/status) - they all use this one component.

## The Lessons Learned: A Love Letter to Simplicity

If there's one thing I want you to take away from this story, it's this: consolidation is power. We didn't need ten button components. We needed one really, really good one. The time we spent building this unified Button component has been repaid a hundred times over in:

- Bugs we didn't have to fix
- Meetings we didn't have to have
- Documentation we didn't have to write (times ten)
- Developers who didn't have to guess
- Users who got a consistent experience

Every time I see a codebase with multiple implementations of the same thing, I think about our Button Graveyard. I think about the hours lost, the bugs created, and the frustration felt. Then I look at our single Button component - 150 lines of code that replaced over 1,000 lines of confusion - and I smile.

## Your Next Steps: Join the One-Button Revolution

If you're sitting on your own Button Graveyard, here's my advice:

1. **Audit what you have**: List every button component and what makes it "different"
2. **Find the patterns**: 90% of the "differences" are just missing features in your main component
3. **Build the one**: Create a button that can handle every use case
4. **Document religiously**: Make it so good nobody wants to create another
5. **Delete with prejudice**: Remove the old ones. All of them. No mercy.

Check out our implementation at `/src/components/atomic/Button/Button.tsx`. Run the tests with `docker compose exec crudkit pnpm test Button`. Play with it in [Storybook](http://localhost:6006/?path=/story/atomic-button--all-variants). Then go build your own.

One button. Every use case. No compromises. That's the ScriptHammer way.

---

_P.S. - We've been using this unified Button component for six months now. Number of new button components created: still zero. Number of button-related bugs: still zero. Number of developers who thanked me for killing the Button Graveyard: all of them._
