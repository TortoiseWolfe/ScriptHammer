/**
 * Value-aware comparison for Edge Function secrets (#1182).
 *
 * Lives in its own .mjs so both the TypeScript setter and a plain `node --test` file can use
 * it: `pnpm test:scripts` runs `node --test` without tsx, so a .test.js cannot import a .ts.
 * Same arrangement as scripts/ci/policy-predicates.mjs.
 *
 * WHY THIS EXISTS. set-edge-function-secrets.ts used to diff by NAME, and read desired state
 * from `.env`. So "already correct" and "about to be replaced with something else" printed
 * identically, and `--apply` POSTed every allow-listed key unconditionally. That is a live
 * credential hazard rather than a tidiness one: `STRIPE_SECRET_KEY` must be the LIVE key in
 * the function runtime, while `.env` must stay test-mode (.env.example:317-322 — the E2E
 * fixture provisions REAL subscriptions with it). One `--apply` would push sk_test_ over
 * production and report "8 secret(s) set and verified".
 *
 * WHAT MAKES IT POSSIBLE. `GET /v1/projects/{ref}/secrets` returns a SHA-256 DIGEST in
 * `value`, not the secret — every entry is 64 lowercase hex characters regardless of the real
 * length. So "deployed == local" is provable without ever reading the deployed secret back.
 */

import { createHash } from 'node:crypto';

/** @param {string} value @returns {string} lowercase hex sha256, as the API returns it */
export const digest = (value) =>
  createHash('sha256').update(value, 'utf8').digest('hex');

/**
 * Sort each desired secret against what is deployed. Pure: no network, no env, no clock.
 *
 *   NEW        the name is absent upstream
 *   UNCHANGED  the deployed digest already equals sha256(local) — writing it is a no-op
 *   OVERWRITE  a DIFFERENT value is deployed. The deployed one may be the CORRECT one, and
 *              this script cannot read it back to find out. Hence the --force gate.
 *
 * @param {Record<string,string>} desired  name -> local plaintext value
 * @param {Map<string,string>} deployed    name -> digest, from the Management API
 * @returns {{fresh: string[], unchanged: string[], overwrite: string[]}}
 */
export function classifySecrets(desired, deployed) {
  /** @type {string[]} */ const fresh = [];
  /** @type {string[]} */ const unchanged = [];
  /** @type {string[]} */ const overwrite = [];

  for (const name of Object.keys(desired)) {
    const remote = deployed.get(name);
    if (remote === undefined) fresh.push(name);
    else if (remote === digest(desired[name])) unchanged.push(name);
    else overwrite.push(name);
  }

  return { fresh, unchanged, overwrite };
}

/**
 * Which names `--apply` would actually write, given the classification and --force.
 * Separated from classifySecrets so the refusal is testable on its own.
 *
 * @param {{fresh: string[], overwrite: string[]}} c
 * @param {boolean} force
 * @returns {string[]}
 */
export function namesToWrite(c, force) {
  return force ? [...c.fresh, ...c.overwrite] : [...c.fresh];
}
