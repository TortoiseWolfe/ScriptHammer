/**
 * Edge-runtime main service — the router the local Supabase stack was missing.
 *
 * WHY THIS FILE EXISTS. `supabase/edge-runtime` does not serve a directory of
 * functions directly. It boots ONE "main" service, and that service is
 * responsible for spawning a user worker per request based on the path. The
 * official self-hosting compose ships exactly this shim; this repo's local stack
 * was assembled without the edge-runtime leg at all, so it never got one — which
 * is why `POST /functions/v1/<name>` 404'd locally while working in production.
 *
 * WHY IT LIVES IN docker/ RATHER THAN supabase/functions/. Everything under
 * `supabase/functions/` is a deployable function. Putting the router there would
 * make it look like one, and it would be swept up by any deploy that enumerates
 * that directory. It is infrastructure, so it sits with the other local-stack
 * infrastructure next to kong.yml.
 *
 * LOCAL DEVELOPMENT ONLY. Production Edge Functions are deployed to Supabase's
 * own managed runtime via the Management API; nothing here ships.
 */

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

/** Per-worker limits. Generous for local dev; the managed runtime sets its own. */
const MEMORY_LIMIT_MB = 256;
const WORKER_TIMEOUT_MS = 5 * 60 * 1000;

serve(async (req: Request) => {
  const { pathname } = new URL(req.url);

  // Kong strips `/functions/v1`, so what arrives is `/<function-name>/...`.
  const functionName = pathname.split('/')[1];

  if (!functionName) {
    return new Response(
      JSON.stringify({ error: 'missing function name in request' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const servicePath = `/home/deno/functions/${functionName}`;

  try {
    const worker = await (globalThis as any).EdgeRuntime.userWorkers.create({
      servicePath,
      memoryLimitMb: MEMORY_LIMIT_MB,
      workerTimeoutMs: WORKER_TIMEOUT_MS,
      noModuleCache: false,
      importMapPath: null,
      // Inherit the stack's env so functions see SUPABASE_URL, the service-role
      // key, and the provider secrets exactly as they do in production.
      envVars: Object.entries(Deno.env.toObject()),
    });
    return await worker.fetch(req);
  } catch (err) {
    // A missing directory is by far the most common cause, and "worker boot
    // failed" on its own sends people hunting the wrong thing. Name the function
    // and the path so the message is actionable.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[edge-main] ${functionName} failed to boot: ${message}`);
    return new Response(
      JSON.stringify({
        error: `Function '${functionName}' could not be started`,
        detail: message,
        hint: `Expected supabase/functions/${functionName}/index.ts to exist`,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
