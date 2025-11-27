/**
 * Encryption Service for End-to-End Encrypted Messaging
 * Task: T045
 *
 * Implements Web Crypto API (ECDH + AES-GCM) for zero-knowledge encryption
 *
 * Key Features:
 * - ECDH P-256 for key exchange
 * - AES-GCM-256 for symmetric encryption
 * - Random 96-bit IV for each message
 * - IndexedDB storage for private keys
 * - Browser-native crypto (no external dependencies)
 */

import { db } from './database';
import {
  CRYPTO_PARAMS,
  type KeyPair,
  type EncryptedPayload,
  EncryptionError,
  DecryptionError,
} from '@/types/messaging';
import { createLogger } from '@/lib/logger';

const logger = createLogger('messaging:encryption');

export class EncryptionService {
  /**
   * Generate an ECDH P-256 key pair for asymmetric encryption
   * Task: T046
   *
   * @returns Promise<KeyPair> - Public and private CryptoKey objects
   * @throws EncryptionError if Web Crypto API is unavailable
   */
  async generateKeyPair(): Promise<KeyPair> {
    try {
      if (!crypto.subtle) {
        throw new Error('Web Crypto API not available');
      }

      const keyPair = await crypto.subtle.generateKey(
        {
          name: CRYPTO_PARAMS.ALGORITHM,
          namedCurve: CRYPTO_PARAMS.CURVE,
        },
        true, // extractable
        ['deriveBits', 'deriveKey']
      );

      return keyPair as KeyPair;
    } catch (error) {
      throw new EncryptionError('Failed to generate key pair', error);
    }
  }

  /**
   * Export public key to JWK format for storage/transmission
   * Task: T047
   *
   * @param publicKey - CryptoKey to export
   * @returns Promise<JsonWebKey> - JWK representation
   * @throws EncryptionError if export fails
   */
  async exportPublicKey(publicKey: CryptoKey): Promise<JsonWebKey> {
    try {
      return await crypto.subtle.exportKey('jwk', publicKey);
    } catch (error) {
      throw new EncryptionError('Failed to export public key', error);
    }
  }

  /**
   * Store private key in IndexedDB (client-side only, never sent to server)
   * Task: T048
   *
   * @param userId - User ID to associate with this key
   * @param privateKeyJwk - Private key in JWK format
   * @throws EncryptionError if storage fails
   */
  async storePrivateKey(
    userId: string,
    privateKeyJwk: JsonWebKey
  ): Promise<void> {
    try {
      await db.messaging_private_keys.put({
        userId,
        privateKey: privateKeyJwk,
        created_at: Date.now(),
      });
    } catch (error) {
      throw new EncryptionError('Failed to store private key', error);
    }
  }

  /**
   * Retrieve private key from IndexedDB
   * Task: T049
   *
   * @param userId - User ID to retrieve key for
   * @returns Promise<JsonWebKey | null> - Private key or null if not found
   * @throws EncryptionError if retrieval fails
   */
  async getPrivateKey(userId: string): Promise<JsonWebKey | null> {
    try {
      const record = await db.messaging_private_keys.get(userId);
      return record?.privateKey ?? null;
    } catch (error) {
      throw new EncryptionError('Failed to retrieve private key', error);
    }
  }

  /**
   * Derive AES-GCM shared secret from ECDH key exchange
   * Task: T050
   *
   * @param privateKey - Own private key
   * @param publicKey - Other party's public key
   * @returns Promise<CryptoKey> - Derived AES-GCM-256 key
   * @throws EncryptionError if derivation fails
   */
  async deriveSharedSecret(
    privateKey: CryptoKey,
    publicKey: CryptoKey
  ): Promise<CryptoKey> {
    logger.debug('Starting ECDH key derivation');
    try {
      const sharedSecret = await crypto.subtle.deriveKey(
        {
          name: CRYPTO_PARAMS.ALGORITHM,
          public: publicKey,
        },
        privateKey,
        {
          name: CRYPTO_PARAMS.AES_ALGORITHM,
          length: CRYPTO_PARAMS.AES_KEY_LENGTH,
        },
        false, // not extractable (security best practice)
        ['encrypt', 'decrypt']
      );

      logger.debug('ECDH key derivation successful');
      return sharedSecret;
    } catch (error) {
      const err = error as Error;
      logger.error('ECDH key derivation failed', {
        errorName: err.name,
        errorMessage: err.message,
      });
      throw new EncryptionError('Failed to derive shared secret', error);
    }
  }

  /**
   * Encrypt message with AES-GCM using shared secret
   * Task: T051
   *
   * @param plaintext - Message to encrypt
   * @param sharedSecret - AES-GCM key from deriveSharedSecret
   * @returns Promise<EncryptedPayload> - Base64-encoded ciphertext and IV
   * @throws EncryptionError if encryption fails
   */
  async encryptMessage(
    plaintext: string,
    sharedSecret: CryptoKey
  ): Promise<EncryptedPayload> {
    try {
      // Generate random 96-bit IV (12 bytes)
      const iv = crypto.getRandomValues(
        new Uint8Array(CRYPTO_PARAMS.IV_LENGTH_BYTES)
      );

      // Convert plaintext to bytes
      const encoder = new TextEncoder();
      const plaintextBytes = encoder.encode(plaintext);

      // Encrypt with AES-GCM
      const ciphertextBuffer = await crypto.subtle.encrypt(
        {
          name: CRYPTO_PARAMS.AES_ALGORITHM,
          iv,
        },
        sharedSecret,
        plaintextBytes
      );

      // Convert to base64 for storage
      const ciphertext = this.arrayBufferToBase64(ciphertextBuffer);
      const ivBase64 = this.arrayBufferToBase64(iv.buffer);

      return {
        ciphertext,
        iv: ivBase64,
      };
    } catch (error) {
      throw new EncryptionError('Failed to encrypt message', error);
    }
  }

  /**
   * Decrypt message with AES-GCM using shared secret
   * Task: T052
   *
   * @param ciphertext - Base64-encoded encrypted message
   * @param ivBase64 - Base64-encoded initialization vector
   * @param sharedSecret - AES-GCM key from deriveSharedSecret
   * @returns Promise<string> - Decrypted plaintext
   * @throws DecryptionError if decryption fails (wrong key, corrupted data)
   */
  async decryptMessage(
    ciphertext: string,
    ivBase64: string,
    sharedSecret: CryptoKey
  ): Promise<string> {
    logger.debug('Starting AES-GCM decryption', {
      ciphertextLength: ciphertext?.length || 0,
      ivLength: ivBase64?.length || 0,
    });
    try {
      // Convert from base64
      const ciphertextBuffer = this.base64ToArrayBuffer(
        ciphertext
      ) as BufferSource;
      const iv = this.base64ToArrayBuffer(ivBase64) as BufferSource;

      // Decrypt with AES-GCM
      const plaintextBuffer = await crypto.subtle.decrypt(
        {
          name: CRYPTO_PARAMS.AES_ALGORITHM,
          iv,
        },
        sharedSecret,
        ciphertextBuffer
      );

      // Convert bytes to string
      const decoder = new TextDecoder();
      const plaintext = decoder.decode(plaintextBuffer);
      logger.debug('AES-GCM decryption successful', {
        plaintextLength: plaintext.length,
      });
      return plaintext;
    } catch (error) {
      const err = error as Error;
      logger.error('AES-GCM decryption failed', {
        errorName: String(err.name || 'unknown'),
        errorMessage: String(err.message || 'no message'),
        ciphertextLength: ciphertext?.length || 0,
        ivLength: ivBase64?.length || 0,
      });
      throw new DecryptionError(
        'Failed to decrypt message (wrong key or corrupted data)',
        error
      );
    }
  }

  /**
   * Convert ArrayBuffer to base64 string
   * @private
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to Uint8Array (BufferSource for SubtleCrypto)
   * @private
   */
  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    // Return Uint8Array directly - SubtleCrypto accepts TypedArray
    // This fixes CI failures where bytes.buffer wasn't recognized as valid BufferSource
    return bytes;
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();
