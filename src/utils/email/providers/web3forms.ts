import {
  ContactFormData,
  EmailProvider,
  EmailResult,
  EmailProviderError,
} from '../types';
import { projectConfig } from '@/config/project.config';

const WEB3FORMS_API_URL = 'https://api.web3forms.com/submit';
const WEB3FORMS_ACCESS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY;

export class Web3FormsProvider implements EmailProvider {
  name = 'Web3Forms';
  priority = 1;

  async isAvailable(): Promise<boolean> {
    return Boolean(WEB3FORMS_ACCESS_KEY);
  }

  async send(data: ContactFormData): Promise<EmailResult> {
    if (!WEB3FORMS_ACCESS_KEY) {
      throw new EmailProviderError(
        'Web3Forms access key not configured',
        this.name
      );
    }

    try {
      const response = await fetch(WEB3FORMS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          name: data.name,
          email: data.email,
          subject: data.subject,
          message: data.message,
          from_name: `${projectConfig.projectName} Contact Form`,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new EmailProviderError(
          result.message || `Web3Forms API error: ${response.status}`,
          this.name,
          result
        );
      }

      return {
        success: true,
        provider: this.name,
        messageId: result.message_id || result.id,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof EmailProviderError) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';

      throw new EmailProviderError(
        `Web3Forms failed: ${message}`,
        this.name,
        error
      );
    }
  }

  async validateConfig(): Promise<boolean> {
    if (!WEB3FORMS_ACCESS_KEY) {
      return false;
    }

    try {
      const response = await fetch(WEB3FORMS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          test: true,
        }),
      });

      const result = await response.json();
      return response.ok && result.success !== false;
    } catch {
      return false;
    }
  }
}
