/**
 * Mailpit REST helper for the real-form signup E2E (#288, item 3).
 *
 * The local Supabase stack ships Mailpit (docker service `supabase-mail`) as the
 * SMTP sink for GoTrue. With `GOTRUE_MAILER_AUTOCONFIRM=false`, a real signup
 * emits a confirmation email here — so the E2E can read it and click the link,
 * exercising the mailer path that silently broke in #287 (email delivery dead,
 * every test still green because they used `admin.createUser`).
 *
 * `MAILPIT_URL` selects the API base: `http://localhost:54324` (runner/CI, the
 * published host port) or `http://supabase-mail:8025` (inside the compose network).
 *
 * @module tests/e2e/utils/mailpit
 */

const BASE = (process.env.MAILPIT_URL || 'http://localhost:54324').replace(
  /\/$/,
  ''
);

interface MessageSummary {
  ID: string;
}

export interface MailpitMessage {
  ID: string;
  Subject: string;
  Text: string;
  HTML: string;
}

async function mailpitJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    throw new Error(`Mailpit GET ${path} → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

/**
 * Poll Mailpit until a message addressed to `email` arrives, then return its full
 * body. Throws (loudly) on timeout — a real signup that produces NO confirmation
 * email is exactly the #287 failure this test exists to catch, so it must fail,
 * never silently skip.
 */
export async function waitForMessageTo(
  email: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<MailpitMessage> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const intervalMs = opts.intervalMs ?? 1_000;
  const deadline = Date.now() + timeoutMs;
  let lastError = '';

  while (Date.now() < deadline) {
    try {
      const data = await mailpitJson<{ messages: MessageSummary[] }>(
        `/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`
      );
      if (data.messages.length > 0) {
        return getMessage(data.messages[0].ID);
      }
    } catch (err) {
      lastError = (err as Error).message;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Mailpit: no email to ${email} within ${timeoutMs}ms` +
      (lastError ? ` (last error: ${lastError})` : '') +
      '. This is the #287 signal — a real signup produced NO confirmation email.'
  );
}

/** Fetch a single message's full body (Text + HTML) by id. */
export async function getMessage(id: string): Promise<MailpitMessage> {
  return mailpitJson<MailpitMessage>(`/api/v1/message/${id}`);
}

/**
 * Extract the Supabase confirmation link (`{API_EXTERNAL_URL}/auth/v1/verify?...`)
 * from an email body. Prefers the plain-text part; falls back to HTML (whose query
 * `&` are entity-encoded, so decode `&amp;`).
 */
export function extractConfirmationLink(msg: MailpitMessage): string {
  const body = `${msg.Text || ''}\n${msg.HTML || ''}`;
  // Matches both the correct `…/auth/v1/verify?…` (Kong-routed) and a bare
  // `…/verify?…` (GoTrue default), so a URLPATHS misconfig surfaces as a 404 on
  // click rather than a silent no-match here.
  const match = body.match(/https?:\/\/[^\s"'<>]+\/verify\?[^\s"'<>]+/);
  if (!match) {
    throw new Error(
      `No /auth/v1/verify confirmation link found in email "${msg.Subject}".`
    );
  }
  return match[0].replace(/&amp;/g, '&');
}

/** Delete all captured messages — teardown / per-test isolation. */
export async function clearMailbox(): Promise<void> {
  await fetch(`${BASE}/api/v1/messages`, { method: 'DELETE' }).catch(() => {});
}
