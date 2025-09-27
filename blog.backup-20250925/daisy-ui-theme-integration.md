---
title: 'DaisyUI: How 32 Pre-Built Themes Saved My Sanity'
slug: 'daisy-ui-theme-integration'
excerpt: "How I spent 73 hours building a dark mode toggle, threw it all away, and found happiness in DaisyUI's 32 pre-built themes."
author: 'TortoiseWolfe'
publishDate: 2025-10-07
status: 'published'
featured: false
categories:
  - Styling
  - Integration
  - UI
tags:
  - daisyui
  - tailwind
  - themes
  - css
  - components
readTime: 18
ogImage: '/blog-images/2025-10-07-daisy-ui-theme-integration.png'
---

# DaisyUI: How 32 Pre-Built Themes Saved My Sanity

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec scripthammer pnpm [command]`. Never run npm/pnpm directly on your host machine.

## The 73-Hour Dark Mode Disaster Before DaisyUI

It started innocently enough with a simple feature request that dropped into our project board on a Tuesday afternoon: "Add dark mode toggle." Little did I know that DaisyUI had already solved this problem with 32 pre-built themes waiting to be discovered.

How hard could it be? I'd seen a dozen tutorials and read the Tailwind docs thoroughly. Furthermore, I even had a CodePen saved somewhere titled "Perfect Dark Mode Implementation." I estimated 4 hours, or maybe 6 if I wanted to be thorough—clearly underestimating what I'd face before discovering DaisyUI.

Nollie was curled up next to my desk chair, blissfully unaware that she was about to watch me descend into CSS madness over the next three days.

## Hour 1-10: The Naive Optimism Phase Before DaisyUI

I started the way everyone starts: adding `dark:` variants to every single Tailwind class in the codebase.

```jsx
// Before
<div className="bg-white text-black border-gray-200">

// After (or so I thought)
<div className="bg-white dark:bg-gray-900 text-black dark:text-white border-gray-200 dark:border-gray-700">
```

Simple, right? Just double every class—what could go wrong?

Everything could go wrong, and it did. Moreover, this was just the beginning of problems that DaisyUI would have prevented entirely.

First, I discovered that not every element needed the same dark variant. Some grays needed to be `gray-800`, others `gray-900`, and some rebellious components looked better with `gray-850` (which doesn't even exist in Tailwind).

Then I found the components that broke completely. Shadows disappeared on dark backgrounds. Hover states became invisible. Focus rings vanished into the void. That carefully crafted gradient that looked amazing on white? It looked like a muddy mess on dark gray.

By hour 10, I had modified 147 files and the dark mode looked like someone had spilled coffee on a photocopied website.

## Hour 11-30: The CSS Variables Enlightenment

"CSS (Cascading Style Sheets) variables!" I exclaimed, startling Nollie awake. "That's what the professionals use!" However, I was about to discover that even CSS variables weren't the answer—DaisyUI was.

I spent the next 19 hours refactoring everything to use CSS custom properties:

```css
:root {
  --color-background: #ffffff;
  --color-text: #000000;
  --color-primary: #3b82f6;
  --color-secondary: #10b981;
  /* ... 47 more variables ... */
}

[data-theme='dark'] {
  --color-background: #1f2937;
  --color-text: #f9fafb;
  --color-primary: #60a5fa;
  --color-secondary: #34d399;
  /* ... 47 more variables ... */
}
```

This was better! Now I could control colors from one place. Except... I needed more than just colors. I needed different border widths in dark mode (borders need to be lighter to be visible). Different shadows. Different opacity values. Different... everything.

My CSS file grew from 2KB to 34KB. The variable names got longer and longer:

- `--color-button-primary-hover-background-dark-mode-high-contrast`
- `--shadow-card-elevated-dark-subtle-with-border`

I started having dreams about CSS variables. Nollie refused to sit near me anymore, probably because I kept muttering "var(--color-" in my sleep.

## Hour 31-50: The Component Library Fever Dream

"I need a design system," I declared to my rubber duck debugger. "A proper theming architecture with tokens and primitives and... and... atoms!"

I started building what I called "ThemeForge™" (yes, with the trademark symbol, because I was losing it).

```typescript
class ThemeForge {
  private themes: Map<string, Theme> = new Map();
  private tokens: DesignTokens;
  private primitives: ColorPrimitives;
  private surfaceElevations: ElevationSystem;

  public generateTheme(config: ThemeConfig): CompiledTheme {
    // 500 lines of theme generation logic
  }

  public interpolateColorStops(start: HSL, end: HSL, steps: number) {
    // Because I definitely needed custom color interpolation
  }

  public calculateContrastRatio(fg: Color, bg: Color): number {
    // WCAG compliance calculator that I wrote from scratch
    // Instead of using any of the 50 existing libraries
  }
}
```

I had types for everything. `ColorToken`, `SpacingToken`, `TypographyToken`, `ShadowToken`, `BorderToken`, `AnimationToken`. I had a token for tokens (`TokenToken`, I'm not proud of this).

By hour 45, I had built a theme system so complex that I needed documentation just to remember how to change a button color. The dark mode worked, technically, but adding a new component required updating 17 different files and running a "theme compilation" step that took 30 seconds.

## Hour 51-73: The Existential Crisis Before Finding DaisyUI

At hour 51, something broke. Not in the code – in me.

I was staring at my screen, trying to figure out why the dark mode toggle animation was janky on Safari but smooth on Chrome, when I had a moment of clarity. Or maybe it was exhaustion-induced hallucination. Either way, I asked myself:

"What am I doing with my life?"

I had spent three full days – 73 actual hours – building a toggle that switched between light and dark. That's it. Not curing cancer. Not solving climate change. Not even building a cool feature. Just... making backgrounds dark and text light.

I looked at my git history:

- 234 commits
- 147 files changed
- 8,924 lines added
- 2,341 lines deleted
- 1 developer questioning their career choices

Nollie walked over and put her head on my knee, giving me that look dogs give you when they know you need comfort but they're not sure why you're upset about the glowing rectangle.

## The DaisyUI Discovery That Changed Everything

It was hour 74. I was googling "career change from developer to sheep farmer" when I stumbled upon a Hacker News comment:

> "Why are you building your own theme system? Just use DaisyUI. It has 32 themes built-in."

Thirty-two themes? Built-in?

I clicked the link with the skepticism of someone who had been hurt before. The DaisyUI documentation loaded, and there it was. A theme switcher demo. Click "Dark" – instant dark mode. Click "Cyberpunk" – neon colors everywhere. Click "Retro" – suddenly it's 1985.

```bash
## The entire DaisyUI "integration"
docker compose exec scripthammer pnpm add -D daisyui@latest
```

Then add it to your Tailwind config:

```javascript
// tailwind.config.js
module.exports = {
  plugins: [require('daisyui')],
  daisyui: {
    themes: true, // true = all 32 themes
  },
};
```

That's it. That's the whole setup.

I sat there, staring at my screen. Three days of work. Eight thousand lines of code. My revolutionary ThemeForge™ system. All replaced by two commands and three lines of config.

I did what any rational developer would do. I created a new branch called `burn-it-all`, deleted everything I had built, and integrated DaisyUI in about 10 minutes.

## The 32 Themes You Get for Free

Here's what blew my mind. DaisyUI doesn't just give you dark mode. It gives you THIRTY-TWO complete themes. Each one is professionally designed, fully accessible, and actually looks good.

Want to see them all in action? Go to our [Theme Switcher](/themes) right now. Try them. All of them:

## The Classic DaisyUI Themes

- **Light** - Clean and professional
- **Dark** - Easy on the eyes
- **Cupcake** - Soft and friendly
- **Bumblebee** - Bright and cheerful
- **Emerald** - Natural and calming
- **Corporate** - Serious business
- **Synthwave** - Welcome to the '80s
- **Retro** - Vintage computing vibes

## The Bold DaisyUI Themes

- **Cyberpunk** - Neon-soaked future
- **Valentine** - Romance mode activated
- **Halloween** - Spooky season all year
- **Garden** - Fresh and organic
- **Forest** - Deep and mysterious
- **Aqua** - Ocean depths
- **Lofi** - Chill and minimal
- **Pastel** - Soft and dreamy

## The Professional DaisyUI Theme Set

- **Fantasy** - Elegant and magical
- **Wireframe** - Back to basics
- **Black** - Ultimate dark mode
- **Luxury** - Gold and gorgeous
- **Dracula** - Code in style
- **CMYK** - Print-inspired
- **Autumn** - Warm and cozy
- **Business** - Get stuff done

## The Unique DaisyUI Themes

- **Acid** - Bold and different
- **Lemonade** - Fresh and zesty
- **Night** - Deep space dark
- **Coffee** - Brew-tiful browns
- **Winter** - Cool and crisp
- **Dim** - Subtle dark
- **Nord** - Scandinavian style
- **Sunset** - Golden hour forever

Each theme automatically handles:

- All color variations
- Hover states
- Focus states
- Disabled states
- Component styling
- Semantic colors
- Contrast ratios
- Everything else I spent 73 hours trying to build

## How the Magic Actually Works

DaisyUI uses CSS variables (like I was trying to do), but it does it RIGHT. Here's the secret sauce:

```css
/* DaisyUI defines semantic colors */
[data-theme='dark'] {
  --p: 259 94% 51%; /* Primary */
  --pf: 259 94% 41%; /* Primary focus */
  --pc: 0 0% 100%; /* Primary content */

  --s: 314 100% 47%; /* Secondary */
  --sf: 314 100% 37%; /* Secondary focus */
  --sc: 0 0% 100%; /* Secondary content */

  --a: 174 60% 51%; /* Accent */
  --n: 219 14% 28%; /* Neutral */
  --b1: 0 0% 9%; /* Base 100 */
  --b2: 0 0% 7%; /* Base 200 */
  --b3: 0 0% 5%; /* Base 300 */

  /* And 20+ more... */
}
```

But here's the genius part – you never see these variables. You use semantic class names:

```jsx
// Instead of this nightmare:
<button className="bg-blue-500 hover:bg-blue-600 text-white dark:bg-blue-400 dark:hover:bg-blue-500 dark:text-gray-900">

// You write this:
<button className="btn btn-primary">

// And it works in all 32 themes!
```

Want to see this in action? Open up [Storybook](http://localhost:6006) and play with the theme selector in the toolbar. Watch how every component adapts perfectly to each theme. No dark: variants. No conditional classes. Just... working.

## The Components That Just Work

This is what made me weep with joy. DaisyUI doesn't just handle colors. It provides complete component styling that adapts to every theme:

## Buttons That Actually Look Like Buttons with DaisyUI

```jsx
// All of these work in all 32 themes
<button className="btn">Default</button>
<button className="btn btn-primary">Primary</button>
<button className="btn btn-secondary">Secondary</button>
<button className="btn btn-accent">Accent</button>
<button className="btn btn-ghost">Ghost</button>
<button className="btn btn-link">Link</button>
<button className="btn btn-outline">Outline</button>
<button className="btn btn-error">Error</button>
<button className="btn btn-warning">Warning</button>
<button className="btn btn-success">Success</button>
```

Check them out in our [Button Storybook](http://localhost:6006/?path=/story/atomic-button--all-variants). Switch themes in the toolbar. Watch them transform. No CSS written. Zero. Nada.

## Cards That Adapt to Any DaisyUI Theme

```jsx
<div className="card bg-base-100 shadow-xl">
  <div className="card-body">
    <h2 className="card-title">I work everywhere!</h2>
    <p>Seriously, try me in any theme.</p>
    <div className="card-actions justify-end">
      <button className="btn btn-primary">Magic</button>
    </div>
  </div>
</div>
```

See it live in our [Card Stories](http://localhost:6006/?path=/story/atomic-card--default). The shadows adjust. The backgrounds adapt. The borders know what to do. It's almost unsettling how well it works.

## Forms That Don't Make You Cry Thanks to DaisyUI

```jsx
<input type="text" placeholder="Type here" className="input input-bordered" />
<select className="select select-bordered">
  <option>Pick a theme</option>
  <option>Any theme</option>
  <option>They all work</option>
</select>
<textarea className="textarea textarea-bordered" placeholder="Bio"></textarea>
```

Visit our [Contact Form](/contact) and switch themes while you're there. The form remains perfectly usable in every single theme. Even the focus states are theme-aware!

## The ScriptHammer Implementation

Here's how we integrated DaisyUI into ScriptHammer, and how you can see it in action:

## Step 1: The DaisyUI Config (All of It)

```javascript
// tailwind.config.ts
import daisyui from 'daisyui';

export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  plugins: [daisyui],
  daisyui: {
    themes: true, // All 32 themes enabled
    logs: false, // No console spam
  },
};
```

That's the entire configuration. I'm not hiding anything. There's no secret sauce. It just works.

## Step 2: The DaisyUI Theme Switcher

We built a theme switcher component that you can see at [/themes](/themes):

```typescript
// src/components/ThemeSelector.tsx
export function ThemeSelector() {
  const [theme, setTheme] = useState('light');

  const themes = [
    'light', 'dark', 'cupcake', 'bumblebee', 'emerald',
    'corporate', 'synthwave', 'retro', 'cyberpunk',
    // ... all 32
  ];

  const applyTheme = (themeName: string) => {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('theme', themeName);
    setTheme(themeName);
  };

  return (
    <select
      className="select select-bordered"
      value={theme}
      onChange={(e) => applyTheme(e.target.value)}
    >
      {themes.map(t => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  );
}
```

That's it. No CSS. No complex state management. No ThemeForge™. Just a select dropdown that changes one data attribute.

## Step 3: Using DaisyUI Everywhere

Now every component in ScriptHammer just uses DaisyUI classes:

```jsx
// Navigation
<nav className="navbar bg-base-100 shadow-lg">
  <a className="btn btn-ghost text-xl">ScriptHammer</a>
</nav>

// Hero Section
<div className="hero min-h-screen bg-base-200">
  <div className="hero-content text-center">
    <h1 className="text-5xl font-bold">Hello there</h1>
    <p className="py-6">I look good in every theme!</p>
  </div>
</div>

// Stats
<div className="stats shadow">
  <div className="stat">
    <div className="stat-title">Total Themes</div>
    <div className="stat-value">32</div>
    <div className="stat-desc">Zero CSS written</div>
  </div>
</div>
```

Want proof? Navigate to ANY page in ScriptHammer:

- [Homepage](/)
- [Blog](/blog)
- [Status Dashboard](/status)
- [Contact](/contact)

Now open the theme switcher and try different themes. Everything adapts. Every page. Every component. Every interaction.

## The Numbers That Made Me Cry (Happy Tears)

Let me show you the before and after:

## Before DaisyUI (My 73-Hour Nightmare)

```
Files changed:        147
Lines of CSS:         8,924
Custom variables:     127
Theme objects:        1 (broken)
Themes available:     2 (light and "dark")
Developer sanity:     0%
Time invested:        73 hours
Nollie's patience:    Exhausted
```

## After DaisyUI (10 Minutes of Setup)

```
Files changed:        2 (tailwind.config.ts, package.json)
Lines of CSS:         0
Custom variables:     0
Theme objects:        0
Themes available:     32 (all working perfectly)
Developer sanity:     100%
Time invested:        10 minutes
Nollie's tail wags:   Continuous
```

## The Real Impact of DaisyUI

But here's what really matters. Since integrating DaisyUI:

- **Design consistency**: 100% (impossible to make inconsistent components)
- **Theme requests handled**: 17 (just added them to the dropdown)
- **CSS bugs filed**: 0 (there's no CSS to bug)
- **Hours saved per week**: 15+
- **Developer happiness**: 📈

## The Features I Didn't Know I Needed

## Semantic Colors That Make Sense in DaisyUI

Instead of memorizing that `blue-500` is your primary color, you use semantic names:

```jsx
// These adapt to every theme
<div className="bg-primary text-primary-content">
  Primary background with readable text
</div>
<div className="bg-secondary text-secondary-content">
  Secondary background with readable text
</div>
<div className="bg-accent text-accent-content">
  Accent background with readable text
</div>
```

The `primary` in cyberpunk theme is hot pink. In corporate theme, it's blue. In halloween theme, it's orange. Your components don't care – they just work.

## Focus States That Are Actually Visible with DaisyUI

Remember spending hours tweaking focus rings for accessibility? DaisyUI handled it:

```jsx
<button className="btn btn-primary">
  Tab to me - I have a proper focus state in every theme!
</button>
```

Try it yourself. Go to any page, hit Tab, and watch the focus indicators. They're visible in every theme, properly contrasted, and actually helpful.

## Component States That Just Make Sense in DaisyUI

```jsx
// Loading button
<button className="btn loading">Loading</button>

// Disabled button (properly styled in every theme)
<button className="btn" disabled>Disabled</button>

// Button with badge
<button className="btn">
  Inbox
  <div className="badge badge-secondary">+99</div>
</button>
```

See all the states in our [Button Storybook](http://localhost:6006/?path=/story/atomic-button--all-states). No custom CSS for any of it.

## The Gotchas That Weren't

I kept waiting for the catch. The limitation. The "oh, but you can't..." moment. It never came.

**"But what if I need custom colors?"**
You can override any CSS variable:

```css
[data-theme='custom'] {
  --p: 184 80% 50%; /* Your custom primary */
}
```

**"But what if I need a component DaisyUI doesn't have?"**
You build it with Tailwind classes. DaisyUI doesn't prevent you from using Tailwind.

**"But what about performance?"**
DaisyUI adds about 5KB gzipped to your CSS. My ThemeForge™ monstrosity was 34KB.

**"But what about—"**
It works. It just works. Stop overthinking it like I did.

## The Lessons I Learned (The Hard Way)

## DaisyUI Lesson 1: You're Not Special

Your app doesn't need a custom theme system. It doesn't. I promise. Those 73 hours I spent? I was solving a solved problem. DaisyUI exists because hundreds of developers already solved this.

## DaisyUI Lesson 2: Semantic > Specific

```jsx
// Bad (specific colors)
<button className="bg-blue-500 hover:bg-blue-600">

// Good (semantic meaning)
<button className="btn btn-primary">
```

The second button can be blue in one theme, pink in another, green in a third. The semantic meaning (primary action) remains constant.

## DaisyUI Lesson 3: Constraints Are Freedom

32 themes feels like a constraint until you realize it's freedom from decision fatigue. Users can pick their favorite. You don't have to design it.

## Your Turn: Add DaisyUI in 10 Minutes

Ready to save yourself 73 hours? Here's how:

## Step 1: Install DaisyUI

```bash
docker compose exec scripthammer pnpm add -D daisyui@latest
```

## Step 2: Add DaisyUI to Tailwind Config

```javascript
// tailwind.config.js
module.exports = {
  plugins: [require('daisyui')],
  daisyui: {
    themes: true,
  },
};
```

## Step 3: Start Using DaisyUI

```jsx
<button className="btn btn-primary">I'm themed!</button>
```

## Step 4: Add DaisyUI Theme Switcher

```jsx
<select
  onChange={(e) =>
    document.documentElement.setAttribute('data-theme', e.target.value)
  }
>
  <option value="light">Light</option>
  <option value="dark">Dark</option>
  {/* Add all 32 if you want */}
</select>
```

That's it. You're done. Go walk your dog. Spend time with family. Build actual features. Live your life.

## The Bottom Line

I spent 73 hours building a broken dark mode toggle. DaisyUI gave me 32 complete themes in 10 minutes.

I wrote 8,924 lines of CSS. DaisyUI required 0.

I created 127 custom CSS variables. DaisyUI just worked.

I built ThemeForge™. DaisyUI built something people actually use.

ScriptHammer ships with all 32 DaisyUI themes. Check them out at [/themes](/themes). Try them on any page. Watch your components adapt perfectly. Then thank yourself for not spending 73 hours building your own theme system.

Because life's too short to write CSS variables for dark mode.

And Nollie deserves more walks instead of watching me debug theme calculations.

---

_P.S. - I kept the git branch with my 73-hour theme system. Sometimes I look at it to remind myself that just because you CAN build something doesn't mean you SHOULD._

_P.P.S. - ThemeForge™ is not actually trademarked. Please don't build it. Use DaisyUI. Save yourself._

_P.P.P.S. - Nollie is much happier now that I'm not muttering about CSS variables in my sleep. She actually sits by my desk again._
