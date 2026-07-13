/**
 * Real-crypto round-trip guard for the deterministic group-E2E fixture.
 *
 * The E2E fixture `seedIsolatedGroup(N, { withKeys: true })` distributes a group
 * key server-side (Node) by re-deriving the CREATOR's private key from their
 * stored *base64* `encryption_salt` and wrapping one AES-GCM group key for each
 * member via the real `GroupKeyService.encryptGroupKeyForMember`. At runtime a
 * member unwraps it with `ECDH(memberPriv, creatorPub)` inside their browser.
 *
 * This test exercises that EXACT contract with REAL crypto (no mocks) — the same
 * `deriveKeyPair`/`encryptGroupKeyForMember`/`decryptGroupKey` code the fixture
 * and the app use. Its whole job is to fail fast (~seconds, no browser) if the
 * fixture's wrap would ever drift from what the app can unwrap — most likely
 * culprit being the base64-salt → Uint8Array decode. If this is green, a red
 * E2E is an environment/UI problem, not a crypto-contract problem.
 *
 * NOTE: unlike `group-key-service.test.ts` (which mocks crypto), this file uses
 * real Web Crypto + real Argon2id, so it derives only 2 keypairs to stay fast.
 */

import { describe, it, expect } from 'vitest';
import { KeyDerivationService } from '@/lib/messaging/key-derivation';
import { GroupKeyService } from '@/services/messaging/group-key-service';
import { encryptionService } from '@/lib/messaging/encryption';

/** base64 → Uint8Array, matching the fixture's stored-salt decode. */
function b64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

describe('group-key fixture round-trip (real crypto)', () => {
  it('creator-wrapped group key unwraps for a member and decrypts a message', async () => {
    const kds = new KeyDerivationService();
    const gks = new GroupKeyService();
    const password = 'TestPassword123!';

    // Two members: creator C (= group_keys.created_by) and member B. The fixture
    // stores each user's salt as base64; re-derive from the base64 form to
    // exercise the exact decode the fixture uses.
    const creatorSaltB64 = Buffer.from(kds.generateSalt()).toString('base64');
    const memberSaltB64 = Buffer.from(kds.generateSalt()).toString('base64');

    const creator = await kds.deriveKeyPair({
      password,
      salt: b64ToBytes(creatorSaltB64),
    });
    const member = await kds.deriveKeyPair({
      password,
      salt: b64ToBytes(memberSaltB64),
    });

    // Re-deriving from the same base64 salt must reproduce the stored public key
    // (the fixture asserts this too — a mismatch means the runtime ECDH
    // counterparty wouldn't line up).
    const creatorReDerived = await kds.deriveKeyPair({
      password,
      salt: b64ToBytes(creatorSaltB64),
    });
    expect(
      kds.verifyPublicKey(creator.publicKeyJwk, creatorReDerived.publicKeyJwk)
    ).toBe(true);

    // One group key, wrapped FOR the member using the CREATOR's private key —
    // exactly what distributeGroupKeysForFixture writes into group_keys.
    const groupKey = await gks.generateGroupKey();
    const encryptedKey = await gks.encryptGroupKeyForMember(
      groupKey,
      member.publicKeyJwk,
      creator.privateKey
    );

    // Member unwraps with the CREATOR's public key (the created_by lookup path
    // in getGroupKeyForConversation) + their own private key.
    const unwrapped = await gks.decryptGroupKey(
      encryptedKey,
      creator.publicKeyJwk,
      member.privateKey
    );

    // The unwrapped key must be byte-identical to the original group key.
    const originalBytes = new Uint8Array(await gks.exportKeyBytes(groupKey));
    const unwrappedBytes = new Uint8Array(await gks.exportKeyBytes(unwrapped));
    expect(unwrappedBytes).toEqual(originalBytes);

    // End-to-end: a message encrypted with the group key decrypts with the
    // member's unwrapped copy — the full send→decrypt path the E2E proves.
    const plaintext = `deterministic group hello ${originalBytes.length}`;
    const { ciphertext, iv } = await encryptionService.encryptMessage(
      plaintext,
      groupKey
    );
    const decrypted = await encryptionService.decryptMessage(
      ciphertext,
      iv,
      unwrapped
    );
    expect(decrypted).toBe(plaintext);
  });

  it('#243: group history survives the creator rotating their personal keys', async () => {
    const kds = new KeyDerivationService();
    const gks = new GroupKeyService();
    const password = 'TestPassword123!';

    const creatorSalt = kds.generateSalt();
    const memberSalt = kds.generateSalt();

    // Creator's ORIGINAL keypair — the one that wraps the group key. This is the
    // JWK we now persist as group_keys.creator_public_key.
    const creatorOld = await kds.deriveKeyPair({ password, salt: creatorSalt });
    const member = await kds.deriveKeyPair({ password, salt: memberSalt });

    const groupKey = await gks.generateGroupKey();
    const encryptedKey = await gks.encryptGroupKeyForMember(
      groupKey,
      member.publicKeyJwk,
      creatorOld.privateKey
    );

    // The creator ROTATES their personal keys (new salt → a different keypair).
    // getUserPublicKey would now return creatorNew.publicKeyJwk — the pre-#243
    // reader used this and bricked history.
    const creatorNew = await kds.deriveKeyPair({
      password,
      salt: kds.generateSalt(),
    });
    expect(
      kds.verifyPublicKey(creatorOld.publicKeyJwk, creatorNew.publicKeyJwk)
    ).toBe(false);

    // PIN THE BUG: unwrapping with the creator's NEW (rotated) public key fails
    // — the ECDH secret no longer matches what wrapped the key.
    await expect(
      gks.decryptGroupKey(
        encryptedKey,
        creatorNew.publicKeyJwk,
        member.privateKey
      )
    ).rejects.toThrow();

    // THE FIX: unwrapping with the stored wrap-time creator public key
    // (creator_public_key on the row) still succeeds after rotation.
    const unwrapped = await gks.decryptGroupKey(
      encryptedKey,
      creatorOld.publicKeyJwk,
      member.privateKey
    );
    const originalBytes = new Uint8Array(await gks.exportKeyBytes(groupKey));
    const unwrappedBytes = new Uint8Array(await gks.exportKeyBytes(unwrapped));
    expect(unwrappedBytes).toEqual(originalBytes);

    // And a message encrypted before the rotation still decrypts — history intact.
    const plaintext = 'message from before the rotation';
    const { ciphertext, iv } = await encryptionService.encryptMessage(
      plaintext,
      groupKey
    );
    expect(
      await encryptionService.decryptMessage(ciphertext, iv, unwrapped)
    ).toBe(plaintext);
  });
});
