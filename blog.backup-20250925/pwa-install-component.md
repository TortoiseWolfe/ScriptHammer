---
title: 'PWA Install: The App Store Escape Route'
slug: 'pwa-install-component'
excerpt: 'Turn browsers into believers with installable web apps.'
author: 'TortoiseWolfe'
publishDate: 2025-10-25
status: 'published'
featured: false
categories:
  - PWA
  - Components
  - Mobile
tags:
  - pwa
  - install
  - mobile
  - offline
  - app
readTime: 7
ogImage: '/blog-images/2025-10-25-pwa-install-component.png'
---

# PWA Install: The App Store Escape Route

> 🐳 **Docker First**: ScriptHammer is a Docker-first project. All commands should be run with `docker compose exec scripthammer pnpm [command]`. Never run npm/pnpm directly on your host machine.

## The App Store Prison 🔒

**Apple**: 30% of your revenue, 2-week review process
**Google**: 30% cut, arbitrary rejections
**Users**: "I don't want to install another app"

There's another way.

## The PWA Install Prompt ✨

```tsx
<InstallPrompt>
  {({ prompt, install, dismiss }) => (
    <Banner show={prompt}>
      <Icon>📱</Icon>
      <Text>Install ScriptHammer for offline access</Text>
      <Button onClick={install}>Install</Button>
      <Button onClick={dismiss} variant="ghost">
        Not now
      </Button>
    </Banner>
  )}
</InstallPrompt>

// Shows at the perfect moment
// Not annoying
// Actually useful
```

## The Smart Timing ⏰

```tsx
// Don't show immediately (annoying)
// Don't wait forever (missed opportunity)

const showInstallPrompt = () => {
  const triggers = [
    userReturnVisit >= 3,
    timeOnSite > 120, // seconds
    completedAction === true,
    offlineAttempt === true,
  ];

  return triggers.filter(Boolean).length >= 2;
};

// Show when they actually want it
```

## Platform-Specific Magic 🎯

```tsx
<InstallInstructions platform={detectPlatform()}>
  {platform === 'iOS' && (
    <SafariInstructions>
      1. Tap Share button ↗️ 2. Tap "Add to Home Screen" 3. Tap "Add"
    </SafariInstructions>
  )}

  {platform === 'Android' && (
    <ChromeInstructions>Just tap "Install" above!</ChromeInstructions>
  )}

  {platform === 'Desktop' && (
    <DesktopInstructions>Click install icon in address bar</DesktopInstructions>
  )}
</InstallInstructions>
```

## The Manifest That Matters 📋

```json
{
  "name": "ScriptHammer",
  "short_name": "Hammer",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#000000",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "purpose": "maskable any"
    }
  ],
  "shortcuts": [
    {
      "name": "New Post",
      "url": "/blog/new"
    }
  ]
}
```

## The Offline Experience 📴

```tsx
// Service worker handles everything
self.addEventListener('fetch', (event) => {
  // Offline? No problem
  if (!navigator.onLine) {
    event.respondWith(
      caches.match(event.request) ||
        new Response('Offline mode - cached content only')
    );
  }
});

// Users: "It works on the plane!"
// You: "That's the point"
```

## The Native Features 📱

```tsx
<PWAFeatures>
  <ShareTarget /> {/* Receive shared content */}
  <FilePicker /> {/* Access device files */}
  <Camera /> {/* Take photos */}
  <Notifications /> {/* Push notifications */}
  <BadgeCount /> {/* App icon badges */}
</PWAFeatures>

// "This feels like a real app"
// It IS a real app
```

## The Update Flow 🔄

```tsx
<UpdatePrompt>
  {({ updateAvailable, update, dismiss }) => (
    <Toast show={updateAvailable}>
      <Text>New version available!</Text>
      <Button onClick={update}>Update now</Button>
      <Link onClick={dismiss}>What's new?</Link>
    </Toast>
  )}
</UpdatePrompt>

// No app store approval needed
// Push updates instantly
// Users always on latest version
```

## The Analytics That Prove It 📊

```tsx
<InstallAnalytics>
  <Metric name="Install prompts shown" value={1234} />
  <Metric name="Installations" value={456} />
  <Metric name="Install rate" value="37%" />
  <Metric name="Retention (installed)" value="89%" />
  <Metric name="Retention (web)" value="34%" />
</InstallAnalytics>

// Installed users are 3x more engaged
```

## The Business Case 💼

**App Store Route**:

- Development: $100k (iOS + Android)
- Maintenance: $30k/year
- Store fees: 30% forever
- Update approval: 2+ weeks

**PWA Route**:

- Development: $30k (one codebase)
- Maintenance: $10k/year
- Store fees: $0
- Update approval: Instant

## The Success Stories 🏆

**Twitter Lite**: 65% increase in pages/session
**Pinterest**: 60% increase in engagement
**Starbucks**: 2x daily active users

Your app could be next.

## Start Your PWA Journey

```bash
docker compose exec scripthammer pnpm generate:component PWAInstall
```

Skip the app stores.
Keep your users.
Keep your revenue.

The web is the platform.
