/**
 * Validation Service for Messaging System
 * Task: T016
 *
 * Provides input validation and sanitization for messaging operations
 */

import { ValidationError } from '@/types/messaging';

/**
 * Valid email regex pattern (RFC 5322 simplified)
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate email address format
 * @param email - Email address to validate
 * @throws ValidationError if email is invalid
 */
export function validateEmail(email: string): void {
  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email is required', 'email');
  }

  const trimmed = email.trim();

  if (trimmed.length === 0) {
    throw new ValidationError('Email cannot be empty', 'email');
  }

  if (trimmed.length > 254) {
    throw new ValidationError(
      'Email address is too long (max 254 characters)',
      'email'
    );
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    throw new ValidationError('Invalid email address format', 'email');
  }

  // Check for common typos
  if (
    trimmed.includes('..') ||
    trimmed.startsWith('.') ||
    trimmed.endsWith('.')
  ) {
    throw new ValidationError('Invalid email address format', 'email');
  }

  // Check for valid TLD (at least 2 characters)
  const tld = trimmed.split('.').pop();
  if (!tld || tld.length < 2) {
    throw new ValidationError(
      'Email must have a valid domain extension',
      'email'
    );
  }
}

/**
 * Sanitize user input to prevent XSS attacks
 * @param input - Input string to sanitize
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove inline event handlers
    .substring(0, 1000); // Limit length to prevent DOS
}

/**
 * Validate username format (3-30 alphanumeric + underscore/hyphen)
 * @param username - Username to validate
 * @throws ValidationError if username is invalid
 */
export function validateUsername(username: string): void {
  if (!username || typeof username !== 'string') {
    throw new ValidationError('Username is required', 'username');
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    throw new ValidationError(
      'Username must be at least 3 characters',
      'username'
    );
  }

  if (trimmed.length > 30) {
    throw new ValidationError(
      'Username must be at most 30 characters',
      'username'
    );
  }

  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(trimmed)) {
    throw new ValidationError(
      'Username can only contain letters, numbers, underscores, and hyphens',
      'username'
    );
  }
}

/**
 * Validate message content
 * @param content - Message content to validate
 * @throws ValidationError if content is invalid
 */
export function validateMessageContent(content: string): void {
  if (typeof content !== 'string') {
    throw new ValidationError('Message content must be a string', 'content');
  }

  const trimmed = content.trim();

  if (trimmed.length === 0) {
    throw new ValidationError('Message cannot be empty', 'content');
  }

  if (trimmed.length > 10000) {
    throw new ValidationError(
      'Message exceeds maximum length (10,000 characters)',
      'content'
    );
  }
}

/**
 * Validate UUID format
 * @param id - UUID to validate
 * @param fieldName - Field name for error message
 * @throws ValidationError if UUID is invalid
 */
export function validateUUID(id: string, fieldName: string = 'id'): void {
  if (!id || typeof id !== 'string') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(id)) {
    throw new ValidationError(`Invalid ${fieldName} format`, fieldName);
  }
}

/**
 * Check if message is within edit window (15 minutes)
 * @param created_at - Message creation timestamp
 * @returns true if within edit window
 */
export function isWithinEditWindow(created_at: string): boolean {
  const createdDate = new Date(created_at);
  const now = new Date();
  const diffMinutes = (now.getTime() - createdDate.getTime()) / 1000 / 60;
  return diffMinutes <= 15;
}

/**
 * Check if message is within delete window (15 minutes)
 * @param created_at - Message creation timestamp
 * @returns true if within delete window
 */
export function isWithinDeleteWindow(created_at: string): boolean {
  const createdDate = new Date(created_at);
  const now = new Date();
  const diffMinutes = (now.getTime() - createdDate.getTime()) / 1000 / 60;
  return diffMinutes <= 15;
}
