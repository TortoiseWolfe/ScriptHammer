# 🔨 ScriptHammer

> Project planning template with SpecKit specifications and interactive wireframe viewer. Forked from [FirstFrame](https://github.com/TortoiseWolfe/First-Frame).

## 📋 Wireframe Commands (28 features)

### Foundation
```
/wireframe features/foundation/000-rls-implementation/spec.md
```
```
/wireframe features/foundation/001-wcag-aa-compliance/spec.md
```
```
/wireframe features/foundation/002-cookie-consent/spec.md
```
```
/wireframe features/foundation/003-user-authentication/spec.md
```
```
/wireframe features/foundation/005-security-hardening/spec.md
```
```
/wireframe features/foundation/006-template-fork-experience/spec.md
```

### Core Features
```
/wireframe features/core-features/007-e2e-testing-framework/spec.md
```
```
/wireframe features/core-features/009-user-messaging-system/spec.md
```
```
/wireframe features/core-features/011-group-chats/spec.md
```
```
/wireframe features/core-features/012-welcome-message-architecture/spec.md
```

### Auth OAuth
```
/wireframe features/auth-oauth/013-oauth-messaging-password/spec.md
```
```
/wireframe features/auth-oauth/014-admin-welcome-email-gate/spec.md
```
```
/wireframe features/auth-oauth/015-oauth-display-name/spec.md
```
```
/wireframe features/auth-oauth/016-messaging-critical-fixes/spec.md
```

### Enhancements
```
/wireframe features/enhancements/017-colorblind-mode/spec.md
```
```
/wireframe features/enhancements/018-font-switcher/spec.md
```
```
/wireframe features/enhancements/019-google-analytics/spec.md
```
```
/wireframe features/enhancements/020-pwa-background-sync/spec.md
```
```
/wireframe features/enhancements/021-geolocation-map/spec.md
```

### Integrations
```
/wireframe features/integrations/022-web3forms-integration/spec.md
```
```
/wireframe features/integrations/023-emailjs-integration/spec.md
```
```
/wireframe features/integrations/024-payment-integration/spec.md
```
```
/wireframe features/integrations/026-unified-messaging-sidebar/spec.md
```

### Payments
```
/wireframe features/payments/038-payment-dashboard/spec.md
```
```
/wireframe features/payments/039-payment-offline-queue/spec.md
```
```
/wireframe features/payments/040-payment-retry-ui/spec.md
```
```
/wireframe features/payments/042-payment-rls-policies/spec.md
```
```
/wireframe features/payments/043-group-service/spec.md
```

---

**See your project clearly from the first frame.** Plan features with specs and wireframes before writing code.

![ScriptHammer Preview](docs/design/wireframes/preview.svg)

## [👀 View Example Wireframes](https://tortoisewolfe.github.io/First-Frame/design/wireframes/)

Interactive wireframe viewer demonstrating the template structure.

## 🤔 What is ScriptHammer?

ScriptHammer is a planning-first development template. It helps you:

1. 📜 **Define** your project vision (constitution)
2. 📋 **Specify** features with user stories and acceptance criteria
3. 🖼️ **Visualize** UI with SVG wireframes
4. 🤖 **Feed** all this context to an LLM for implementation

The specs and wireframes you create become excellent context for AI-assisted development.

## 🧩 Why SVG Wireframes?

SVGs are text-based XML. When you create wireframes as SVGs, you're not just making pretty pictures - you're generating structured, semantic context that an LLM can actually understand.

Your AI assistant can read an SVG and know: "This is a 3-column layout. The sidebar has navigation. The main content has a data table. The detail panel shows the selected item."

That's infinitely more useful than describing your UI in prose.

## 📦 What's Included

- 🖥️ Interactive wireframe viewer with pan, zoom, keyboard navigation, and focus mode
- 🎨 Side-by-side Desktop + Mobile wireframe layout (1400×800)
- ⚙️ [GitHub's SpecKit](https://github.com/github/spec-kit) workflow commands built-in
- 🌗 Dark and light theme support for wireframes

## 🚀 Quick Start

```bash
# 1. Fork and clone this repo
git clone https://github.com/YOUR-USERNAME/ScriptHammer.git
cd ScriptHammer

# 2. Start Claude Code
claude

# 3. Define your project vision
/speckit.constitution

# 4. Create feature specifications
/speckit.specify

# 5. Refine requirements
/speckit.clarify

# 6. Generate wireframes
/wireframe
```

## 🐳 SpecKit CLI Installation (Optional)

The `/speckit.*` Claude Code commands work without any installation. But if you want [GitHub's SpecKit CLI](https://github.com/github/spec-kit):

<!-- **With Python:**
```bash
pip install uv
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
specify init --here --ai claude
``` -->

**Without Python (use Docker to install):**
```bash
./specify init --here --ai claude    # Auto-installs via Docker on first run
```

After initialization, SpecKit scripts and templates are local in `.specify/` and run without Docker.

## 🏗️ Structure

```
ScriptHammer/
├── docs/
│   ├── constitution-template.md   # Project vision template
│   ├── research/                  # Market & user research
│   └── design/
│       └── wireframes/            # SVG wireframes + viewer
├── specs/
│   └── example-feature.md         # Feature spec template
└── CLAUDE.md                      # AI assistant guidance
```

## ⚡ Moving to Implementation

When you're ready to build, you have options:

**Option A: Use ScriptHammer.com**
[ScriptHammer.com](https://scripthammer.com) provides a ready-to-use foundation (Next.js 15, React 19, Supabase, Tailwind). Your specs and wireframes become rich context for implementation.

**Option B: Stay in this repo**
Continue using this repo with SpecKit's full workflow (`/speckit.plan`, `/speckit.tasks`, `/speckit.implement`). Your specs and wireframes guide development right here.

## 🛠️ Commands

### SpecKit Workflow

| Command | Purpose |
|---------|---------|
| `/speckit.constitution` | Define project vision and principles |
| `/speckit.specify` | Create feature specifications |
| `/speckit.clarify` | Refine specs with clarifying questions |
| `/wireframe` | Generate dark theme SVG wireframes (1400×800, side-by-side) |
| `/wireframe-light` | Generate light theme SVG wireframes |
| `/speckit.plan` | Generate implementation plan |
| `/speckit.checklist` | Generate custom implementation checklist |
| `/speckit.tasks` | Create actionable task list |
| `/speckit.taskstoissues` | Convert tasks to GitHub issues |
| `/speckit.analyze` | Review spec quality and consistency |
| `/speckit.implement` | Execute implementation plan |

### Wireframe Viewer

| Command | Purpose |
|---------|---------|
| `/hot-reload-viewer` | Start wireframe viewer at localhost:3000 |
| `/svg-to-png` | Convert SVG wireframes to PNG (1200×800) |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **F** | Toggle focus mode (hide sidebar/footer) |
| **Escape** | Exit focus mode |
| **←/→** | Previous/Next wireframe |
| **↑/↓** or **+/-** | Zoom in/out |
| **0** | Reset zoom to 85% |

## 🔨 Why "ScriptHammer"?

Every great project needs the right tools. ScriptHammer forges your ideas into structured plans that AI can understand and implement.

🔨 **"Script"** - The specifications and code that define your project. Your scripts tell the story of what you're building.

⚒️ **"Hammer"** - The tool that shapes raw ideas into solid architecture. Forge your vision into reality.

✨ **Script + Hammer = ideas forged into working software.**

---

*Planning template for AI-assisted development. Forked from [FirstFrame](https://github.com/TortoiseWolfe/First-Frame).*
