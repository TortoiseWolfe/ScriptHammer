# Template Guide - Auto-Configured Project Name

## Automatic Project Detection 🎯

When you create a new repository from this template, the project name and configuration are **automatically detected** from your git remote URL. No manual configuration needed!

### How It Works

1. **Use this template** on GitHub (click the green "Use this template" button)
2. **Clone your new repository** locally
3. **Run the project** - it automatically detects:
   - Your GitHub username
   - Your repository name
   - Generates appropriate paths for GitHub Pages

### What Gets Auto-Configured

The following are automatically updated based on your new repository:

- Project name in all UI components
- Page titles and metadata
- PWA manifest
- Service Worker paths
- GitHub Pages base paths
- Email templates
- All branding references

### Quick Start After Creating From Template

```bash
# Clone your new repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME

# Create .env file with your user ID
echo "UID=$(id -u)" > .env
echo "GID=$(id -g)" >> .env

# Start Docker development (auto-detects project info)
docker compose up
```

**NOTE**: This project REQUIRES Docker for development. Local pnpm/npm is NOT supported.

The project will automatically use your repository name everywhere "ScriptHammer" appeared before.

### GitHub Actions Configuration (For Production)

While the project auto-detects your repository name, you'll need to add personal configuration as GitHub Secrets for production features to work properly.

#### Required GitHub Secrets

Go to your repository **Settings → Secrets and variables → Actions** and add these secrets.

**All NEXT*PUBLIC* variables in alphabetical order:**

- `NEXT_PUBLIC_AUTHOR_AVATAR` - URL to your avatar image
- `NEXT_PUBLIC_AUTHOR_BIO` - Short bio/tagline
- `NEXT_PUBLIC_AUTHOR_BLUESKY` - Bluesky handle
- `NEXT_PUBLIC_AUTHOR_EMAIL` - Contact email address
- `NEXT_PUBLIC_AUTHOR_GITHUB` - GitHub username
- `NEXT_PUBLIC_AUTHOR_LINKEDIN` - LinkedIn username
- `NEXT_PUBLIC_AUTHOR_MASTODON` - Mastodon handle (include instance)
- `NEXT_PUBLIC_AUTHOR_NAME` - Your display name
- `NEXT_PUBLIC_AUTHOR_ROLE` - Your professional role
- `NEXT_PUBLIC_AUTHOR_TWITCH` - Twitch username
- `NEXT_PUBLIC_AUTHOR_TWITTER` - Twitter/X handle
- `NEXT_PUBLIC_AUTHOR_WEBSITE` - Personal website URL
- `NEXT_PUBLIC_BASE_PATH` - Override deployment base path
- `NEXT_PUBLIC_BASE_URL` - Base URL for your site
- `NEXT_PUBLIC_CALENDAR_PROVIDER` - Either `calendly` or `calcom`
- `NEXT_PUBLIC_CALENDAR_URL` - Your calendar booking URL
- `NEXT_PUBLIC_DISQUS_SHORTNAME` - Your Disqus shortname (for blog comments)
- `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY` - EmailJS public key
- `NEXT_PUBLIC_EMAILJS_SERVICE_ID` - EmailJS service ID
- `NEXT_PUBLIC_EMAILJS_TEMPLATE_ID` - EmailJS template ID
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` - Google Analytics ID (format: G-XXXXXXXXXX)
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` - Google Search Console verification
- `NEXT_PUBLIC_PROJECT_NAME` - Override auto-detected project name
- `NEXT_PUBLIC_PROJECT_OWNER` - Override auto-detected owner
- `NEXT_PUBLIC_SITE_TWITTER_HANDLE` - Site-wide Twitter handle for social cards
- `NEXT_PUBLIC_SITE_URL` - Your custom domain (if not using GitHub Pages)
- `NEXT_PUBLIC_SOCIAL_PLATFORMS` - Comma-separated list of enabled platforms
- `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY` - Web3Forms API key for contact forms

Without these secrets, your production site will build but won't have personalized content or working features like comments, calendar booking, or contact forms.

### Manual Override (Optional)

If you want to override the auto-detected values, create a `.env.local` file:

```env
NEXT_PUBLIC_PROJECT_NAME=MyCustomName
NEXT_PUBLIC_PROJECT_OWNER=MyUsername
NEXT_PUBLIC_BASE_PATH=/my-custom-path
```

### How Detection Works

The `scripts/detect-project.js` script:

1. Checks git remote URL (`git remote get-url origin`)
2. Parses username and repository name
3. Generates configuration at build time
4. Falls back to "ScriptHammer" if no git remote is found

### Why Use Template Instead of Fork?

- **Clean History**: Start with a fresh commit history
- **No Connection**: No link back to the original repository
- **Your Own Project**: This is YOUR project from day one
- **GitHub Insights**: Your commits count toward your GitHub contributions

### Supported Git Hosts

- GitHub (primary support)
- GitLab (detected, may need manual config)
- Bitbucket (detected, may need manual config)
- Custom git servers (detected, may need manual config)

### GitHub Pages Deployment

When deploying to GitHub Pages, the base path is automatically set:

- **Development**: No base path (runs on `localhost:3000`)
- **Production**: `/YOUR_REPO_NAME` (for `username.github.io/YOUR_REPO_NAME`)

### Troubleshooting

If auto-detection isn't working:

1. **Check git remote**:

   ```bash
   git remote get-url origin
   ```

   Should show your forked repository URL

2. **Run detection manually**:

   ```bash
   docker compose exec scripthammer node scripts/detect-project.js
   ```

   This will show what was detected

3. **Check generated config**:

   ```bash
   docker compose exec scripthammer cat src/config/project-detected.json
   ```

4. **Clear and regenerate**:
   ```bash
   docker compose exec scripthammer rm -rf src/config/project-detected.*
   docker compose restart
   ```

### Advanced Configuration

The project configuration is managed in three layers (priority order):

1. **Environment Variables** (highest priority) - `.env.local`
2. **Auto-detected Config** - from git remote
3. **Default Values** - fallback to "ScriptHammer"

### API Endpoints

- `/api/manifest` - Dynamically generated PWA manifest with your project name

### Files That Auto-Update

All these files now use dynamic configuration:

- `src/app/layout.tsx` - Page metadata
- `src/components/PWAInstall.tsx` - Service worker paths
- `public/manifest.json` - Now generated dynamically
- `src/utils/email/providers/*.ts` - Email templates
- `next.config.ts` - Base paths for production

### For Template Users

This is designed to be a **minimal-configuration** experience:

1. Click "Use this template" and choose your project name
2. Clone your new repository
3. Create `.env` file: `cp .env.example .env` (required for Docker)
4. Run `docker compose up` to start development
5. Deploy to GitHub Pages - paths are handled automatically

No more searching and replacing "ScriptHammer" across 100+ files! The auto-configuration system handles most settings based on your git repository. 🎉
