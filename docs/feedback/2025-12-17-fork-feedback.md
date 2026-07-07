# Fork Feedback Changelog

Changes made to ScriptHammer based on feedback from forked projects.

If pulling upstream changes doesn't work cleanly, you can manually apply these fixes.

---

## Feature 038: Template Fork Experience (Dec 2024)

### Rebrand Script (`scripts/rebrand.sh`)

**Issue**: Manual rebranding required editing 200+ files

**Solution**: Created automated rebrand script

If you don't have the script, create it or copy from upstream.

### Git Safe Directory

**Issue**: Git hooks fail in Docker because `/app` isn't trusted

**Solution**: Added to `docker/Dockerfile`:

```dockerfile
RUN git config --global --add safe.directory /app
```

**Manual fix**: Run inside container:

```bash
git config --global --add safe.directory /app
```

### CNAME Cleanup

**Issue**: Fork deploys to wrong domain due to inherited CNAME

**Solution**: Rebrand script deletes `public/CNAME` by default

**Manual fix**: Delete `public/CNAME` if it contains `scripthammer.com`

### Service Worker Cache Names

**Issue**: Service workers from different forks collide

**Solution**: Made cache names dynamic using project name in `src/lib/service-worker/`

**Manual fix**: Search for `scripthammer-` in service worker files and replace with your project name.

### Admin Email Fallback

**Issue**: Hardcoded admin email in welcome message system

**Solution**: Use `ADMIN_EMAIL` env var with fallback

**Manual fix**: Check `src/services/messaging/` for hardcoded emails.

### Test Suite Mocking

**Issue**: Tests fail without Supabase env vars

**Solution**: Added comprehensive mocks to `tests/setup.ts`

**Manual fix**: Copy mock implementations from upstream `tests/setup.ts`.

---

## E2E Test Fixes (Dec 2024)

### Cookie Banner Dismissal

**Issue**: E2E tests fail because cookie banner intercepts clicks

**Solution**: Added `dismissCookieBanner()` helper in `tests/e2e/utils/test-user-factory.ts`

### Email Domain Validation

**Issue**: Supabase rejects `@example.com` test emails

**Solution**: Use Gmail plus aliases (`user+test@gmail.com`)

**Manual fix**: Update test emails to use real domains with MX records.

### Session Persistence Tests

**Issue**: Tests created users in `beforeEach` causing rate limits

**Solution**: Changed to `beforeAll` for user creation

---

## Accessibility Fixes (Dec 2024)

### Focus Management

**Files changed**:

- `src/components/atomic/AvatarUpload/AvatarUpload.tsx`
- `src/components/atomic/AvatarUpload/useAvatarUpload.ts`
- `src/components/atomic/ColorblindToggle/ColorblindToggle.tsx`
- `src/components/forms/ContactForm/ContactForm.tsx`

**Changes**:

- AvatarUpload: Added Escape key handler, focus trap, focus restoration
- ColorblindToggle: Added Escape key to close dropdown
- ContactForm: Added error focus using react-hook-form `setFocus`

---

## How to Contribute Feedback

If you fork this template and encounter issues:

1. Document the issue and your solution
2. Submit a PR to ScriptHammer or open an issue
3. Help future users avoid the same problems!

[ScriptHammer Issues](https://github.com/TortoiseWolfe/ScriptHammer/issues)
