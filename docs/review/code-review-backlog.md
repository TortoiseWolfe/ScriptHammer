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

## Summary

**83 findings: 4 P0, 21 P1, 38 P2, 20 P3.** Every tier below has been reviewed once. Every
reviewer only read code, traced each finding in the code before reporting it, and dropped
anything it could not substantiate. Nothing here has been reproduced in a running app.

Themes worth fixing as a class rather than one by one:

- **Payments lose or duplicate money-state.** Webhook dedupe swallows retries, retry intents
  have no order, idempotency keys are missing on one path and stuck on another, and the Tip
  Jar shows a price different from the one it charges.
- **Supabase `{ error }` is treated as success.** postgrest-js resolves errors instead of
  throwing, and many call sites check only for a throw (`isSupabaseOnline`,
  `getConversationMeta`, `refreshSession`, RLS-filtered deletes that return 0 rows).
- **Auth sign-out heuristics.** The token-removal guard plus the spurious-SIGNED_OUT check
  mis-handles session-only users, account deletion and real revocation, and each path can
  wipe or strand messaging keys.
- **Tests and CI checks that cannot fail.** See the grouped entries under P1 and P2.

## Coverage

| Tier | Scope                                          | Status  |
| ---- | ---------------------------------------------- | ------- |
| 1    | `supabase/`                                    | done    |
| 2    | `src/lib`                                      | done    |
| 2    | `src/services`, `src/contexts`                 | done    |
| 3    | `src/hooks`, `src/utils`, `src/app`            | done    |
| 4    | `src/world`, `src/twin`, `src/stage` + assets  | done    |
| 5    | `src/components` (payment, auth, forms, …)     | done    |
| 5    | `src/components` (everything else)             | done    |
| 6    | `scripts/`, `.github/workflows/`               | done    |
| 6    | `tests/`, `src/tests/`                         | done    |

## Backlog

## P0

### Tip Jar checkout shows the catalog default but charges the chosen tip

- **Where:** `src/components/payment/CheckoutSummary/CheckoutSummary.tsx:41` (`previewAmountDue`); used at `src/app/checkout/page.tsx:392`, `:499`
- **Defect:** `previewAmountDue` ignores `amount_mode === 'variable'` and always returns `product.amount` (1500 for `tip-jar`), while the request sends `?amount=` and create-order honours it.
- **Failure scenario:** On `/checkout?sku=tip-jar&amount=5000` the page says "Total today $15.00 — the price shown here is the price charged" and the button says "Pay $15". Stripe then charges $50.
- **Fix:** For variable SKUs, preview the requested amount clamped by the same `min_amount`/`max_amount` rules create-order uses, in both the summary and the button.
- **Confidence:** confirmed
- **Severity note:** Raised from the reviewer's P1 to P0, because the customer is charged an amount different from the one shown.

### Webhooks dedupe before processing, so a failed payment event is never retried

- **Where:** `supabase/functions/stripe-webhook/index.ts:116-127`, `supabase/functions/paypal-webhook/index.ts:85-97`, `supabase/functions/calcom-webhook/index.ts:95`
- **Defect:** The `webhook_events` row is inserted with `processed=false` before the handler runs, and the duplicate check tests only whether the row exists.
- **Failure scenario:** A transient DB error in `handlePaymentIntentSucceeded` returns 500. The provider retries, gets 200 "already processed", and the `payment_results` row and order advance are lost for good. `check-webhook-liveness.mjs` only reports these rows.
- **Fix:** Short-circuit only when `processed=true`. Re-run or compare-and-swap-claim rows that are still `processed=false`.
- **Confidence:** confirmed

### A paid retry intent never advances its order or sends the receipt

- **Where:** `supabase/functions/create-order/index.ts:134` (retry branch), `supabase/functions/_shared/advance-order.ts`
- **Defect:** A retry inserts a child `payment_intents` row but no `orders` row, and `advanceOrderAndNotify` looks orders up only by `intent_id = child.id`.
- **Failure scenario:** After a failed first attempt the buyer retries and pays. The webhook logs "no order for intent", the order stays `pending`, no receipt is sent, and admin shows a paid order as unpaid.
- **Fix:** Resolve the order through `parent_intent_id` to the root intent, or re-point the order when the retry is created.
- **Confidence:** confirmed
- **Severity note:** Raised from P1 to P0, because the buyer is charged and the order is never fulfilled.

### Account deletion fails for anyone who ever started a checkout, after keys are already wiped

- **Where:** `supabase/migrations/20251006_complete_monolithic_setup.sql:56`, `:140`, `:412`; `supabase/functions/delete-account/index.ts:79`; client `src/services/messaging/gdpr-service.ts:561`
- **Defect:** `payment_intents.template_user_id`, `subscriptions.template_user_id` and `orders.buyer_user_id` reference `auth.users(id)` with NO ACTION, so `auth.admin.deleteUser` fails with 23503.
- **Failure scenario:** Every checkout writes an intent and an order, so every buyer's erasure request returns 500. The client has already deleted the private keys, so the user keeps the account but can never decrypt their messages again. The GDPR erasure is also not done.
- **Fix:** Encode retention in the FKs (`ON DELETE SET NULL`, or anonymise the rows first), and delete local keys only after the server confirms.
- **Confidence:** confirmed (schema); plausible (exact GoTrue error text)
- **Severity note:** Raised from P1 to P0 for data loss plus a failed legal erasure.

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

### With "Remember me" off, any spurious SIGNED_OUT wipes the keys and the offline queue

- **Where:** `src/contexts/AuthContext.tsx:48-68` (`isAuthTokenValidInLocalStorage`), `:269-313`
- **Defect:** The spurious-SIGNED_OUT check reads only `localStorage`. Since #375, session-only users keep their token in `sessionStorage` (`src/lib/supabase/client.ts:142-146`), so for them every transient SIGNED_OUT counts as real.
- **Failure scenario:** A transient Realtime/RLS 401 makes AuthContext null the user and call `clearKeys()`, which deletes the IndexedDB private key and `messaging_queued_messages`. Unsent offline messages are lost and the user is redirected to `/`.
- **Fix:** Read the token through the same store logic the adapter uses (`createAuthStorage().getItem(key)`).
- **Confidence:** confirmed

### Account deletion leaves a signed-in ghost session and token behind

- **Where:** `src/services/messaging/gdpr-service.ts:616`, `src/lib/supabase/client.ts:261-268`, `src/contexts/AuthContext.tsx:269-276`
- **Defect:** The code calls `supabase.auth.signOut()` directly, bypassing `AuthContext.signOut`. The storage adapter therefore refuses to remove the token, and AuthContext then treats the SIGNED_OUT as spurious.
- **Failure scenario:** After deletion, the client-side push to `/sign-in` still shows the deleted user as signed in. The dead token stays, and every later page load runs the ~7s refresh-retry loop before ending in `AUTH_FAILED`.
- **Fix:** Route deletion through `AuthContext.signOut()` (or `setAllowAuthTokenRemoval`), use `scope: 'local'`, and do a full reload.
- **Confidence:** confirmed

### "Remove" on an accepted connection does nothing but reports success

- **Where:** `src/services/messaging/connection-service.ts:540-542`; `supabase/migrations/20251006_complete_monolithic_setup.sql:2996-2998`; `src/components/organisms/ConnectionManager/ConnectionManager.tsx:183`
- **Defect:** The only DELETE policy on `user_connections` is `auth.uid() = requester_id AND status = 'pending'`. RLS silently filters the delete to 0 rows, and the service checks only `error`.
- **Failure scenario:** Nobody can ever unfriend anyone. The row persists and keeps satisfying the connection-gated rules for 1:1 conversations and groups, and no error is shown.
- **Also:** The requester has no way to revoke at all (the UPDATE policy is addressee-only), and there is no unblock path for `blocked` rows. Two reviewers found this independently.
- **Fix:** Add a DELETE policy (or RPC) for either participant on `accepted` rows, and one for the blocker on `blocked` rows. Use `.select('id')` so the call throws on 0 rows.
- **Confidence:** confirmed

### Payment-isolation E2E tests pass without checking isolation

- **Where:** `tests/e2e/security/payment-isolation.spec.ts:113`, `:171`; `tests/e2e/auth/protected-routes.spec.ts:123`
- **Defect:** The "unauthenticated" test runs with the authenticated storageState, and its else-branch accepts any URL matching `/sign-in|payment-demo/`. "Only own payments" asserts only that the list renders. The RLS test's claim is a comment with no assertion.
- **Failure scenario:** Anonymous access to `/payment-demo`, or cross-user rows in payment history, ship green. Only the DB-level `tests/rls/payment-rls.test.ts` remains, and it can't see a client or query leak.
- **Fix:** Use a fresh context with no storageState and assert the redirect. Seed a payment for user B and assert it is absent for A.
- **Confidence:** confirmed

### PayPal subscription webhook writes values the CHECK constraints reject

- **Where:** `supabase/functions/paypal-webhook/index.ts:361`, `:365`, `:481`
- **Defect:** `plan_interval` comes from `tenure_type` (`'regular'`/`'trial'`), which is not in `('month','year')`. `plan_amount` falls back to `0`, which fails `>= 100`. `APPROVAL_PENDING` maps to `'pending'`, which is not in the status CHECK.
- **Failure scenario:** The webhook is the only writer of the `subscriptions` row. Every upsert fails with 23514 and returns 500, and the retry is then swallowed by the dedupe bug above. PayPal subscribers get no row and cannot cancel or resume in-app.
- **Fix:** Read interval and amount from the plan or the catalog, and skip non-ACTIVE states the way the Stripe handler does.
- **Confidence:** confirmed (code); plausible (live impact until exercised)

### Members can forge `created_at` and system messages on insert

- **Where:** `supabase/migrations/20251006_complete_monolithic_setup.sql:4835` (table-wide INSERT grant), `:3157-3159` (edit policy)
- **Defect:** No BEFORE INSERT trigger resets `created_at`, `is_system_message` or `system_message_type`, and the #281 trigger then freezes a forged `created_at`.
- **Failure scenario:** A message inserted with `created_at = 2099-01-01` is editable forever and pins the conversation to the top of the victim's list. A group member can also post a forged "ownership_transferred" system notice.
- **Fix:** In `assign_sequence_number()` or a new BEFORE INSERT trigger, force `created_at := now()` and reset the system and state columns for non-service callers. Alternatively, narrow the INSERT grant to a column list.
- **Confidence:** confirmed
- **Severity note:** Raised from P2 to P1 because of the forged system notices.

### Abstraction bake simplifies LOD0 in place, so every landmark ships at the far level

- **Where:** `scripts/warehouse/abstract-glb.mjs:210` (`mesh.clone()`), `:202` (`lodTris.LOD0` measured before the loop)
- **Defect:** glTF-Transform's `Mesh.clone()` shares Primitives by reference, so simplifying "LOD1" and "LOD2" simplifies LOD0's own geometry twice. `report.json` records LOD0 before this happens.
- **Failure scenario:** In all 129 committed `public/twins/chatt/models/*.glb`, LOD0, LOD1 and LOD2 point at the same accessors: 87,019 triangles each, about 675 per landmark. Landmarks render at the twice-simplified level. This is why `src/world/WarehouseModels.tsx:216-222` saw "no tri change" between LODs and removed `<Detailed>`, which is the LOD0-at-every-distance finding from the #1304 review. The `lod0Triangles` ceiling checks a number that doesn't describe the shipped files.
- **Fix:** Deep-copy the primitives and accessors per level before simplifying, compute `lodTris` from the final document, and assert the LOD accessor sets are disjoint. Then restore distance LOD switching.
- **Confidence:** confirmed (artifact evidence); the by-reference `clone()` behaviour is from the library's docs

### HouseModel mutates the cached GLTF scene, so the house is misplaced on remount

- **Where:** `src/world/HouseModel.tsx:276-329`, `:338`
- **Defect:** The centring offset is set on the shared `useGLTF` scene, and the next mount measures a box that already includes that offset.
- **Failure scenario:** Toggling As-built → Massing → As-built, or client-side navigation to `/chatt?diorama`, renders the scan metres off its footprint.
- **Fix:** Clone the scene per instance (as `WarehouseModels` does), or put the offset on a wrapper `<group>`.
- **Confidence:** confirmed

### Directory fly-to and gizmo base use narrow-frame anchors on the wide (chatt) site

- **Where:** `src/twin/useWarehouseEditor.ts:185-198`, `src/twin/TwinCanvas.client.tsx:494-499`
- **Defect:** `WideCity` and `hudLandmarks` reproject `models.json` anchors into the `atlasBox` frame, but `flyToModel` and `gizmoBase` use the raw narrow x/z.
- **Failure scenario:** On chatt, the only site with models, clicking a building in the HUD directory flies the camera about 1.1 km from it.
- **Fix:** Use one shared reprojection helper for all three.
- **Confidence:** confirmed

### Every new ground tile re-uploads every loaded tile texture

- **Where:** `src/world/Terrain.tsx:270-280`, `src/stage/materialKit.ts:17`
- **Defect:** `tileMaterials` rebuilds a material for all tiles on each arrival, and `drapedGround` sets `needsUpdate = true` on every texture.
- **Failure scenario:** With N tiles loaded, each arrival uploads N 1024² textures in one frame. This defeats the one-per-frame queue, and the hitch grows as you walk.
- **Fix:** Create and cache each tile's material once, when it is promoted.
- **Confidence:** confirmed

### Webhook liveness samples 1000 unfiltered log rows, so it can miss signature failures

- **Where:** `scripts/ci/check-webhook-liveness.mjs:147-165`
- **Defect:** The `function_logs` query has `limit 1000` with no `WHERE` or `ORDER BY`, and signature rejections are counted in JS over whichever rows come back.
- **Failure scenario:** On a busy day the page holds no rejection lines, so the check reports PASS while Stripe keeps refusing deliveries (#1180, with the check green).
- **Fix:** Filter the rejection messages in SQL, count them there, and fail if the result hits the cap.
- **Confidence:** confirmed (query shape); depends on log volume

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

### Real server-side revocation is hidden by the token-removal guard

- **Where:** `src/lib/supabase/client.ts:261-268`, `src/contexts/AuthContext.tsx:269-276`
- **Defect:** The adapter blocks every `auth-token` removal outside explicit sign-out, including auth-js `_removeSession()` after a refresh token is revoked. The stale token then makes the real SIGNED_OUT look spurious.
- **Failure scenario:** After a password reset elsewhere, "sign out everywhere", or a ban, the UI stays authenticated, the #1257 remote-sign-out key wipe doesn't run, and later loads end in `AUTH_FAILED`.
- **Fix:** Allow removal once `getUser()` confirms the session is invalid, instead of inferring validity from `expires_at`.
- **Confidence:** plausible

### Offline/fetch-failure history fallback always fails with "Conversation not found"

- **Where:** `src/services/messaging/message-service.ts:608`, `src/services/messaging/providers/supabase-provider.ts:228-241`
- **Defect:** `getConversationMeta` swallows `{ error }` and returns `null`, so after cached rows load, the method throws `ValidationError('Conversation not found')`. Online group sends on a flaky network (line 269) throw instead of queueing for the same reason. See also the UUID-ordering item under "Offline message cache" above.
- **Failure scenario:** Opening a previously viewed conversation offline errors instead of showing the cache. The IndexedDB cache path never works.
- **Fix:** Throw `ConnectionError` on `error`, and cache the metadata for offline use.
- **Confidence:** confirmed

### Live message sends retry a non-idempotent insert, which can duplicate messages

- **Where:** `src/services/messaging/providers/supabase-provider.ts:325-386`, `src/services/messaging/message-service.ts:424-461`
- **Defect:** Live inserts use `client_generated_id: null` and are retried up to 3 times on fetch errors. If they still fail, the message is queued again under a new UUID.
- **Failure scenario:** An insert commits but its response is lost, so the recipient sees the message two to four times.
- **Fix:** Mint one `client_generated_id` per `sendMessage`, upsert with `onConflict: 'client_generated_id'`, and reuse the id in the queue fallback.
- **Confidence:** plausible

### `hasKeys()` reports "no keys" on failure, which can lead to overwriting the keypair

- **Where:** `src/services/messaging/key-service.ts:496-550`; callers `src/components/auth/ReAuthModal/ReAuthModal.tsx:80,179`, `src/components/auth/SignInForm/SignInForm.tsx:164-169`
- **Defect:** `hasKeys()` returns false on session or query errors, and callers treat false as "new user" and call `initializeKeys()`, which doesn't check for existing keys itself. `fetchOwnEncryptionKey` was fixed for exactly this in #1038/#1040.
- **Failure scenario:** The session is mid-refresh when ReAuthModal opens, so the modal shows "setup" and a new key is created. All earlier 1:1 messages become "Encrypted with previous keys".
- **Fix:** Make `hasKeys()` throw on failure, and have `initializeKeys()` refuse when `active_key_count > 0`.
- **Confidence:** plausible

### Security, admin and payment Vitest suites run in no CI job

- **Where:** `vitest.config.ts:40-79`; `src/tests/integration/payment-isolation.test.ts`; `tests/contract/admin/admin-access.contract.test.ts`; `tests/contract/auth/sign-in.contract.test.ts`; `tests/integration/messaging/connections.test.ts:47-53`
- **Defect:** These files are excluded from the default config and not included by `vitest.rls.config.ts`, and no workflow runs them. `connections.test.ts` also asserts `toBeDefined()` on `id || ''`.
- **Failure scenario:** 25 admin-access contract tests and 11 payment-isolation tests never execute.
- **Fix:** Move the ones worth keeping into `vitest.rls.config.ts` (run by `conformance.yml`) and delete the rest.
- **Confidence:** confirmed

### Tests that cannot fail (service worker, typing indicator, admin, groups, a11y, consent)

Grouped, because they share one fix pattern: assert the positive outcome with no escape hatch.

- **Service-worker registration:** `tests/e2e/tests/pwa-installation.spec.ts:45-47,158` asserts `a || b || true`. The offline test at `:74-92,174-205` skips instead of failing when the SW doesn't activate.
- **Typing indicator:** `tests/e2e/messaging/real-time-delivery.spec.ts:185-310` has no typing-indicator assertion. One test wraps `toBeVisible()` in an empty `catch`. `tests/e2e/messaging/offline-queue-sync.spec.ts:100-110` waits 5s and asserts nothing.
- **Admin dashboard:** `tests/e2e/admin/admin-dashboard.spec.ts:224-226,272-278,359-368,437-442,503-510` has "if visible, expect visible" checks. The date-filter selector matches nothing, the `svgCount > 0` check is satisfied by nav icons, and the sort tests skip when controls are absent.
- **Group creation:** `tests/e2e/messaging/group-chat-multiuser.spec.ts:152-226` treats an error banner as the end of a passing test.
- **Group integration:** `tests/integration/messaging/group-creation.test.ts` asserts the mock's canned rows. Its escaped `` `member-\${i}` `` makes all 201 ids identical, and `rejects.toThrow()` accepts any error.
- **Offline queue unit test:** `src/tests/offline-integration.test.tsx:499-576` mocks keys the hook doesn't have (`queueSize` vs `queueCount`) and never asserts `registerBackgroundSync`.
- **Analytics consent:** `src/tests/analytics-consent-integration.test.tsx:65-92` never renders `GoogleAnalytics`, the component that actually gates GA.
- **A11y:** in `tests/e2e/accessibility/avatar-upload.a11y.test.ts:373-383` the else-branch is a tautology. `tests/e2e/tests/accessibility.spec.ts:196-208` checks that computed `outline || border` is truthy, which is always true.
- **Failure scenario:** SW registration, typing indicator, admin sort/stats, group creation, GA consent gating and visible focus can each regress while these tests stay green.
- **Confidence:** confirmed

### Avatar upload E2E spec is skipped in every CI lane

- **Where:** `tests/e2e/avatar/upload.spec.ts:25-28`
- **Defect:** `test.skip(!!process.env.CI, …)` skips all 9 tests, including on the local lane, which has its own Storage.
- **Failure scenario:** The #1068 class of avatar regression is never exercised before merge.
- **Fix:** Gate the skip on missing Storage, not on `CI`.
- **Confidence:** confirmed (the skip); plausible (that the local lane can run it)

### A create-order idempotency claim is never released, so the key returns 503 forever

- **Where:** `supabase/functions/create-order/index.ts:241`, `:276`; `supabase/functions/_shared/idempotency.ts`
- **Defect:** The key row is claimed with `result: {}` before validation, and refusals and insert failures never release or complete it. An empty result is read as "in flight", so the server answers 503.
- **Failure scenario:** A buyer enters a tip below the minimum and gets a 4xx. The page-load key is then stuck, so every later submit returns 503 until the page is reloaded. The offline queue replays the same key forever.
- **Fix:** On every non-success exit, delete the claim or store the refusal, and give in-flight claims a TTL.
- **Confidence:** confirmed

### User status update plus `resume-subscription` reopens the #1089 status flip

- **Where:** `supabase/migrations/20251006_complete_monolithic_setup.sql:1216-1218`; `supabase/functions/resume-subscription/index.ts:142-152`, `:196`
- **Defect:** RLS lets an owner set `status='canceled'` from any status, and resume then writes `active` without checking the provider's own status.
- **Failure scenario:** A user PATCHes a `past_due` sub to canceled and then resumes it. The row becomes `active` while Stripe still says past_due, which inflates `admin_payment_stats` and escapes the #242 one-live-per-user index.
- **Fix:** Drop the client UPDATE grant, since `cancel-subscription` already does this server-side, and check the provider's status in resume.
- **Confidence:** confirmed (logic); plausible (business impact)

### Orphan sweep reads only 1000 orders, then deletes attachments that orders still reference

- **Where:** `supabase/functions/sweep-intake-orphans/index.ts:93`, `:107`; `.github/workflows/intake-orphan-sweep.yml:78`
- **Defect:** The `orders` select is capped by `max_rows = 1000`, the root listing is capped at 100, and neither is paged.
- **Failure scenario:** Once there are more than 1000 orders, attachments for real orders are deleted by the weekly `mode=delete` run.
- **Fix:** Page both reads, and refuse to delete when either read could have been truncated.
- **Confidence:** confirmed (latent until more than 1000 orders)

### Test-user seed makes the monolithic migration non-re-runnable on Supabase Cloud

- **Where:** `supabase/migrations/20251006_complete_monolithic_setup.sql:1-8`, `:2869-2934`
- **Defect:** The guarded `DELETE FROM auth.users` is skipped on Cloud, and the seed INSERT handler doesn't catch `unique_violation`/`insufficient_privilege`. It also seeds a publicly documented credential into production.
- **Failure scenario:** A Cloud re-run aborts the whole `BEGIN…COMMIT`.
- **Fix:** Use `WHERE NOT EXISTS` and a wider handler, or better, move test-user seeding into the existing seed script.
- **Confidence:** plausible (depends on Cloud's auth.users privileges)

### Streamed ground-tile textures are never evicted or disposed

- **Where:** `src/world/Terrain.tsx:99-169`, `:303-311`; `src/world/groundTiles.ts:262-264`
- **Defect:** `tileTextures` only grows. `RADIUS_M` limits fetching, not retention, and nothing disposes the textures or closes the bitmaps.
- **Failure scenario:** Walking across downtown keeps hundreds of MB to GB resident, so mobile GPUs lose context, and all of it leaks on unmount.
- **Fix:** Evict tiles beyond about 1.5×`RADIUS_M` (`dispose()` + `bitmap.close()`), and dispose everything on unmount.
- **Confidence:** confirmed

### Placement editor is inert on the wide site

- **Where:** `src/world/TwinWorld.tsx:161-178`
- **Defect:** The wide branch drops `modelOverrides`/`registerModelGroup`, so `WarehouseModels` never receives them.
- **Failure scenario:** On `/chatt?edit` no gizmo appears, and nudges save to localStorage but nothing moves.
- **Fix:** Forward them through `WideCity` (reprojected), or hide edit mode on wide sites.
- **Confidence:** confirmed

### Model budget gate never runs in CI and sums LOD2 while the runtime draws LOD0

- **Where:** `scripts/warehouse/__tests__/budget.test.ts:14-31`, `:76-84`; `docs/twins/chatt-historic-route.md:44-47`; `src/world/WarehouseModels.tsx:5`
- **Defect:** The gate reads the gitignored `sites/_warehouse/report.json` and `skipIf`s without it, even though the 129 GLBs are committed. The whole-set total sums LOD2, and the route doc budgets as if LOD2 is drawn city-wide.
- **Failure scenario:** Heavier GLBs merge green. Once the bake bug is fixed, the 150k ceiling won't see the geometry that is actually drawn.
- **Fix:** Measure the committed GLBs directly, budget on LOD0 while LOD0 is what renders, and update the route doc and the header comment.
- **Confidence:** confirmed

### Declared CSP would block live aerial tiles once enforced

- **Where:** `scripts/ci/cloudflare-intent.mjs:108-122`; `src/world/groundTiles.ts:194-197`, `src/world/Terrain.tsx:118-125,165`
- **Defect:** `ImageBitmapLoader` uses `fetch()`, which falls under `connect-src`, and `mapsdev.hamiltontn.gov` isn't listed there.
- **Failure scenario:** When `CSP_MODE` flips to enforce, every tile is silently blocked. The ground stays blurry and the roads disappear too.
- **Fix:** Add the origin to `connect-src`, and gate `Roads` on tiles actually loading.
- **Confidence:** confirmed

### Contact form rejects names with non-ASCII letters

- **Where:** `src/schemas/contact.schema.ts:17`, `:198`
- **Defect:** `/^[a-zA-Z\s\-'\.]+$/` allows only ASCII letters.
- **Failure scenario:** "José Núñez", "Zoë" and "李雷" cannot submit the contact form.
- **Fix:** Use `/^[\p{L}\p{M}\s\-'.]+$/u` in both places.
- **Confidence:** confirmed

### Webhook liveness turns a failed 5xx query into "0 errors" and passes

- **Where:** `scripts/ci/check-webhook-liveness.mjs:177-196`
- **Defect:** The catch sets `serverErrors = 0` and `evaluate()` returns PASS, which contradicts its own comment.
- **Failure scenario:** After a log schema change, the 5xx signal disappears for good and the job stays green.
- **Fix:** Keep the value unknown, and don't PASS on an unobserved signal.
- **Confidence:** confirmed

### Hosted `Test Report` ignores the shard jobs' own result

- **Where:** `.github/workflows/e2e.yml:1296-1413`
- **Defect:** The verdict fails only on failing tests in the merged blobs, and never checks `needs.*.result` or the blob count. The local lane got this guard in #934; the hosted lane didn't.
- **Failure scenario:** A shard that dies before writing a blob leaves `Test Report` green.
- **Fix:** Fail unless every non-skipped shard succeeded and the blob count matches the shard count.
- **Confidence:** confirmed

### Docs-only skip removes coverage for vitest tests that read markdown

- **Where:** `scripts/ci/ci-docs-only.mjs:62-70`; `.github/workflows/ci.yml:174-176`
- **Defect:** `*.md` and `docs/**` count as inert, but `tests/unit/no-build-in-dev-container.test.ts` and `src/config/__tests__/site-claims.test.ts` assert on markdown.
- **Failure scenario:** A docs-only PR that reintroduces `docker compose exec … pnpm build` (#293) passes the required `Test (20.x)`.
- **Fix:** Always run the markdown-reading vitest files.
- **Confidence:** confirmed

### Sitemap/robots fallback hardcodes owner `TortoiseWolfe`

- **Where:** `scripts/site-url.js:42-44`
- **Defect:** The repo name falls back to `project-detected.json`, but the owner falls back to the literal.
- **Failure scenario:** A fork's `sitemap.xml`/`robots.txt`/RSS advertise `tortoisewolfe.github.io/<fork>`.
- **Fix:** Fall back to the detected `projectOwner` first.
- **Confidence:** confirmed

### Required `Auth Config Drift result` fails on fork PRs that touch auth paths

- **Where:** `.github/workflows/auth-config-drift.yml:84-103`, `:158-161`
- **Defect:** On fork PRs the secret is empty but the `vars` value is set, so the preflight exits "half-configured" before the fork skip is reached.
- **Failure scenario:** An outside contributor gets a permanently red required check.
- **Fix:** Detect fork PRs in the preflight, before the half-configured test.
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

### Non-retryable message send errors are queued as "pending" instead of shown

- **Where:** `src/services/messaging/message-service.ts:431-461`
- **Defect:** Every provider error is queued, including RLS denials.
- **Failure scenario:** A removed group member's message shows as queued, then silently fails after 5 syncs.
- **Fix:** Queue only network-class errors, and rethrow the rest to the UI.
- **Confidence:** plausible

### A declined requester can never re-request and gets a raw DB error

- **Where:** `src/services/messaging/connection-service.ts:147-157`
- **Defect:** The pre-check ignores `status = 'declined'`, so the insert hits the `unique_connection` constraint, and RLS stops the requester deleting the row.
- **Failure scenario:** Every later request fails with "duplicate key value…" permanently.
- **Fix:** Handle `declined` explicitly, with a clear message or a reset path.
- **Confidence:** confirmed

### `refreshSession`/`retry` in AuthContext ignore returned errors

- **Where:** `src/contexts/AuthContext.tsx:408-412`, `:419-424`
- **Defect:** Both destructure only `data`, and Supabase returns errors rather than throwing them.
- **Failure scenario:** A network blip during `refreshSession()` after a profile update shows the user as signed out while the token and keys remain.
- **Fix:** Check `error`, keep the current session on failure, and set the error state.
- **Confidence:** confirmed

### Fixed waits and one-shot counts in E2E that race or turn into silent skips

- **Where:** `tests/e2e/admin/admin-user-pagination.spec.ts:233-244`, `tests/e2e/payment/05-offline-queue.spec.ts:92,116-118`, `tests/e2e/admin/admin-dashboard.spec.ts:332-333`, `tests/e2e/auth/protected-routes.spec.ts:103-110`
- **Defect:** These tests use fixed `waitForTimeout` values and one-shot `count()` reads that choose between skipping and asserting. The protected-routes skip ("transient WebKit issue") applies on every browser.
- **Failure scenario:** Intermittent red on healthy code, or regressions that turn into skips.
- **Fix:** Use `expect.poll`/`toContainText`, and scope the WebKit skip to `browserName === 'webkit'`.
- **Confidence:** confirmed (code); plausible (observed flake)

### Ground-tile planner maps and sorts the whole grid every idle frame

- **Where:** `src/world/Terrain.tsx:142-149`
- **Defect:** Each frame with fewer than 6 fetches in flight builds about 1,989 objects, then sorts and searches them, forever.
- **Failure scenario:** Steady GC churn for the lifetime of the diorama.
- **Fix:** Re-plan only after camera movement or on a timer.
- **Confidence:** confirmed

### Player walk cycle advances twice per frame

- **Where:** `src/agents/playerCharacter.tsx:141`
- **Defect:** drei's `useAnimations` already calls `mixer.update`, and this component calls it again.
- **Failure scenario:** The walk plays at 2× speed and the feet slide.
- **Fix:** Remove the manual `mixer.update(dt)`.
- **Confidence:** confirmed

### Stale payment.ts comment says the PayPal per-SKU plan defect is still open

- **Where:** `src/config/payment.ts:114-118`
- **Defect:** The comment says "STILL OPEN HERE", but `create-paypal-subscription/resolve.ts:117` already resolves per SKU.
- **Failure scenario:** Someone "fixes" or reports a defect that doesn't exist.
- **Fix:** Point the comment at `resolve.ts` / #774.
- **Confidence:** confirmed

### a11y check audits unstyled pages in forks that deploy under a base path

- **Where:** `.github/workflows/accessibility.yml`, `config/pa11yci.json`
- **Defect:** The build doesn't set `DISABLE_BASE_PATH`, so `/_next/` assets 404 under `serve out`.
- **Failure scenario:** In a fork with no custom domain, pa11y passes against unstyled HTML.
- **Fix:** Set `DISABLE_BASE_PATH: 'true'`, as the E2E workflows do.
- **Confidence:** confirmed (only in that configuration)

### Dispatching E2E (local) tests a months-old commit by default

- **Where:** `.github/workflows/e2e-local.yml:64-67`
- **Defect:** The dispatch input `ref` defaults to the August parity-baseline SHA.
- **Failure scenario:** A dispatch run meant to cover a branch tests the baseline instead.
- **Fix:** Default `ref` to empty, and pass the baseline explicitly for parity runs.
- **Confidence:** confirmed

### Secret and dispatch input interpolated directly into `run:` scripts

- **Where:** `.github/workflows/deploy.yml:59`, `.github/workflows/e2e-local.yml:833`
- **Defect:** The code uses `${{ secrets.… }}` and `${{ inputs.ref }}` inside bash rather than `env:`.
- **Failure scenario:** A value containing `$(…)` or `"` runs as shell. Reaching it needs write access, so this is hardening.
- **Fix:** Pass the values via `env:`, and validate `ref` as hex.
- **Confidence:** confirmed
