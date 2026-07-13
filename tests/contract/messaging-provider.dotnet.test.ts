/**
 * .NET runner for the shared messaging-provider conformance suite (#266).
 *
 * DORMANT until an ASP.NET messaging server exists: gated on
 * `process.env.DOTNET_API_URL`. When that server is built, this runner supplies
 * `setup`/`teardown` that seed via the .NET admin API and drive the
 * DotnetMessagingProvider — running the IDENTICAL C1–C29 assertions the Supabase
 * runner passes. If the .NET backend drops a rule, this suite goes red, which is
 * the whole point: the contract is measured, not trusted.
 *
 * Authored-and-skipped now so the anti-drift harness is in place before the
 * server lands (and so reviewers can see exactly what the .NET side must satisfy).
 *
 * @module tests/contract/messaging-provider.dotnet.test
 */

import { describe, it } from 'vitest';

const DOTNET_API_URL = process.env.DOTNET_API_URL;

if (!DOTNET_API_URL) {
  describe.skip('MessagingDataProvider contract [dotnet]', () => {
    it('runs once DOTNET_API_URL points at a live ASP.NET messaging server', () => {
      // Intentionally empty — the real runner (mirroring the Supabase runner:
      // seed users + conversation via the .NET admin API, build a
      // DotnetMessagingProvider per user, call runMessagingProviderContract)
      // is wired when the server exists. See messaging-provider.supabase.test.ts
      // for the shape to mirror.
    });
  });
} else {
  // When the .NET server exists, import runMessagingProviderContract and the
  // DotnetMessagingProvider here and supply setup/teardown against the .NET
  // admin API — identical assertions, different backend.
  throw new Error(
    'DOTNET_API_URL is set but the .NET conformance runner is not implemented yet (#266 follow-up). ' +
      'Unset DOTNET_API_URL or implement the runner mirroring messaging-provider.supabase.test.ts.'
  );
}
