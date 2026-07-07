/**
 * Logger Service Unit Tests
 *
 * TDD: These tests define the expected behavior of the logger service.
 * Write tests first (RED), then implement to make them pass (GREEN).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createLogger,
  LogLevel,
  configureLogger,
  getLoggerConfig,
  logger,
} from './logger';

describe('Logger Service', () => {
  // Store original console methods
  const originalConsole = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  // Mock console methods
  beforeEach(() => {
    console.debug = vi.fn();
    console.info = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();

    // Reset to development config for each test
    configureLogger({
      minLevel: LogLevel.DEBUG,
      timestamps: true,
      showCategory: true,
    });
  });

  afterEach(() => {
    // Restore original console methods
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    vi.clearAllMocks();
  });

  describe('createLogger', () => {
    it('should create a logger with the specified category', () => {
      const log = createLogger('auth');
      expect(log.category).toBe('auth');
    });

    it('should default to "app" category when empty string provided', () => {
      const log = createLogger('');
      expect(log.category).toBe('app');
    });

    it('should sanitize invalid category characters', () => {
      const log = createLogger('foo@bar!baz');
      expect(log.category).toBe('foo-bar-baz');
    });

    it('should lowercase the category', () => {
      const log = createLogger('AUTH');
      expect(log.category).toBe('auth');
    });
  });

  describe('Log Levels', () => {
    it('should call console.debug for debug level', () => {
      const log = createLogger('test');
      log.debug('test message');
      expect(console.debug).toHaveBeenCalled();
    });

    it('should call console.info for info level', () => {
      const log = createLogger('test');
      log.info('test message');
      expect(console.info).toHaveBeenCalled();
    });

    it('should call console.warn for warn level', () => {
      const log = createLogger('test');
      log.warn('test message');
      expect(console.warn).toHaveBeenCalled();
    });

    it('should call console.error for error level', () => {
      const log = createLogger('test');
      log.error('test message');
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Log Level Filtering', () => {
    it('should suppress debug/info logs in production', () => {
      configureLogger({ minLevel: LogLevel.WARN });
      const log = createLogger('test');

      log.debug('debug message');
      log.info('info message');
      log.warn('warn message');
      log.error('error message');

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    it('should allow only error logs when minLevel is ERROR', () => {
      configureLogger({ minLevel: LogLevel.ERROR });
      const log = createLogger('test');

      log.debug('debug');
      log.info('info');
      log.warn('warn');
      log.error('error');

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    it('should allow all logs when minLevel is DEBUG', () => {
      configureLogger({ minLevel: LogLevel.DEBUG });
      const log = createLogger('test');

      log.debug('debug');
      log.info('info');
      log.warn('warn');
      log.error('error');

      expect(console.debug).toHaveBeenCalled();
      expect(console.info).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Output Format', () => {
    it('should include category in output when showCategory is true', () => {
      configureLogger({ showCategory: true, timestamps: false });
      const log = createLogger('auth');
      log.info('test message');

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('[auth]'),
        expect.anything()
      );
    });

    it('should exclude category when showCategory is false', () => {
      configureLogger({ showCategory: false, timestamps: false });
      const log = createLogger('auth');
      log.info('test message');

      const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).not.toContain('[auth]');
    });

    it('should include ISO 8601 timestamp when timestamps is true', () => {
      configureLogger({ timestamps: true, showCategory: false });
      const log = createLogger('test');
      log.info('test message');

      const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0];
      // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(call[0]).toMatch(
        /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/
      );
    });

    it('should exclude timestamp when timestamps is false', () => {
      configureLogger({ timestamps: false });
      const log = createLogger('test');
      log.info('test message');

      const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).not.toMatch(/\[\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('Context Handling', () => {
    it('should include context object in log output', () => {
      configureLogger({ timestamps: false, showCategory: false });
      const log = createLogger('test');
      const context = { userId: '123', action: 'login' };
      log.info('user action', context);

      expect(console.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining(context)
      );
    });

    it('should handle undefined context gracefully', () => {
      const log = createLogger('test');
      expect(() => log.info('message')).not.toThrow();
      expect(() => log.info('message', undefined)).not.toThrow();
    });

    it('should handle circular references in context', () => {
      const log = createLogger('test');
      const circular: Record<string, unknown> = { name: 'test' };
      circular.self = circular;

      // Should not throw
      expect(() => log.info('circular test', circular)).not.toThrow();
      expect(console.info).toHaveBeenCalled();
    });

    it('should redact sensitive keys in context', () => {
      configureLogger({ timestamps: false, showCategory: false });
      const log = createLogger('test');
      const context = {
        userId: '123',
        password: 'secret123',
        token: 'abc123',
        email: 'test@example.com',
      };
      log.info('sensitive data', context);

      const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0];
      const loggedContext = call[1];

      expect(loggedContext.userId).toBe('123');
      expect(loggedContext.password).toBe('[REDACTED]');
      expect(loggedContext.token).toBe('[REDACTED]');
      expect(loggedContext.email).toBe('[REDACTED]');
    });
  });

  describe('Message Handling', () => {
    it('should truncate extremely long messages', () => {
      const log = createLogger('test');
      const longMessage = 'a'.repeat(15000); // > 10KB

      log.info(longMessage);

      const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0].length).toBeLessThan(longMessage.length);
      expect(call[0]).toContain('...[truncated]');
    });

    it('should not truncate normal length messages', () => {
      configureLogger({ timestamps: false, showCategory: false });
      const log = createLogger('test');
      const normalMessage = 'This is a normal message';

      log.info(normalMessage);

      const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain(normalMessage);
      expect(call[0]).not.toContain('[truncated]');
    });
  });

  describe('Global Configuration', () => {
    it('should return current config via getLoggerConfig', () => {
      configureLogger({
        minLevel: LogLevel.WARN,
        timestamps: false,
        showCategory: true,
      });

      const config = getLoggerConfig();

      expect(config.minLevel).toBe(LogLevel.WARN);
      expect(config.timestamps).toBe(false);
      expect(config.showCategory).toBe(true);
    });

    it('should allow partial config updates', () => {
      configureLogger({ minLevel: LogLevel.DEBUG, timestamps: true });
      configureLogger({ timestamps: false });

      const config = getLoggerConfig();
      expect(config.minLevel).toBe(LogLevel.DEBUG);
      expect(config.timestamps).toBe(false);
    });
  });

  describe('Default Logger Instance', () => {
    it('should export a default logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger.category).toBe('app');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message', () => {
      const log = createLogger('test');
      expect(() => log.info('')).not.toThrow();
    });

    it('should handle null-ish values in context gracefully', () => {
      const log = createLogger('test');
      expect(() => log.info('test', { value: null })).not.toThrow();
      expect(() => log.info('test', { value: undefined })).not.toThrow();
    });

    it('should not throw if console methods are unavailable', () => {
      const log = createLogger('test');

      // Temporarily remove console.info
      const savedInfo = console.info;
      // @ts-expect-error - intentionally setting to undefined for test
      console.info = undefined;

      expect(() => log.info('test')).not.toThrow();

      console.info = savedInfo;
    });
  });

  describe('LogLevel Enum', () => {
    it('should export LogLevel enum with correct values', () => {
      expect(LogLevel.DEBUG).toBe(0);
      expect(LogLevel.INFO).toBe(1);
      expect(LogLevel.WARN).toBe(2);
      expect(LogLevel.ERROR).toBe(3);
    });
  });
});
