import emailjs from '@emailjs/browser';
import {
  ContactFormData,
  EmailProvider,
  EmailResult,
  EmailProviderError,
} from '../types';
import { projectConfig } from '@/config/project.config';

const EMAILJS_SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

export class EmailJSProvider implements EmailProvider {
  name = 'EmailJS';
  priority = 2;
  private initialized = false;

  private ensureInitialized(): void {
    if (!this.initialized && EMAILJS_PUBLIC_KEY) {
      emailjs.init(EMAILJS_PUBLIC_KEY);
      this.initialized = true;
    }
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(
      EMAILJS_SERVICE_ID &&
        EMAILJS_TEMPLATE_ID &&
        EMAILJS_PUBLIC_KEY &&
        EMAILJS_SERVICE_ID !== 'service_placeholder' &&
        EMAILJS_TEMPLATE_ID !== 'template_placeholder' &&
        EMAILJS_PUBLIC_KEY !== 'public_key_placeholder'
    );
  }

  async send(data: ContactFormData): Promise<EmailResult> {
    const isConfigured = await this.isAvailable();

    if (!isConfigured) {
      throw new EmailProviderError(
        'EmailJS not configured properly',
        this.name
      );
    }

    try {
      this.ensureInitialized();

      const templateParams = {
        from_name: data.name,
        from_email: data.email,
        subject: data.subject,
        message: data.message,
        to_name: `${projectConfig.projectName} Team`,
        reply_to: data.email,
      };

      const response = await emailjs.send(
        EMAILJS_SERVICE_ID!,
        EMAILJS_TEMPLATE_ID!,
        templateParams
      );

      return {
        success: response.status === 200,
        provider: this.name,
        messageId: response.text,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';

      throw new EmailProviderError(
        `EmailJS failed: ${message}`,
        this.name,
        error
      );
    }
  }

  async validateConfig(): Promise<boolean> {
    const isConfigured = await this.isAvailable();

    if (!isConfigured) {
      return false;
    }

    try {
      this.ensureInitialized();

      // EmailJS doesn't have a direct validation endpoint,
      // but initialization will throw if the public key is invalid
      return true;
    } catch {
      return false;
    }
  }
}
