import { z } from 'zod';

/**
 * Contact form validation schema
 * Uses Zod for runtime validation and TypeScript type inference
 * Follows existing form validation patterns in the codebase
 */
export const contactSchema = z.object({
  name: z
    .string()
    .transform((str) => str.trim())
    .pipe(
      z
        .string()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must be less than 100 characters')
        .regex(/^[a-zA-Z\s\-'\.]+$/, 'Name contains invalid characters')
    ),

  email: z
    .string()
    .transform((str) => str.toLowerCase().trim())
    .pipe(
      z
        .string()
        .email('Please enter a valid email address')
        .max(254, 'Email address is too long')
    ),

  subject: z
    .string()
    .transform((str) => str.trim())
    .pipe(
      z
        .string()
        .min(5, 'Subject must be at least 5 characters')
        .max(200, 'Subject must be less than 200 characters')
    ),

  message: z
    .string()
    .transform((str) => str.trim())
    .pipe(
      z
        .string()
        .min(10, 'Message must be at least 10 characters')
        .max(5000, 'Message must be less than 5000 characters')
    ),

  // Honeypot field for spam protection (should remain empty)
  _gotcha: z.string().max(0, 'Bot detected').optional(),
});

/**
 * TypeScript type derived from schema
 */
export type ContactFormData = z.infer<typeof contactSchema>;

/**
 * Web3Forms API response type
 */
export interface Web3FormsResponse {
  success: boolean;
  message: string;
  data?: {
    id?: string;
    email?: string;
    from_name?: string;
    from_email?: string;
    subject?: string;
    message?: string;
    date?: string;
  };
}

/**
 * Web3Forms submission payload
 */
export interface Web3FormsSubmission extends ContactFormData {
  access_key: string;
  from_name?: string;
  redirect?: string;
  botcheck?: boolean;
}

/**
 * Form submission status
 */
export enum SubmissionStatus {
  IDLE = 'idle',
  SUBMITTING = 'submitting',
  SUCCESS = 'success',
  ERROR = 'error',
}

/**
 * Form submission state
 */
export interface SubmissionState {
  status: SubmissionStatus;
  isSubmitting: boolean;
  error: FormError | null;
  data: Web3FormsResponse | null;
}

/**
 * Form error type
 */
export interface FormError {
  message: string;
  code?: string;
  field?: keyof ContactFormData;
  details?: Record<string, unknown>;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  maxSubmissions: number;
  timeWindow: number; // milliseconds
  blockDuration: number; // milliseconds
  storageKey: string;
}

/**
 * Default rate limit settings
 */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxSubmissions: 5,
  timeWindow: 300000, // 5 minutes
  blockDuration: 900000, // 15 minutes
  storageKey: 'contact-form-rate-limit',
};

/**
 * Offline submission queue item
 */
export interface QueuedSubmission {
  id: string;
  formData: ContactFormData;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: number;
  status: 'pending' | 'retrying' | 'failed' | 'success';
  error?: FormError;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffFactor: number;
}

/**
 * Default retry settings
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffFactor: 2,
};

/**
 * Form field metadata for rendering
 */
export interface FormFieldConfig {
  name: keyof ContactFormData;
  label: string;
  type: 'text' | 'email' | 'textarea';
  placeholder?: string;
  required: boolean;
  autoComplete?: string;
  rows?: number;
  maxLength?: number;
  pattern?: string;
  helpText?: string;
}

/**
 * Contact form field configurations
 */
export const FORM_FIELDS: FormFieldConfig[] = [
  {
    name: 'name',
    label: 'Full Name',
    type: 'text',
    placeholder: 'John Doe',
    required: true,
    autoComplete: 'name',
    maxLength: 100,
    pattern: "^[a-zA-Z\\s\\-'\\.]+$",
    helpText: 'Please enter your full name',
  },
  {
    name: 'email',
    label: 'Email Address',
    type: 'email',
    placeholder: 'john@example.com',
    required: true,
    autoComplete: 'email',
    maxLength: 254,
    helpText: "We'll never share your email with anyone else",
  },
  {
    name: 'subject',
    label: 'Subject',
    type: 'text',
    placeholder: 'How can we help you?',
    required: true,
    maxLength: 200,
    helpText: 'Brief description of your inquiry',
  },
  {
    name: 'message',
    label: 'Message',
    type: 'textarea',
    placeholder: 'Tell us more about your inquiry...',
    required: true,
    rows: 6,
    maxLength: 5000,
    helpText: 'Please provide details about your request',
  },
];

/**
 * Validation helper to get user-friendly error messages
 */
export const getFieldError = (
  error: z.ZodError,
  field: keyof ContactFormData
): string | undefined => {
  const fieldError = error.issues.find((issue) => issue.path[0] === field);
  return fieldError?.message;
};

/**
 * Check if a value is a valid ContactFormData
 */
export const isValidContactData = (data: unknown): data is ContactFormData => {
  return contactSchema.safeParse(data).success;
};

/**
 * Sanitize form data for safe display
 */
export const sanitizeFormData = (data: ContactFormData): ContactFormData => {
  return {
    ...data,
    // Additional sanitization if needed
    name: data.name.replace(/<[^>]*>/g, ''), // Strip HTML tags
    subject: data.subject.replace(/<[^>]*>/g, ''),
    message: data.message.replace(/<[^>]*>/g, ''),
  };
};
