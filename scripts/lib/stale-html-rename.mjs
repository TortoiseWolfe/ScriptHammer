/**
 * The filename a simulated deploy gives a content-hashed asset (#1278).
 *
 * `check-stale-html.mjs` models deploys by renaming every stylesheet. It used a fixed
 * transform — reverse the hex hash, map f→a and a–e→f — which is different for ONE
 * generation but, composed with itself, is the identity for any hash whose only letters are
 * `a` and `f` (~1% of hashes). The #548 burst scenario renames twice (A → B → C), so for
 * those hashes build C carried build A's exact filename, A's stale HTML found its stylesheet,
 * and the harness's negative control reported itself broken: a required check going red on
 * about one build in twenty, for no reason in the change under test.
 *
 * The generation tag is now part of the input, and the output comes from SHA-256, so no two
 * generations share a name except by a hash collision — and check-stale-html.mjs asserts
 * that directly rather than trusting it.
 */
import { createHash } from 'node:crypto';

/** `abc123….css` → a same-length hex hash derived from (tag, original name). */
export function renameHash(file, tag) {
  const next = file.replace(/^[a-f0-9]+/, (h) =>
    createHash('sha256')
      .update(`${tag}:${file}`)
      .digest('hex')
      .slice(0, h.length)
  );
  if (next === file)
    throw new Error(`rename produced the same name for ${file} (${tag})`);
  return next;
}
