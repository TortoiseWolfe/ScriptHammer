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
| 3    | `src/hooks`, `src/utils`, `src/app`            | done    |
| 4    | `src/world`, `src/twin`, `src/stage` + assets  | pending |
| 5    | `src/components` (payment, auth, forms, …)     | done    |
| 5    | `src/components` (everything else)             | done    |
| 6    | `scripts/`, `.github/workflows/`               | pending |
| 6    | `tests/`, `src/tests/`                         | pending |

## Backlog

## P0

### Tip Jar checkout shows the catalog default but charges the chosen tip

- **Where:** `src/components/payment/CheckoutSummary/CheckoutSummary.tsx:41` (`previewAmountDue`); used at `src/app/checkout/page.tsx:392`, `:499`
- **Defect:** `previewAmountDue` ignores `amount_mode === 'variable'` and always returns `product.amount` (1500 for `tip-jar`), while the request sends `?amount=` and create-order honours it.
- **Failure scenario:** On `/checkout?sku=tip-jar&amount=5000` the page says "Total today $15.00 — the price shown here is the price charged" and the button says "Pay $15". Stripe then charges $50.
- **Fix:** For variable SKUs, preview the requested amount clamped by the same `min_amount`/`max_amount` rules create-order uses, in both the summary and the button.
- **Confidence:** confirmed
- **Severity note:** Raised from the reviewer's P1 to P0, because the customer is charged an amount different from the one shown.

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

### Changing or resetting the password permanently locks the user out of messaging

- **Where:** `src/components/auth/AccountSettings/AccountSettings.tsx:188`, `src/components/auth/ResetPasswordForm/ResetPasswordForm.tsx:73`
- **Defect:** Both call `supabase.auth.updateUser({ password })` and never re-key or warn. For email users, E2E keys are derived from the login password. Spec 032 SC-005 requires re-encryption or a warning.
- **Failure scenario:** After a password change, sign-in's `deriveKeys(newPassword)` throws `KeyMismatchError` (only logged), and `/messages` asks for the "messaging password". The current password is rejected and there is no recovery path. After a forgot-password reset the old password is gone, so messaging is locked for good.
- **Fix:** On a change, derive keys with the old password and `rotateKeys(newPassword)`. After a reset, offer an explicit "reset messaging keys" path, and have the unlock modal detect this state.
- **Confidence:** confirmed

### "Use a different payment method" always fails: SwitchProviderPanel sends no productId

- **Where:** `src/components/payment/SwitchProviderPanel/SwitchProviderPanel.tsx:158-167`
- **Defect:** `<PaymentButton>` is rendered without `productId`, and `getParentIntentForRetry` doesn't select `product_id`. `createPaymentIntent` (`src/lib/payments/payment-service.ts:149-153`) then throws "A product_id is required…". `parent_intent_id` is also no longer forwarded to create-order.
- **Failure scenario:** After a declined payment, every attempt to switch provider fails, so the recovery flow can never succeed.
- **Fix:** Select `product_id`, pass it as `productId`, and forward `parent_intent_id` in the create-order body.
- **Confidence:** confirmed

### Cookie modal applies analytics/marketing consent on toggle; Close/Esc don't undo it

- **Where:** `src/components/privacy/ConsentModal/ConsentModal.tsx:140-143`, `:90-93`; `src/contexts/ConsentContext.tsx:83-110`
- **Defect:** Each toggle calls `updateConsent`, which commits and persists consent and mounts gtag at once. Close, Escape and backdrop clicks only close the modal.
- **Failure scenario:** A visitor turns Analytics on "to read about it" and clicks X. GA is loaded and the consent is saved for a year, although the user never saved anything.
- **Fix:** Keep a local draft in the modal and commit it only on Save, Accept All or Reject All.
- **Confidence:** confirmed

### IntakeUploader keeps only the last file when several are added at once

- **Where:** `src/components/forms/IntakeUploader/IntakeUploader.tsx:128` (deps `:138`)
- **Defect:** The loop calls `onChange([...value, result.attachment])` with a `value` captured when the callback was created, so each iteration overwrites the previous one.
- **Failure scenario:** When 3 screenshots are selected, all 3 upload but the order posts only the third. The other two are orphaned in the bucket until the 7-day sweep. The existing test uses a single file.
- **Fix:** Use a functional update, or keep a ref to the latest `value`.
- **Confidence:** confirmed

### useOfflineQueue re-runs its sync forever while any unsynced message exists

- **Where:** `src/hooks/useOfflineQueue.ts:109-133` (the `syncQueue` deps), `:236-257` (the mount/poll effect)
- **Defect:** `syncQueue` depends on `isSyncing`, so its identity changes on every sync. The mount effect re-runs each time and syncs again if `getQueue()` is non-empty. `getQueue()` includes permanently `failed` rows, because `markAsFailed` never sets `synced`.
- **Failure scenario:** One failed message, or a signed-out visitor with a queued row, causes back-to-back syncs for as long as the component is mounted: `getSession`, IndexedDB churn and re-renders. The hook is used on `/contact`, `QueueStatusIndicator` and `ConversationView`.
- **Fix:** Guard in-flight state with a ref so `syncQueue` stays stable, and auto-sync only when a `pending` row exists.
- **Confidence:** confirmed

### Offline contact-form submissions are never auto-sent on Chromium

- **Where:** `src/utils/background-sync.ts:17,23-44,175-178`; `public/sw.js:403-405`
- **Defect:** The code registers the tag `form-submission-sync`, but the SW only handles `sync-offline-queue`, and that handler just posts `SYNC_OFFLINE_QUEUE`, which no client listens for. The foreground fallback is skipped whenever `SyncManager` exists, and `retryQueue` has no UI caller.
- **Failure scenario:** On Chrome, Edge or Android, the user submits offline and is told the message "will be sent automatically", but it never is.
- **Fix:** Use one tag name and add a client SW message listener that calls `processQueue()`, or run the foreground fallback on every browser.
- **Confidence:** confirmed

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

### PayPal buttons render again into the same container on every tab switch

- **Where:** `src/components/payment/PaymentButton/PaymentButton.tsx:70-80`, `src/lib/payments/paypal.ts:245`
- **Defect:** The container stays mounted (hidden) but the effect resets `paypalMounted` and renders again, with no `close()` cleanup.
- **Failure scenario:** PayPal → Stripe → PayPal stacks two sets of buttons, each with a stale `createOrder` closure that ignores later prop changes.
- **Fix:** Keep the Buttons instance and `close()` it in cleanup, or mount the container only while PayPal is selected.
- **Confidence:** plausible

### Revoking analytics consent doesn't stop events; components treat `window.gtag` as the gate

- **Where:** `src/components/payment/TipJar/TipJar.tsx:86-94`, `src/components/payment/BookingCta/BookingCta.tsx:106-125`, `src/utils/analytics.ts:98`
- **Defect:** These components skip the consent check because "gtag only mounts with consent", but `window.gtag` (and `window.oaiq`) stay defined after consent is revoked.
- **Failure scenario:** A user accepts, revokes in PrivacyControls, then clicks a tip preset without reloading, and `tip_jar_give`/`lead_created` are still sent.
- **Fix:** Have `trackEvent`/`trackAdConversion` check the current consent state rather than whether the SDK exists.
- **Confidence:** plausible

### usePaymentReturn hangs on "loading" if any step throws

- **Where:** `src/hooks/usePaymentReturn.ts:54-128`
- **Defect:** The async IIFE has no try/catch, and `getPaymentStatus` throws on a missing session or a PostgREST error.
- **Failure scenario:** A buyer returns from Stripe to `/checkout?session_id=…`, which is not protected, before their session restores. They get a permanent spinner and no confirmation or booking link. `/payment-result` has the same problem.
- **Fix:** Wrap the body in try/catch and set `{kind:'error'}` on failure (guarded by `cancelled`).
- **Confidence:** confirmed

### Admin "7d/30d/90d" ranges always leave out today

- **Where:** `src/app/admin/audit/page.tsx:63-66`, `src/app/admin/page.tsx:59`, `src/app/admin/messaging/page.tsx:75-78`, `src/app/admin/payments/page.tsx:63-66`
- **Defect:** The date-only `end` becomes 00:00 UTC of that day, and the RPCs filter `created_at < p_end`.
- **Failure scenario:** Every admin range misses today's events, and custom ranges drop their last day.
- **Fix:** Send `end + 1 day` as the exclusive bound, from one shared helper.
- **Confidence:** confirmed

### /messages/setup sends `?redirect=`, which sign-in ignores

- **Where:** `src/app/messages/setup/page.tsx:54`
- **Defect:** Sign-in reads only `returnUrl`.
- **Failure scenario:** After signing in, the user lands on `/profile` instead of back in messaging.
- **Fix:** Use `/sign-in?returnUrl=${encodeURIComponent('/messages/setup')}`.
- **Confidence:** confirmed

### Hardcoded history.pushState paths drop NEXT_PUBLIC_BASE_PATH

- **Where:** `src/app/messages/page.tsx:60`, `src/app/payment/PaymentHubContent.tsx:77`
- **Defect:** These are absolute root paths that bypass `getInternalUrl()`.
- **Failure scenario:** In a fork deployed at `github.io/<repo>`, selecting a conversation rewrites the URL without the base path, so a reload or shared link 404s.
- **Fix:** Build the URL from `window.location.pathname` plus the new query.
- **Confidence:** confirmed (only under a base-path config)

### AdminGate keeps the previous user's admin verdict when the user changes

- **Where:** `src/app/admin/AdminGate.tsx:57-78,89`
- **Defect:** On a user change, `isAdmin` isn't reset and `wasAdmin.current` is never cleared.
- **Failure scenario:** A non-admin signs in from another tab while an admin page is open. The console stays rendered with the already-loaded audit data visible. RLS blocks new fetches but not what is already on screen.
- **Fix:** Tie the verdict to a user id, and reset both values when the id changes.
- **Confidence:** plausible (depends on the cross-tab auth event not setting `isLoading`)

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

### Failed intake uploads can't be dismissed and count toward the file cap

- **Where:** `src/components/forms/IntakeUploader/IntakeUploader.tsx:130-134`, `:72-73`
- **Defect:** Errored uploads stay in `pending` with no remove control, and `total` counts them.
- **Failure scenario:** After a storage outage clears, the dropzone says the file limit has been reached until the page is reloaded.
- **Fix:** Add a dismiss control for errored items, or leave them out of `total`.
- **Confidence:** confirmed

### Cookie banner has "Accept All" but no one-click reject

- **Where:** `src/components/privacy/CookieConsent/CookieConsent.tsx:65-72`, `:149-162`
- **Defect:** `rejectAll` is wired but deliberately unused, so rejecting takes extra steps. CNIL and EDPB guidance treats that as non-compliant.
- **Failure scenario:** An EU visitor can accept in one click but must dig into the modal to reject.
- **Fix:** Add a Reject All button with the same prominence as Accept All.
- **Confidence:** confirmed

### GeolocationConsent pre-ticks the analytics and personalization purposes

- **Where:** `src/components/map/GeolocationConsent/GeolocationConsent.tsx:41-52`
- **Defect:** `selectedPurposes` starts with every purpose checked. Pre-ticked consent is not valid (Planet49).
- **Failure scenario:** Clicking Accept to see oneself on the map also records consent to location analytics.
- **Fix:** Pre-select only the display purpose.
- **Confidence:** confirmed

### CalComProvider adds duplicate Cal.com listeners on every mount

- **Where:** `src/components/calendar/providers/CalComProvider/CalComProvider.tsx:68-113`
- **Defect:** `cal('on', …)` is registered on the global instance with no `cal('off', …)` cleanup.
- **Failure scenario:** After N visits to `/schedule`, each booking fires N `bookingSuccessful` handlers.
- **Fix:** Keep the callbacks and unregister them in the effect cleanup.
- **Confidence:** plausible

### usePaymentReturn reports "paid" without checking payment status

- **Where:** `src/hooks/usePaymentReturn.ts:60-83,120-126`
- **Defect:** The hook ignores `success` and `result.status`, and returns `paid`, with the booking link, whenever a result row and an order exist.
- **Failure scenario:** Not reachable today, because the webhook writes only success rows. A future failed or refunded row would still hand out the paid booking link.
- **Fix:** Require `result.status === 'succeeded'`.
- **Confidence:** plausible

### A malformed `returnUrl` crashes /sign-in and /sign-up

- **Where:** `src/app/sign-in/page.tsx:54`, `src/app/sign-up/page.tsx:27`
- **Defect:** `decodeURIComponent` runs on a value `URLSearchParams` has already decoded, with no try/catch.
- **Failure scenario:** `/sign-in?returnUrl=%25` throws `URIError` and the sign-in page shows the error boundary. The open-redirect guard itself holds.
- **Fix:** Drop the second decode, or treat a decode failure as unsafe.
- **Confidence:** confirmed
