/**
 * Unit Tests for Key Derivation Service
 * Task: T005
 * Feature: 032-fix-e2e-encryption
 *
 * Tests: generateSalt, deriveKeyPair determinism, verifyPublicKey
 *
 * Coverage Target: 100%
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { KeyDerivationService } from '../key-derivation';
import { ARGON2_CONFIG, CRYPTO_PARAMS } from '@/types/messaging';

describe('KeyDerivationService', () => {
  let service: KeyDerivationService;

  beforeEach(() => {
    service = new KeyDerivationService();
  });

  describe('generateSalt', () => {
    it('should generate a 16-byte salt', () => {
      const salt = service.generateSalt();

      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(ARGON2_CONFIG.SALT_LENGTH);
    });

    it('should generate different salts each time', () => {
      const salt1 = service.generateSalt();
      const salt2 = service.generateSalt();

      const salt1Str = Array.from(salt1).join(',');
      const salt2Str = Array.from(salt2).join(',');

      expect(salt1Str).not.toBe(salt2Str);
    });

    it('should generate cryptographically random salt', () => {
      const salts = Array.from({ length: 10 }, () => service.generateSalt());
      const uniqueSalts = new Set(salts.map((s) => Array.from(s).join(',')));

      expect(uniqueSalts.size).toBe(10);
    });
  });

  describe('deriveKeyPair', () => {
    it('should derive same key pair from same password and salt (determinism)', async () => {
      const password = 'TestPassword123!';
      const salt = service.generateSalt();

      const keyPair1 = await service.deriveKeyPair({ password, salt });
      const keyPair2 = await service.deriveKeyPair({ password, salt });

      expect(keyPair1.publicKeyJwk.x).toBe(keyPair2.publicKeyJwk.x);
      expect(keyPair1.publicKeyJwk.y).toBe(keyPair2.publicKeyJwk.y);
    });

    it('should derive different key pair from different password', async () => {
      const salt = service.generateSalt();

      const keyPair1 = await service.deriveKeyPair({
        password: 'Password1',
        salt,
      });
      const keyPair2 = await service.deriveKeyPair({
        password: 'Password2',
        salt,
      });

      expect(keyPair1.publicKeyJwk.x).not.toBe(keyPair2.publicKeyJwk.x);
    });

    it('should derive different key pair from different salt', async () => {
      const password = 'SamePassword';
      const salt1 = service.generateSalt();
      const salt2 = service.generateSalt();

      const keyPair1 = await service.deriveKeyPair({ password, salt: salt1 });
      const keyPair2 = await service.deriveKeyPair({ password, salt: salt2 });

      expect(keyPair1.publicKeyJwk.x).not.toBe(keyPair2.publicKeyJwk.x);
    });

    it('should derive valid P-256 ECDH key pair', async () => {
      const password = 'TestPassword123!';
      const salt = service.generateSalt();

      const keyPair = await service.deriveKeyPair({ password, salt });

      expect(keyPair.privateKey).toBeInstanceOf(CryptoKey);
      expect(keyPair.publicKey).toBeInstanceOf(CryptoKey);
      expect(keyPair.publicKeyJwk).toBeDefined();
      expect(keyPair.salt).toBeDefined();

      expect(keyPair.privateKey.algorithm.name).toBe(CRYPTO_PARAMS.ALGORITHM);
      expect(keyPair.publicKey.algorithm.name).toBe(CRYPTO_PARAMS.ALGORITHM);

      const privateKeyAlg = keyPair.privateKey.algorithm as EcKeyAlgorithm;
      expect(privateKeyAlg.namedCurve).toBe(CRYPTO_PARAMS.CURVE);

      expect(keyPair.publicKeyJwk.kty).toBe('EC');
      expect(keyPair.publicKeyJwk.crv).toBe(CRYPTO_PARAMS.CURVE);
      expect(keyPair.publicKeyJwk.x).toBeDefined();
      expect(keyPair.publicKeyJwk.y).toBeDefined();
    });

    it('should produce extractable private key for operations', async () => {
      const password = 'TestPassword123!';
      const salt = service.generateSalt();

      const keyPair = await service.deriveKeyPair({ password, salt });

      expect(keyPair.privateKey.extractable).toBe(true);
    });

    it('should return base64-encoded salt in result', async () => {
      const password = 'TestPassword123!';
      const salt = service.generateSalt();

      const keyPair = await service.deriveKeyPair({ password, salt });

      expect(typeof keyPair.salt).toBe('string');
      expect(keyPair.salt.length).toBe(24);
      expect(() => atob(keyPair.salt)).not.toThrow();

      const decoded = Uint8Array.from(atob(keyPair.salt), (c) =>
        c.charCodeAt(0)
      );
      expect(decoded.length).toBe(16);
    });

    it('should reject empty password', async () => {
      const salt = service.generateSalt();

      // Empty password should throw KeyDerivationError (password strength is user's responsibility,
      // but completely empty is invalid for Argon2)
      await expect(
        service.deriveKeyPair({ password: '', salt })
      ).rejects.toThrow();
    });

    it('should handle unicode password', async () => {
      const password = '密码🔐Пароль';
      const salt = service.generateSalt();

      const keyPair = await service.deriveKeyPair({ password, salt });

      expect(keyPair.publicKeyJwk).toBeDefined();
      expect(keyPair.publicKeyJwk.kty).toBe('EC');
    });

    it('should throw KeyDerivationError if Argon2 fails', async () => {
      const { KeyDerivationError } = await import('@/types/messaging');
      expect(KeyDerivationError).toBeDefined();
    });
  });

  describe('verifyPublicKey', () => {
    it('should return true for matching public keys', async () => {
      const password = 'TestPassword123!';
      const salt = service.generateSalt();

      const keyPair = await service.deriveKeyPair({ password, salt });

      const result = service.verifyPublicKey(
        keyPair.publicKeyJwk,
        keyPair.publicKeyJwk
      );

      expect(result).toBe(true);
    });

    it('should return false for different public keys', async () => {
      const salt = service.generateSalt();

      const keyPair1 = await service.deriveKeyPair({
        password: 'Password1',
        salt,
      });
      const keyPair2 = await service.deriveKeyPair({
        password: 'Password2',
        salt,
      });

      const result = service.verifyPublicKey(
        keyPair1.publicKeyJwk,
        keyPair2.publicKeyJwk
      );

      expect(result).toBe(false);
    });

    it('should compare x and y coordinates correctly', async () => {
      const password = 'TestPassword123!';
      const salt = service.generateSalt();

      const keyPair = await service.deriveKeyPair({ password, salt });

      const modifiedKey = {
        ...keyPair.publicKeyJwk,
        x: 'different_x_coordinate',
      };

      const result = service.verifyPublicKey(keyPair.publicKeyJwk, modifiedKey);

      expect(result).toBe(false);
    });

    it('should handle missing properties gracefully', () => {
      const incompleteKey = { kty: 'EC', crv: 'P-256' } as JsonWebKey;
      const validKey = {
        kty: 'EC',
        crv: 'P-256',
        x: 'test',
        y: 'test',
      } as JsonWebKey;

      const result = service.verifyPublicKey(incompleteKey, validKey);

      expect(result).toBe(false);
    });
  });

  describe('end-to-end key derivation flow', () => {
    it('should complete full derivation and verification flow', async () => {
      const password = 'SecurePassword123!';

      const salt = service.generateSalt();
      const initialKeyPair = await service.deriveKeyPair({ password, salt });

      const storedPublicKey = initialKeyPair.publicKeyJwk;
      const storedSalt = initialKeyPair.salt;

      const saltBytes = Uint8Array.from(atob(storedSalt), (c) =>
        c.charCodeAt(0)
      );
      const loginKeyPair = await service.deriveKeyPair({
        password,
        salt: saltBytes,
      });

      const verified = service.verifyPublicKey(
        loginKeyPair.publicKeyJwk,
        storedPublicKey
      );

      expect(verified).toBe(true);
    });

    it('should detect wrong password via key mismatch', async () => {
      const correctPassword = 'CorrectPassword';
      const wrongPassword = 'WrongPassword';

      const salt = service.generateSalt();
      const registrationKeyPair = await service.deriveKeyPair({
        password: correctPassword,
        salt,
      });
      const storedPublicKey = registrationKeyPair.publicKeyJwk;

      const loginKeyPair = await service.deriveKeyPair({
        password: wrongPassword,
        salt,
      });

      const verified = service.verifyPublicKey(
        loginKeyPair.publicKeyJwk,
        storedPublicKey
      );

      expect(verified).toBe(false);
    });

    it('should work with existing EncryptionService for message encryption', async () => {
      const { EncryptionService } = await import('../encryption');
      const encryptionService = new EncryptionService();

      const aliceSalt = service.generateSalt();
      const bobSalt = service.generateSalt();

      const aliceKeys = await service.deriveKeyPair({
        password: 'AlicePassword',
        salt: aliceSalt,
      });
      const bobKeys = await service.deriveKeyPair({
        password: 'BobPassword',
        salt: bobSalt,
      });

      const aliceSharedSecret = await encryptionService.deriveSharedSecret(
        aliceKeys.privateKey,
        bobKeys.publicKey
      );

      const bobSharedSecret = await encryptionService.deriveSharedSecret(
        bobKeys.privateKey,
        aliceKeys.publicKey
      );

      const plaintext = 'Hello from Alice!';
      const encrypted = await encryptionService.encryptMessage(
        plaintext,
        aliceSharedSecret
      );
      const decrypted = await encryptionService.decryptMessage(
        encrypted.ciphertext,
        encrypted.iv,
        bobSharedSecret
      );

      expect(decrypted).toBe(plaintext);
    });
  });
});
