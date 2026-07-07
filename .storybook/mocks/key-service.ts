/**
 * Mock key-service for Storybook — real Supabase is unavailable.
 * Prevents components from redirecting away when key checks fail.
 */

const mockKeyPair = {
  publicKey: {} as JsonWebKey,
  privateKey: {} as CryptoKey,
};

export class KeyManagementService {
  async initializeKeys(_password: string) {
    return mockKeyPair;
  }

  async deriveKeys(_password: string) {
    return mockKeyPair;
  }

  getCurrentKeys() {
    return mockKeyPair;
  }

  clearKeys() {}

  async needsMigration() {
    return false;
  }

  async hasKeys() {
    return true;
  }

  async hasValidKeys() {
    return true;
  }

  async rotateKeys(_password: string) {
    return true;
  }

  async revokeKeys() {}

  async getUserPublicKey(_userId: string) {
    return {} as JsonWebKey;
  }
}

export const keyManagementService = new KeyManagementService();
