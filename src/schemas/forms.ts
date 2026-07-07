import { z } from 'zod';

// ============================================================================
// Common Validation Schemas
// ============================================================================

/**
 * Email validation schema with proper format checking
 */
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .toLowerCase()
  .trim();

/**
 * Password validation schema with security requirements
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password must be less than 100 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  );

/**
 * Username validation schema
 */
export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be less than 20 characters')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Username can only contain letters, numbers, underscores, and hyphens'
  )
  .trim();

/**
 * Generic text input validation
 */
export const textInputSchema = z
  .string()
  .min(1, 'This field is required')
  .max(255, 'Text must be less than 255 characters')
  .trim();

/**
 * URL validation schema
 */
export const urlSchema = z
  .string()
  .url('Please enter a valid URL')
  .optional()
  .or(z.literal(''));

/**
 * Phone number validation (basic international format)
 */
export const phoneSchema = z
  .string()
  .regex(
    /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/,
    'Please enter a valid phone number'
  )
  .optional();

// ============================================================================
// Game-Specific Schemas
// ============================================================================

/**
 * Player name validation for games
 */
export const playerNameSchema = z
  .string()
  .min(1, 'Player name is required')
  .max(30, 'Player name must be less than 30 characters')
  .regex(
    /^[a-zA-Z0-9\s_-]+$/,
    'Player name can only contain letters, numbers, spaces, underscores, and hyphens'
  )
  .trim()
  .transform((name) => name.replace(/\s+/g, ' ')); // Normalize multiple spaces

/**
 * Player setup form schema for games
 */
export const playerSetupSchema = z.object({
  name: playerNameSchema,
  type: z.enum(['human', 'npc']).default('human'),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
});

/**
 * Game configuration schema
 */
export const gameConfigSchema = z.object({
  playerCount: z
    .number()
    .min(1, 'At least 1 player is required')
    .max(8, 'Maximum 8 players allowed'),
  gameMode: z.enum(['classic', 'target', 'timed']).default('classic'),
  targetScore: z
    .number()
    .min(10, 'Target score must be at least 10')
    .max(1000, 'Target score must be less than 1000')
    .optional(),
  timeLimit: z
    .number()
    .min(60, 'Time limit must be at least 60 seconds')
    .max(3600, 'Time limit must be less than 1 hour')
    .optional(),
});

// ============================================================================
// Form Schemas
// ============================================================================

/**
 * Login form schema
 */
export const loginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

/**
 * Registration form schema
 */
export const registrationFormSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    acceptTerms: z
      .boolean()
      .refine(
        (val) => val === true,
        'You must accept the terms and conditions'
      ),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * Profile form schema
 */
export const profileFormSchema = z.object({
  displayName: textInputSchema,
  bio: z
    .string()
    .max(500, 'Bio must be less than 500 characters')
    .optional()
    .transform((val) => val?.trim()),
  website: urlSchema,
  phone: phoneSchema,
  preferences: z
    .object({
      theme: z.string().optional(),
      fontSize: z.enum(['small', 'medium', 'large']).optional(),
      notifications: z.boolean().optional(),
    })
    .optional(),
});

/**
 * Contact form schema
 */
export const contactFormSchema = z.object({
  name: textInputSchema,
  email: emailSchema,
  subject: z
    .string()
    .min(5, 'Subject must be at least 5 characters')
    .max(100, 'Subject must be less than 100 characters')
    .trim(),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(1000, 'Message must be less than 1000 characters')
    .trim(),
});

/**
 * Search form schema
 */
export const searchFormSchema = z.object({
  query: z
    .string()
    .min(2, 'Search query must be at least 2 characters')
    .max(100, 'Search query must be less than 100 characters')
    .trim(),
  category: z.string().optional(),
  sortBy: z.enum(['relevance', 'date', 'name']).optional(),
});

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Safe parse with formatted errors
 */
export function safeParseWithErrors<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
} {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Format errors into a more usable structure
  const errors: Record<string, string> = {};
  result.error.issues.forEach((issue) => {
    const path = issue.path.join('.');
    errors[path] = issue.message;
  });

  return { success: false, errors };
}

/**
 * Validate a single field
 */
export function validateField<T>(
  schema: z.ZodSchema<T>,
  value: unknown
): { valid: boolean; error?: string } {
  const result = schema.safeParse(value);

  if (result.success) {
    return { valid: true };
  }

  return {
    valid: false,
    error: result.error.issues[0]?.message || 'Invalid value',
  };
}

// ============================================================================
// Type Exports
// ============================================================================

export type LoginFormData = z.infer<typeof loginFormSchema>;
export type RegistrationFormData = z.infer<typeof registrationFormSchema>;
export type ProfileFormData = z.infer<typeof profileFormSchema>;
export type ContactFormData = z.infer<typeof contactFormSchema>;
export type SearchFormData = z.infer<typeof searchFormSchema>;
export type PlayerSetupData = z.infer<typeof playerSetupSchema>;
export type GameConfigData = z.infer<typeof gameConfigSchema>;
