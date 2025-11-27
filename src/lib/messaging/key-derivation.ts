/**
 * Key Derivation Service
 * Feature: 032-fix-e2e-encryption
 * Task: T006
 *
 * Provides password-based deterministic key derivation using Argon2id.
 * This enables cross-device message decryption by deriving identical
 * key pairs from the same password + salt combination.
 *
 * Flow:
 * 1. password + salt → Argon2id → 32-byte seed
 * 2. seed → P-256 private key scalar (reduced mod curve order)
 * 3. private key → compute public key
 *
 * Uses hash-wasm for Argon2id which works in both browser and Node.js environments.
 */

import {
  ARGON2_CONFIG,
  CRYPTO_PARAMS,
  KeyDerivationParams,
  DerivedKeyPair,
  KeyDerivationError,
} from '@/types/messaging';
import { p256 } from '@noble/curves/nist.js';
import { createLogger } from '@/lib/logger';

const logger = createLogger('messaging:key-derivation');

/**
 * P-256 curve order (n) for scalar reduction
 * This is the number of points on the P-256 curve
 */
const P256_ORDER = BigInt(
  '0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551'
);

/**
 * Convert Uint8Array to BigInt for scalar operations
 */
function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = BigInt(0);
  for (const byte of bytes) {
    result = (result << BigInt(8)) + BigInt(byte);
  }
  return result;
}

/**
 * Convert BigInt to Uint8Array with specified length
 */
function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  let remaining = value;
  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(remaining & BigInt(0xff));
    remaining = remaining >> BigInt(8);
  }
  return bytes;
}

/**
 * Reduce a scalar value to be within the P-256 curve order
 * This ensures the derived value is a valid P-256 private key
 */
function reduceScalar(seed: Uint8Array): Uint8Array {
  const seedBigInt = bytesToBigInt(seed);
  // Reduce mod curve order, add 1 to avoid zero (invalid private key)
  const reduced = (seedBigInt % (P256_ORDER - BigInt(1))) + BigInt(1);
  return bigIntToBytes(reduced, 32);
}

/**
 * Encode Uint8Array to base64 string
 */
function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Key Derivation Service
 *
 * Provides deterministic key derivation from password using Argon2id.
 * Same password + salt always produces the same ECDH P-256 key pair.
 */
export class KeyDerivationService {
  /**
   * Generate a cryptographically secure random salt
   * @returns 16-byte Uint8Array
   */
  generateSalt(): Uint8Array {
    const salt = new Uint8Array(ARGON2_CONFIG.SALT_LENGTH);
    crypto.getRandomValues(salt);
    return salt;
  }

  /**
   * Derive ECDH P-256 key pair from password using Argon2id
   *
   * Flow:
   * 1. password + salt → Argon2id → 32-byte seed
   * 2. seed → P-256 private key scalar (reduced mod curve order)
   * 3. private key → compute public key
   *
   * @param params - Password and salt
   * @returns Deterministic key pair (same inputs = same outputs)
   * @throws KeyDerivationError if Argon2 or crypto operation fails
   */
  async deriveKeyPair(params: KeyDerivationParams): Promise<DerivedKeyPair> {
    const { password, salt } = params;

    try {
      // Step 1: Derive seed using Argon2id
      const seed = await this.argon2Hash(password, salt);

      // Step 2: Reduce seed to valid P-256 scalar
      const privateKeyScalar = reduceScalar(seed);

      // Step 3: Import as ECDH private key
      const privateKey = await this.importPrivateKey(privateKeyScalar);

      // Step 4: Export and reimport to get public key
      const privateKeyJwk = await crypto.subtle.exportKey('jwk', privateKey);

      // Create public-only JWK (remove d parameter)
      const publicKeyJwk: JsonWebKey = {
        kty: privateKeyJwk.kty,
        crv: privateKeyJwk.crv,
        x: privateKeyJwk.x,
        y: privateKeyJwk.y,
      };

      // Import public key
      const publicKey = await crypto.subtle.importKey(
        'jwk',
        publicKeyJwk,
        {
          name: CRYPTO_PARAMS.ALGORITHM,
          namedCurve: CRYPTO_PARAMS.CURVE,
        },
        true,
        []
      );

      return {
        privateKey,
        publicKey,
        publicKeyJwk,
        salt: toBase64(salt),
      };
    } catch (error) {
      if (error instanceof KeyDerivationError) {
        throw error;
      }
      throw new KeyDerivationError(
        'Failed to derive key pair from password',
        error
      );
    }
  }

  /**
   * Verify that a derived public key matches stored public key
   * Used to detect wrong password without exposing private key
   *
   * @param derivedPublicKey - JWK from deriveKeyPair
   * @param storedPublicKey - JWK from Supabase
   * @returns true if keys match
   */
  verifyPublicKey(
    derivedPublicKey: JsonWebKey,
    storedPublicKey: JsonWebKey
  ): boolean {
    // Check all required fields exist
    if (
      !derivedPublicKey.x ||
      !derivedPublicKey.y ||
      !storedPublicKey.x ||
      !storedPublicKey.y
    ) {
      return false;
    }

    // Compare x and y coordinates
    return (
      derivedPublicKey.x === storedPublicKey.x &&
      derivedPublicKey.y === storedPublicKey.y
    );
  }

  /**
   * Hash password with Argon2id
   * Uses hash-wasm which works in both Node.js and browser environments
   * @private
   */
  private async argon2Hash(
    password: string,
    salt: Uint8Array
  ): Promise<Uint8Array> {
    try {
      const { argon2id } = await import('hash-wasm');

      const hashResult = await argon2id({
        password,
        salt,
        parallelism: ARGON2_CONFIG.PARALLELISM,
        iterations: ARGON2_CONFIG.TIME_COST,
        memorySize: ARGON2_CONFIG.MEMORY_COST,
        hashLength: ARGON2_CONFIG.HASH_LENGTH,
        outputType: 'binary',
      });

      return hashResult;
    } catch (error) {
      throw new KeyDerivationError(
        'Argon2 hashing failed. Please try again.',
        error
      );
    }
  }

  /**
   * Import raw private key bytes as CryptoKey
   * Uses JWK format for better browser compatibility
   * @private
   */
  private async importPrivateKey(
    privateKeyBytes: Uint8Array
  ): Promise<CryptoKey> {
    try {
      // First, compute the public key point from the private key scalar
      // We need to import as JWK which requires both d (private) and x,y (public)

      // Convert private key bytes to base64url (d parameter)
      const d = this.toBase64Url(privateKeyBytes);

      // To get x,y we need to derive them from d
      // We'll use a two-step process: import as raw, then export as JWK to get x,y
      // Alternative: compute the public point mathematically

      // Create PKCS#8 formatted key for initial import
      const pkcs8 = this.createPKCS8(privateKeyBytes);
      const pkcs8Buffer = new ArrayBuffer(pkcs8.length);
      new Uint8Array(pkcs8Buffer).set(pkcs8);

      // Try PKCS#8 import first (works in most browsers)
      try {
        return await crypto.subtle.importKey(
          'pkcs8',
          pkcs8Buffer,
          {
            name: CRYPTO_PARAMS.ALGORITHM,
            namedCurve: CRYPTO_PARAMS.CURVE,
          },
          true,
          ['deriveKey', 'deriveBits']
        );
      } catch (pkcs8Error) {
        // PKCS#8 failed, use @noble/curves to compute public key from private key
        logger.warn('PKCS#8 import failed, using @noble/curves fallback');

        // Use noble-curves to get uncompressed public key (65 bytes: 0x04 + x + y)
        const publicKeyBytes = p256.getPublicKey(privateKeyBytes, false);

        // Extract x and y from uncompressed format (skip the 0x04 prefix)
        const xBytes = publicKeyBytes.slice(1, 33);
        const yBytes = publicKeyBytes.slice(33, 65);

        // Convert to base64url
        const x = this.toBase64Url(xBytes);
        const y = this.toBase64Url(yBytes);

        // Create complete JWK with computed public key
        const jwk: JsonWebKey = {
          kty: 'EC',
          crv: CRYPTO_PARAMS.CURVE,
          d,
          x,
          y,
        };

        // Import the JWK as a CryptoKey
        return await crypto.subtle.importKey(
          'jwk',
          jwk,
          {
            name: CRYPTO_PARAMS.ALGORITHM,
            namedCurve: CRYPTO_PARAMS.CURVE,
          },
          true,
          ['deriveKey', 'deriveBits']
        );
      }
    } catch (error) {
      if (error instanceof KeyDerivationError) {
        throw error;
      }
      throw new KeyDerivationError(
        'Failed to import derived private key. Browser may not support this operation.'
      );
    }
  }

  /**
   * Convert Uint8Array to base64url string (for JWK)
   * @private
   */
  private toBase64Url(bytes: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Create PKCS#8 formatted private key
   * @private
   */
  private createPKCS8(privateKeyBytes: Uint8Array): Uint8Array {
    // PKCS#8 structure for P-256 ECDH key:
    // SEQUENCE {
    //   INTEGER 0 (version)
    //   SEQUENCE { OID ecPublicKey, OID prime256v1 }
    //   OCTET STRING { SEQUENCE { INTEGER 1 (version), OCTET STRING (private key) } }
    // }

    // Pre-computed header for P-256 ECDH private key in PKCS#8 format
    const header = new Uint8Array([
      0x30,
      0x41, // SEQUENCE, 65 bytes
      0x02,
      0x01,
      0x00, // INTEGER 0 (version)
      0x30,
      0x13, // SEQUENCE, 19 bytes
      0x06,
      0x07,
      0x2a,
      0x86,
      0x48,
      0xce,
      0x3d,
      0x02,
      0x01, // OID ecPublicKey
      0x06,
      0x08,
      0x2a,
      0x86,
      0x48,
      0xce,
      0x3d,
      0x03,
      0x01,
      0x07, // OID prime256v1
      0x04,
      0x27, // OCTET STRING, 39 bytes
      0x30,
      0x25, // SEQUENCE, 37 bytes
      0x02,
      0x01,
      0x01, // INTEGER 1 (version)
      0x04,
      0x20, // OCTET STRING, 32 bytes (private key follows)
    ]);

    // Combine header with private key bytes
    const pkcs8 = new Uint8Array(header.length + privateKeyBytes.length);
    pkcs8.set(header);
    pkcs8.set(privateKeyBytes, header.length);

    return pkcs8;
  }
}
