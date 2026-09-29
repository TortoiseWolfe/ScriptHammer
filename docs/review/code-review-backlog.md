# Whole-repo code review backlog

Started 2026-09-29. Findings from a tiered read-only review of the whole repo, sorted by
severity (P0 first). This is a working backlog, not the record: per CLAUDE.md, a finding
that is going to be fixed gets an **issue**, and the issue body becomes the source of truth.
When an item is filed, put the issue number in its heading; when it is fixed, delete the row.

| Severity | Meaning                                                            |
| -------- | ------------------------------------------------------------------ |
| P0       | Security hole, data loss, auth bypass, money                       |
| P1       | User-facing bug on a real path, or a check that hides real failure |
| P2       | Latent bug, edge case, wrong under some configuration              |
| P3       | Minor / robustness                                                 |

"Confirmed" means the reviewer traced the failure path in code. "Plausible" means the
defect is real in the code but exploitability or impact depends on something the reviewer
could not see (deployed config, live data).

## Coverage

| Tier | Scope                                          | Status  |
| ---- | ---------------------------------------------- | ------- |
| 1    | `supabase/`                                    | pending |
| 2    | `src/lib`                                      | done    |
| 2    | `src/services`, `src/contexts`                 | pending |
| 3    | `src/hooks`, `src/utils`, `src/app`            | pending |
| 4    | `src/world`, `src/twin`, `src/stage` + assets  | pending |
| 5    | `src/components` (payment, auth, forms, …)     | pending |
| 5    | `src/components` (everything else)             | done    |
| 6    | `scripts/`, `.github/workflows/`               | pending |
| 6    | `tests/`, `src/tests/`                         | pending |

## Backlog

## P0

_None yet._

## P1

### `isSupabaseOnline()` never reports offline, so queued payments burn their retries

- **Where:** `src/lib/supabase/client.ts:407-418`; callers `src/lib/payments/connection-listener.ts:43`, `src/lib/payments/payment-service.ts:187`
- **Defect:** postgrest-js resolves a failed fetch as `{ error: { code: '', message: 'TypeError: Failed to fetch' } }`. The function returns `!error || error.code !== 'PGRST301'`, which is `true` for that. `PGRST301` means "JWT could not be decoded", not "offline".
- **Failure scenario:** Offline with a queued payment, every 30s tick sees "online" and calls `sync()`. The fetch fails, and one of the 5 retries is spent per tick, because backoff tops out at 16s, under the 30s tick. After ~2.5 min the row is `failed` and never drains on its own. The offline branch in `createPaymentIntent` is effectively unreachable. It matches only "fetch"/"network" in the message, and Safari says "Load failed", so on Safari nothing is queued at all.
- **Fix:** Return false when `navigator.onLine === false`, or on an error with empty `code` or `status === 0`. Key the `createPaymentIntent` catch on `error instanceof TypeError`, not on the message text.
- **Confidence:** confirmed

### PayPal SDK always loads with `intent=subscription`, likely breaking one-time orders

- **Where:** `src/lib/payments/paypal.ts:62`; one-time use at `src/hooks/usePaymentButton.ts:276-282`
- **Defect:** The script URL is always `&vault=true&intent=subscription`, but one-time Buttons return a `CAPTURE` order from `create-paypal-order`. The SDK checks that the order's intent matches the script's.
- **Failure scenario:** A one-off PayPal purchase hits `onError` and cannot complete. `window.paypal` is cached (line 57), so the page can't recover by reloading the SDK with the right intent.
- **Fix:** Load with `intent=capture` for one-time payments and `vault=true&intent=subscription` only for recurring ones. Key the cached loader by intent.
- **Confidence:** plausible. PayPal's runtime check was not exercised.

### 10s message poll replaces paginated history with the newest page

- **Where:** `src/components/organisms/ConversationView/ConversationView.tsx:261-268` (also `:175-178`, `:219-221`, edit/delete at `:339`, `:356`)
- **Defect:** The poll calls `loadMessages()` with `loadMore=false`. That replaces `dbMessages` with the newest 50 and resets `cursorRef`/`hasMore`. It also toggles `loading`, and its `finally` can clear `loading` while a `loadMore` is still in flight.
- **Failure scenario:** The user scrolls up to load older messages, and within 10s they vanish and the cursor restarts. The "Loading older messages…" bar flashes every 10s, and MessageThread's scroll-restore arms and later jumps. A second `loadMore` with the same cursor produces duplicate message ids, and so duplicate React keys.
- **Fix:** Make the poll, edit and delete refreshes merge-only: upsert the newest page by id and leave cursor, `hasMore` and `loading` alone. Replace the list only on a conversation switch.
- **Confidence:** confirmed

### Conversation opens scrolled to the oldest loaded message, not the newest

- **Where:** `src/components/molecular/MessageThread/MessageThread.tsx:182-200`
- **Defect:** The auto-scroll effect fires only when `lastMessageRef.current !== null`. The first non-empty render just records the id, and nothing scrolls to the bottom on initial load.
- **Failure scenario:** `/messages?conversation=X` opens at `scrollTop = 0`, showing the oldest of the 50 loaded messages. That position is inside the `< 100` zone, so the first small scroll triggers `onLoadMore`.
- **Fix:** On the first transition from empty to non-empty, or on a conversation change, call `scrollToBottomRef.current(false)` in a layout effect.
- **Confidence:** confirmed (from code, not reproduced in a browser)

## P2

### Queued payments have no persisted idempotency key, so every retry can create another order

- **Where:** `src/lib/payments/offline-queue.ts:53-64`, `src/lib/offline-queue/payment-adapter.ts:158-166,193-201`, `src/lib/payments/payment-service.ts:208-223,244-250`
- **Defect:** `queueOperation()` calls `paymentQueue.queue()` directly and bypasses `queuePaymentIntent()`, the only code that stores an `idempotency_key` (and nothing calls it). `executePaymentIntent` mints a fresh UUID on every attempt. The online path sends no `Idempotency-Key` at all.
- **Failure scenario:** The first scenario is a lost response. create-order succeeds but the response is lost, the row returns to pending, and the next attempt sends a new key, so a second intent is created. The second is a failed follow-up read. create-order succeeds, then `.select().single()` throws "Failed to fetch", the catch queues the purchase, and the drain creates a duplicate.
- **Fix:** Mint one key per `createPaymentIntent` call, send it online, and carry the same key into any queued fallback. Route `queueOperation('payment_intent')` through `queuePaymentIntent`.
- **Confidence:** confirmed

### Offline message cache returns messages in UUID order and loses the newest page

- **Where:** `src/lib/messaging/cache.ts:56-67,101-109`; callers `src/services/messaging/message-service.ts:536,582`
- **Defect:** `where('conversation_id').equals(id).reverse().limit(n)` orders by UUID primary key, not by time. `cacheMessages` also replaces the whole conversation's cache with whatever page was just fetched, including older cursor pages.
- **Failure scenario:** The user opens a thread, scrolls up once, then goes offline. Reopening the thread shows only the older 50 messages, shuffled, with none of the recent ones.
- **Fix:** In a new Dexie version, add a `[conversation_id+sequence_number]` (or `created_at`) compound index and query on it. Replace the cache only when `cursor === null`; otherwise `bulkPut`, then trim.
- **Confidence:** confirmed

### `removeAvatar` reports success without clearing the avatar when the metadata mirror is empty

- **Where:** `src/lib/avatar/upload.ts:173-192`
- **Defect:** Since #1068, `user_profiles.avatar_url` is the source of truth, but `removeAvatar` reads only `user_metadata.avatar_url` and returns success when that is missing. It also ignores the error from the `user_profiles` update.
- **Failure scenario:** The mirror write failed on upload, or the avatar came from OAuth. Remove says it worked, but the profile row and the storage file remain and the avatar keeps rendering.
- **Fix:** Read `avatar_url` from `user_profiles` (with metadata as the fallback). Clear the profile first as the fatal step, check its error, and make the metadata clear best-effort.
- **Confidence:** confirmed

### City renders full-detail models at every distance; route doc budgets as if it didn't

- **Where:** `src/world/WarehouseModels.tsx:216-222`, `docs/twins/chatt-historic-route.md:44`
- **Defect:** The renderer always mounts `lods[0]` and its comment says distance LOD
  switching was removed. The route doc says LOD0 is only drawn near the camera and LOD2
  city-wide, so it concludes detail only costs frame time near the camera.
- **Failure scenario:** Landmarks and truss bridges built up to the 24k-triangle LOD0 cap
  are all drawn at full detail across the whole city; the 150k city-wide cap no longer
  bounds what is actually drawn and the game's frame rate drops.
- **Fix:** Either restore distance LOD switching before the route is built out, or rewrite
  the doc's budget against LOD0 totals.
- **Confidence:** confirmed
- **Source:** `/code-review` of #1304

### Switching conversations races in-flight loads and shows the old thread's messages

- **Where:** `src/components/organisms/ConversationView/ConversationView.tsx:249-252`, `:163-229`
- **Defect:** A conversation change clears only `optimisticMessages`. `dbMessages`, `hasMore`, `cursorRef` and `participantName` persist, and `loadMessages` never checks whether the result belongs to the current conversation.
- **Failure scenario:** The user clicks B while a `loadMore` for A is in flight, and A's rows are prepended into B with A's cursor. B also shows A's messages under a stale header for ~1.5s, and read receipts fire for the wrong thread.
- **Fix:** Reset state on `conversationId` change and drop stale results using a request token. Alternatively, key `<ConversationView key={conversationId}>`.
- **Confidence:** confirmed

### Own optimistic message bubble is labelled with the recipient's name, and memo freezes it

- **Where:** `src/components/organisms/ConversationView/ConversationView.tsx:309`; `src/components/atomic/MessageBubble/MessageBubble.tsx:398-414`
- **Defect:** The optimistic own message sets `senderName: participantName`, which is the other person's name. The `MessageBubble` memo comparator ignores `senderName`, `isOwn` and `created_at`, so the DB row never corrects it.
- **Failure scenario:** Alice's own bubble reads "Bob" until the message is edited or the bubble remounts.
- **Fix:** Use the current user's display name, and add those fields to the comparator.
- **Confidence:** confirmed

### Typed message is cleared before send succeeds; a thrown send loses the text

- **Where:** `src/components/molecular/MessageInput/MessageInput.tsx:118-120`
- **Defect:** `onSend(trimmed)` isn't awaited before `setMessage('')`. `sendMessage` throws, rather than queueing, for `EncryptionLockedError`, `AuthenticationError` and `ValidationError`.
- **Failure scenario:** With keys locked after a re-auth, a long message is sent, the error banner shows, and the text is gone.
- **Fix:** Make `onSend` return a Promise and clear the input only on success.
- **Confidence:** confirmed

### Unguarded storage access in layout-level components can crash every route

- **Where:** `src/components/SetupBanner/SetupBanner.tsx:37`; `src/components/PWAInstall/PWAInstall.tsx:210-216`
- **Defect:** `sessionStorage`/`localStorage` reads in mount effects have no try/catch. Both components render in `src/app/layout.tsx` outside the page `ErrorBoundary`, while every sibling at that level guards storage.
- **Failure scenario:** With site data blocked (Safari "Block all cookies"), the storage getter throws `SecurityError`, `global-error.tsx` catches it, and every route shows the error page.
- **Fix:** Wrap these calls in try/catch or use a shared safe-storage helper.
- **Confidence:** confirmed (from code; the throw is standard browser behaviour)

### PWAInstall effect re-runs on consent load and leaks SW registrations, intervals and listeners

- **Where:** `src/components/PWAInstall/PWAInstall.tsx:39-142` (interval `:82`, `appinstalled` `:126`)
- **Defect:** The effect depends on `trackPWAEvent`, which changes identity when stored consent loads. Each run re-registers the SW with a new `?v=Date.now()` URL and starts an uncleared 60s `update()` interval. It also adds an `appinstalled` listener that is never removed.
- **Failure scenario:** Every user who accepted analytics gets a forced SW reinstall (`skipWaiting` plus cache purge), two permanent intervals, and double `installed` tracking.
- **Fix:** Register the SW in a mount-only effect and clear its interval on cleanup. Read `trackPWAEvent` via a ref, and remove a named `appinstalled` handler in cleanup.
- **Confidence:** confirmed

### Install button left showing with a dead or used prompt (GlobalNav vs PWAInstall)

- **Where:** `src/components/GlobalNav/GlobalNav.tsx:334-369`, `:880`; `src/components/PWAInstall/PWAInstall.tsx:113-165`
- **Defect:** Both components capture the same `beforeinstallprompt` event. When the prompt is dismissed, GlobalNav nulls the prompt but keeps `showInstallButton` true, and whichever component uses the event leaves the other holding a spent one.
- **Failure scenario:** After the user cancels the browser dialog, the nav Install button stays visible and does nothing. If the user installs via the PWAInstall pill first, clicking the nav button later throws `InvalidStateError` (an unhandled rejection).
- **Fix:** Give the deferred prompt one owner (a shared hook or context), and hide the nav button when the prompt is null.
- **Confidence:** confirmed

### Virtualized message thread caches row sizes by index, which prepends invalidate

- **Where:** `src/components/molecular/MessageThread/MessageThread.tsx:115-121`
- **Defect:** `useVirtualizer` has no `getItemKey`, so measured sizes are keyed by index and prepending older pages shifts every mapping.
- **Failure scenario:** In a thread with 100+ messages, loading an older page makes rows overlap or leave gaps, and scroll-restore lands wrong until the rows are re-measured.
- **Fix:** `getItemKey: (i) => messages[i].id`.
- **Confidence:** plausible

## P3

### Completed payment-queue rows are never removed, so the listener probes Supabase every 30s forever

- **Where:** `src/lib/payments/offline-queue.ts:93-95`, `src/lib/payments/connection-listener.ts:40-43`, `src/lib/offline-queue/base-queue.ts:163`
- **Defect:** `getPendingCount()` counts every row regardless of status, and nothing calls `clearCompleted()`.
- **Failure scenario:** Once any payment has been queued and drained, the #895 "cheap guard" is permanently non-zero, and every tab queries `payment_intents` every 30s indefinitely.
- **Fix:** Count only `pending`/`processing` rows, and call `clearCompleted()` after a successful sync.
- **Confidence:** confirmed

### `uploadWithRetry` retries auth failures its own guard is meant to stop

- **Where:** `src/lib/avatar/upload.ts:242-246`
- **Defect:** The no-retry guard matches `'authenticated'`/`'permission'`, but the real messages are `'Auth session missing…'` and `'Authentication required…'`.
- **Failure scenario:** An expired session waits through 3 attempts and ~3s of backoff before the error surfaces.
- **Fix:** Return a typed error code from `uploadAvatar` and branch on it.
- **Confidence:** confirmed

### AvatarUpload steals focus on mount

- **Where:** `src/components/molecular/AvatarUpload/AvatarUpload.tsx:95-99`
- **Defect:** The "restore focus when modal closes" effect also runs on mount, when `showCropModal` is false.
- **Failure scenario:** Opening Account Settings moves focus to "Upload Avatar" and scrolls to it, which breaks the focus order on every visit.
- **Fix:** Focus only on the true→false transition, tracked via a ref.
- **Confidence:** confirmed

### CountdownBanner announces a ticking clock every second

- **Where:** `src/components/atomic/CountdownBanner/CountdownBanner.tsx` (`<aside aria-live="polite">` around the per-second countdown)
- **Defect:** A live region wraps text that updates every second.
- **Failure scenario:** From Oct 31 to Dec 31 the banner is on every page, and screen readers announce "Nd Nh Nm Ns" continuously.
- **Fix:** Remove `aria-live`, or scope it to the static text only.
- **Confidence:** confirmed
