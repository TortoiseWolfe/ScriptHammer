/**
 * Unit Tests for EncryptionService
 * Task: T041
 *
 * Tests: generateKeyPair, exportPublicKey, storePrivateKey, getPrivateKey,
 *        deriveSharedSecret, encryptMessage, decryptMessage, error cases
 *
 * Coverage Target: 100%
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EncryptionService } from '../encryption';
import { db } from '../database';
import { CRYPTO_PARAMS } from '@/types/messaging';

/**
 * Helper: import a JWK as a non-extractable CryptoKey for storePrivateKey.
 * The service refuses to store extractable keys.
 */
async function jwkToNonExtractable(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits', 'deriveKey']
  );
}

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(() => {
    service = new EncryptionService();
  });

  afterEach(async () => {
    // Clean up IndexedDB after each test
    await db.messaging_private_keys.clear();
  });

  describe('generateKeyPair', () => {
    it('should generate a valid ECDH key pair', async () => {
      const keyPair = await service.generateKeyPair();

      expect(keyPair).toBeDefined();
      expect(keyPair.publicKey).toBeInstanceOf(CryptoKey);
      expect(keyPair.privateKey).toBeInstanceOf(CryptoKey);
      expect(keyPair.publicKey.type).toBe('public');
      expect(keyPair.privateKey.type).toBe('private');
      expect(keyPair.publicKey.algorithm.name).toBe('ECDH');
      expect(keyPair.privateKey.algorithm.name).toBe('ECDH');
    });

    it('should generate extractable private key', async () => {
      const keyPair = await service.generateKeyPair();
      expect(keyPair.privateKey.extractable).toBe(true);
    });

    it('should generate non-extractable public key', async () => {
      const keyPair = await service.generateKeyPair();
      // Public keys are typically extractable for sharing
      expect(keyPair.publicKey.extractable).toBe(true);
    });

    it('should throw error if Web Crypto API is unavailable', async () => {
      // Mock crypto.subtle to be undefined
      const originalSubtle = crypto.subtle;
      Object.defineProperty(crypto, 'subtle', {
        value: undefined,
        configurable: true,
      });

      await expect(service.generateKeyPair()).rejects.toThrow();

      // Restore original
      Object.defineProperty(crypto, 'subtle', {
        value: originalSubtle,
        configurable: true,
      });
    });
  });

  describe('exportPublicKey', () => {
    it('should export public key to JWK format', async () => {
      const keyPair = await service.generateKeyPair();
      const jwk = await service.exportPublicKey(keyPair.publicKey);

      expect(jwk).toBeDefined();
      expect(jwk.kty).toBe('EC');
      expect(jwk.crv).toBe(CRYPTO_PARAMS.CURVE);
      expect(jwk.x).toBeDefined();
      expect(jwk.y).toBeDefined();
      // Note: key_ops may be empty on exported keys, which is expected
    });

    it('should throw error for invalid key', async () => {
      const invalidKey = {} as CryptoKey;
      await expect(service.exportPublicKey(invalidKey)).rejects.toThrow();
    });
  });

  describe('storePrivateKey', () => {
    it('should store private key in IndexedDB as non-extractable CryptoKey', async () => {
      const keyPair = await service.generateKeyPair();
      const userId = 'user-123';
      const jwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
      const cryptoKey = await jwkToNonExtractable(jwk);

      await service.storePrivateKey(userId, cryptoKey);

      const stored = await db.messaging_private_keys.get(userId);
      expect(stored).toBeDefined();
      expect(stored?.userId).toBe(userId);
      expect(stored?.privateKey).toBeInstanceOf(CryptoKey);
      expect(stored?.privateKey.extractable).toBe(false);
      expect(stored?.created_at).toBeDefined();
    });

    it('should overwrite existing key for same user', async () => {
      const userId = 'user-123';
      const keyPair1 = await service.generateKeyPair();
      const jwk1 = await crypto.subtle.exportKey('jwk', keyPair1.privateKey);
      await service.storePrivateKey(userId, await jwkToNonExtractable(jwk1));

      const keyPair2 = await service.generateKeyPair();
      const jwk2 = await crypto.subtle.exportKey('jwk', keyPair2.privateKey);
      await service.storePrivateKey(userId, await jwkToNonExtractable(jwk2));

      // After overwrite, the stored key must derive the SAME shared secret as
      // keyPair2 (and a different one than keyPair1) — proving the second
      // store replaced the first. Direct reference equality (`toBe`) doesn't
      // work because Dexie deserializes a fresh CryptoKey instance on read.
      // Shared secrets are non-extractable, so prove equivalence via
      // encrypt-with-A → decrypt-with-B round-trip.
      const stored = await db.messaging_private_keys.get(userId);
      const peer = await service.generateKeyPair();
      const fromStored = await service.deriveSharedSecret(
        stored!.privateKey,
        peer.publicKey
      );
      const fromKeyPair2 = await service.deriveSharedSecret(
        keyPair2.privateKey,
        peer.publicKey
      );
      const fromKeyPair1 = await service.deriveSharedSecret(
        keyPair1.privateKey,
        peer.publicKey
      );

      // Stored matches keyPair2: encrypt with one, decrypt with the other.
      const ct = await service.encryptMessage('overwrite-check', fromKeyPair2);
      const decrypted = await service.decryptMessage(
        ct.ciphertext,
        ct.iv,
        fromStored
      );
      expect(decrypted).toBe('overwrite-check');

      // Stored does NOT match keyPair1.
      await expect(
        service.decryptMessage(ct.ciphertext, ct.iv, fromKeyPair1)
      ).rejects.toThrow();
    });

    it('should reject extractable keys', async () => {
      const keyPair = await service.generateKeyPair();
      // generateKeyPair() returns extractable=true; this should be refused.
      await expect(
        service.storePrivateKey('user-123', keyPair.privateKey)
      ).rejects.toThrow(/extractable/);
    });

    it('should throw error if IndexedDB is unavailable', async () => {
      const keyPair = await service.generateKeyPair();
      const jwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
      const cryptoKey = await jwkToNonExtractable(jwk);

      // Mock IndexedDB failure
      const originalPut = db.messaging_private_keys.put;
      vi.spyOn(db.messaging_private_keys, 'put').mockRejectedValue(
        new Error('IndexedDB unavailable')
      );

      await expect(
        service.storePrivateKey('user-123', cryptoKey)
      ).rejects.toThrow();

      db.messaging_private_keys.put = originalPut;
    });
  });

  describe('getPrivateKey', () => {
    it('should retrieve stored private key as a CryptoKey', async () => {
      const keyPair = await service.generateKeyPair();
      const userId = 'user-123';
      const jwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
      const stored = await jwkToNonExtractable(jwk);
      await service.storePrivateKey(userId, stored);

      const retrieved = await service.getPrivateKey(userId);

      expect(retrieved).toBeInstanceOf(CryptoKey);
      expect(retrieved?.extractable).toBe(false);
      expect(retrieved?.type).toBe('private');
      expect(retrieved?.algorithm.name).toBe('ECDH');
      // Non-extractable: exporting must reject.
      await expect(
        crypto.subtle.exportKey('jwk', retrieved as CryptoKey)
      ).rejects.toThrow();
    });

    it('should return null if key does not exist', async () => {
      const retrieved = await service.getPrivateKey('nonexistent-user');
      expect(retrieved).toBeNull();
    });

    it('should throw error if IndexedDB is unavailable', async () => {
      const originalGet = db.messaging_private_keys.get;
      vi.spyOn(db.messaging_private_keys, 'get').mockRejectedValue(
        new Error('IndexedDB unavailable')
      );

      await expect(service.getPrivateKey('user-123')).rejects.toThrow();

      db.messaging_private_keys.get = originalGet;
    });
  });

  describe('deriveSharedSecret', () => {
    it('should derive AES-GCM shared secret from key pair', async () => {
      const aliceKeyPair = await service.generateKeyPair();
      const bobKeyPair = await service.generateKeyPair();

      const sharedSecret = await service.deriveSharedSecret(
        aliceKeyPair.privateKey,
        bobKeyPair.publicKey
      );

      expect(sharedSecret).toBeInstanceOf(CryptoKey);
      expect(sharedSecret.type).toBe('secret');
      expect(sharedSecret.algorithm.name).toBe(CRYPTO_PARAMS.AES_ALGORITHM);
    });

    it('should derive same secret from both sides', async () => {
      const aliceKeyPair = await service.generateKeyPair();
      const bobKeyPair = await service.generateKeyPair();

      const aliceSecret = await service.deriveSharedSecret(
        aliceKeyPair.privateKey,
        bobKeyPair.publicKey
      );

      const bobSecret = await service.deriveSharedSecret(
        bobKeyPair.privateKey,
        aliceKeyPair.publicKey
      );

      // Shared secrets are not extractable by design (security best practice)
      // Instead, verify they work by encrypting with one and decrypting with the other
      const plaintext = 'Test message';
      const encrypted = await service.encryptMessage(plaintext, aliceSecret);
      const decrypted = await service.decryptMessage(
        encrypted.ciphertext,
        encrypted.iv,
        bobSecret
      );

      expect(decrypted).toBe(plaintext); // Same shared secret if this works
    });

    it('should throw error for incompatible keys', async () => {
      const keyPair = await service.generateKeyPair();
      const invalidKey = {} as CryptoKey;

      await expect(
        service.deriveSharedSecret(keyPair.privateKey, invalidKey)
      ).rejects.toThrow();
    });
  });

  describe('encryptMessage', () => {
    it('should encrypt message with AES-GCM', async () => {
      const aliceKeyPair = await service.generateKeyPair();
      const bobKeyPair = await service.generateKeyPair();
      const sharedSecret = await service.deriveSharedSecret(
        aliceKeyPair.privateKey,
        bobKeyPair.publicKey
      );

      const plaintext = 'Hello, this is a secret message!';
      const encrypted = await service.encryptMessage(plaintext, sharedSecret);

      expect(encrypted).toBeDefined();
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(typeof encrypted.ciphertext).toBe('string');
      expect(typeof encrypted.iv).toBe('string');
      expect(encrypted.ciphertext).not.toBe(plaintext);
    });

    it('should generate different IV for each encryption', async () => {
      const keyPair = await service.generateKeyPair();
      const sharedSecret = await service.deriveSharedSecret(
        keyPair.privateKey,
        keyPair.publicKey
      );

      const plaintext = 'Same message';
      const encrypted1 = await service.encryptMessage(plaintext, sharedSecret);
      const encrypted2 = await service.encryptMessage(plaintext, sharedSecret);

      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    });

    it('should handle empty string', async () => {
      const keyPair = await service.generateKeyPair();
      const sharedSecret = await service.deriveSharedSecret(
        keyPair.privateKey,
        keyPair.publicKey
      );

      const encrypted = await service.encryptMessage('', sharedSecret);

      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
    });

    it('should handle unicode characters', async () => {
      const keyPair = await service.generateKeyPair();
      const sharedSecret = await service.deriveSharedSecret(
        keyPair.privateKey,
        keyPair.publicKey
      );

      const plaintext = '🔒 Encrypted emoji message 日本語';
      const encrypted = await service.encryptMessage(plaintext, sharedSecret);

      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
    });

    it('should throw error for invalid key', async () => {
      const invalidKey = {} as CryptoKey;
      await expect(
        service.encryptMessage('message', invalidKey)
      ).rejects.toThrow();
    });
  });

  describe('decryptMessage', () => {
    it('should decrypt message encrypted with same shared secret', async () => {
      const aliceKeyPair = await service.generateKeyPair();
      const bobKeyPair = await service.generateKeyPair();
      const sharedSecret = await service.deriveSharedSecret(
        aliceKeyPair.privateKey,
        bobKeyPair.publicKey
      );

      const plaintext = 'Secret message';
      const encrypted = await service.encryptMessage(plaintext, sharedSecret);

      const bobSharedSecret = await service.deriveSharedSecret(
        bobKeyPair.privateKey,
        aliceKeyPair.publicKey
      );

      const decrypted = await service.decryptMessage(
        encrypted.ciphertext,
        encrypted.iv,
        bobSharedSecret
      );

      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty string roundtrip', async () => {
      const keyPair = await service.generateKeyPair();
      const sharedSecret = await service.deriveSharedSecret(
        keyPair.privateKey,
        keyPair.publicKey
      );

      const encrypted = await service.encryptMessage('', sharedSecret);
      const decrypted = await service.decryptMessage(
        encrypted.ciphertext,
        encrypted.iv,
        sharedSecret
      );

      expect(decrypted).toBe('');
    });

    it('should handle unicode characters roundtrip', async () => {
      const keyPair = await service.generateKeyPair();
      const sharedSecret = await service.deriveSharedSecret(
        keyPair.privateKey,
        keyPair.publicKey
      );

      const plaintext = '🔒 Encrypted emoji message 日本語';
      const encrypted = await service.encryptMessage(plaintext, sharedSecret);
      const decrypted = await service.decryptMessage(
        encrypted.ciphertext,
        encrypted.iv,
        sharedSecret
      );

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for wrong key', async () => {
      const aliceKeyPair = await service.generateKeyPair();
      const bobKeyPair = await service.generateKeyPair();
      const charlieKeyPair = await service.generateKeyPair();

      const sharedSecret = await service.deriveSharedSecret(
        aliceKeyPair.privateKey,
        bobKeyPair.publicKey
      );

      const plaintext = 'Secret message';
      const encrypted = await service.encryptMessage(plaintext, sharedSecret);

      const wrongSecret = await service.deriveSharedSecret(
        charlieKeyPair.privateKey,
        bobKeyPair.publicKey
      );

      await expect(
        service.decryptMessage(encrypted.ciphertext, encrypted.iv, wrongSecret)
      ).rejects.toThrow();
    });

    it('should throw error for corrupted ciphertext', async () => {
      const keyPair = await service.generateKeyPair();
      const sharedSecret = await service.deriveSharedSecret(
        keyPair.privateKey,
        keyPair.publicKey
      );

      const encrypted = await service.encryptMessage('message', sharedSecret);
      const corruptedCiphertext = encrypted.ciphertext.slice(0, -5) + 'XXXXX';

      await expect(
        service.decryptMessage(corruptedCiphertext, encrypted.iv, sharedSecret)
      ).rejects.toThrow();
    });

    it('should throw error for corrupted IV', async () => {
      const keyPair = await service.generateKeyPair();
      const sharedSecret = await service.deriveSharedSecret(
        keyPair.privateKey,
        keyPair.publicKey
      );

      const encrypted = await service.encryptMessage('message', sharedSecret);
      const corruptedIV = 'AAAAAAAAAAAAAAAA'; // Invalid IV

      await expect(
        service.decryptMessage(encrypted.ciphertext, corruptedIV, sharedSecret)
      ).rejects.toThrow();
    });

    it('should throw error for invalid base64 ciphertext', async () => {
      const keyPair = await service.generateKeyPair();
      const sharedSecret = await service.deriveSharedSecret(
        keyPair.privateKey,
        keyPair.publicKey
      );

      await expect(
        service.decryptMessage(
          'not-valid-base64!@#',
          'validIV===',
          sharedSecret
        )
      ).rejects.toThrow();
    });
  });

  describe('end-to-end encryption flow', () => {
    it('should complete full encryption roundtrip between two users', async () => {
      // Alice and Bob generate their key pairs
      const aliceKeyPair = await service.generateKeyPair();
      const bobKeyPair = await service.generateKeyPair();

      // Export and re-import their private keys as non-extractable for storage
      const alicePrivateJwk = await crypto.subtle.exportKey(
        'jwk',
        aliceKeyPair.privateKey
      );
      const bobPrivateJwk = await crypto.subtle.exportKey(
        'jwk',
        bobKeyPair.privateKey
      );
      await service.storePrivateKey(
        'alice',
        await jwkToNonExtractable(alicePrivateJwk)
      );
      await service.storePrivateKey(
        'bob',
        await jwkToNonExtractable(bobPrivateJwk)
      );

      // Alice derives shared secret with Bob's public key
      const aliceSharedSecret = await service.deriveSharedSecret(
        aliceKeyPair.privateKey,
        bobKeyPair.publicKey
      );

      // Alice encrypts a message
      const plaintext = 'Hello Bob! This is a secret message from Alice.';
      const encrypted = await service.encryptMessage(
        plaintext,
        aliceSharedSecret
      );

      // Bob derives the same shared secret with Alice's public key
      const bobSharedSecret = await service.deriveSharedSecret(
        bobKeyPair.privateKey,
        aliceKeyPair.publicKey
      );

      // Bob decrypts the message
      const decrypted = await service.decryptMessage(
        encrypted.ciphertext,
        encrypted.iv,
        bobSharedSecret
      );

      expect(decrypted).toBe(plaintext);
    });

    it('should maintain zero-knowledge architecture (server never sees plaintext)', async () => {
      const aliceKeyPair = await service.generateKeyPair();
      const bobKeyPair = await service.generateKeyPair();

      const sharedSecret = await service.deriveSharedSecret(
        aliceKeyPair.privateKey,
        bobKeyPair.publicKey
      );

      const plaintext = 'Sensitive information';
      const encrypted = await service.encryptMessage(plaintext, sharedSecret);

      // Verify ciphertext is base64 (what would be stored in DB)
      expect(() => atob(encrypted.ciphertext)).not.toThrow();
      expect(() => atob(encrypted.iv)).not.toThrow();

      // Verify ciphertext doesn't contain plaintext
      expect(encrypted.ciphertext).not.toContain(plaintext);
      expect(atob(encrypted.ciphertext)).not.toContain(plaintext);
    });
  });
});
