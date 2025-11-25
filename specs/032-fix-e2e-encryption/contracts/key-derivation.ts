/**
 * Key Derivation Service Contract
 * Feature: 032-fix-e2e-encryption
 *
 * New service responsible for Argon2 password-based key derivation
 */

export interface KeyDerivationParams {
  password: string;
  salt: Uint8Array; // 16 bytes
}

export interface DerivedKeyPair {
  privateKey: CryptoKey; // ECDH P-256, never persisted
  publicKey: CryptoKey; // ECDH P-256
  publicKeyJwk: JsonWebKey; // For Supabase storage
  salt: string; // Base64-encoded for storage
}

export interface KeyDerivationService {
  /**
   * Generate a cryptographically secure random salt
   * @returns 16-byte Uint8Array
   */
  generateSalt(): Uint8Array;

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
  deriveKeyPair(params: KeyDerivationParams): Promise<DerivedKeyPair>;

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
  ): boolean;
}

/**
 * Argon2 configuration (OWASP recommended for password hashing)
 */
export const ARGON2_CONFIG = {
  type: 'argon2id', // Hybrid of argon2i and argon2d
  memoryCost: 65536, // 64 MB
  timeCost: 3, // 3 iterations
  parallelism: 4, // 4 parallel lanes
  hashLength: 32, // 256 bits for P-256 seed
} as const;

/**
 * Custom error for key derivation failures
 */
export class KeyDerivationError extends Error {
  constructor(
    message: string,
    public override cause?: unknown
  ) {
    super(message);
    this.name = 'KeyDerivationError';
  }
}
