/**
 * Logger Service - Storybook Demo
 *
 * Interactive demonstration of the logger service functionality.
 * Open browser console to see log output.
 */
import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';
import {
  createLogger,
  LogLevel,
  configureLogger,
  getLoggerConfig,
} from './logger';

// Demo component for interactive logger testing
function LoggerDemo() {
  const [category, setCategory] = useState('demo');
  const [message, setMessage] = useState('Hello, logger!');
  const [minLevel, setMinLevel] = useState<LogLevel>(LogLevel.DEBUG);
  const [timestamps, setTimestamps] = useState(true);
  const [showCategory, setShowCategory] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (entry: string) => {
    setLogs((prev) => [...prev.slice(-9), entry]);
  };

  const handleLog = (level: 'debug' | 'info' | 'warn' | 'error') => {
    configureLogger({ minLevel, timestamps, showCategory });
    const logger = createLogger(category);

    const context = { timestamp: Date.now(), demoValue: Math.random() };

    switch (level) {
      case 'debug':
        logger.debug(message, context);
        break;
      case 'info':
        logger.info(message, context);
        break;
      case 'warn':
        logger.warn(message, context);
        break;
      case 'error':
        logger.error(message, context);
        break;
    }

    const config = getLoggerConfig();
    const levelNum = LogLevel[level.toUpperCase() as keyof typeof LogLevel];
    const suppressed = levelNum < config.minLevel;

    addLog(
      `[${new Date().toLocaleTimeString()}] ${level.toUpperCase()}: "${message}" ${
        suppressed ? '(SUPPRESSED)' : '(see console)'
      }`
    );
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '1rem' }}>
      <h2>Logger Service Demo</h2>
      <p style={{ color: '#666' }}>
        Open browser console (F12) to see actual log output
      </p>

      <div
        style={{
          display: 'grid',
          gap: '1rem',
          maxWidth: '500px',
          marginBottom: '1rem',
        }}
      >
        <label>
          Category:
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
          />
        </label>

        <label>
          Message:
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ marginLeft: '0.5rem', padding: '0.25rem', width: '200px' }}
          />
        </label>

        <label>
          Min Log Level:
          <select
            value={minLevel}
            onChange={(e) => setMinLevel(Number(e.target.value))}
            style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
          >
            <option value={LogLevel.DEBUG}>DEBUG (all logs)</option>
            <option value={LogLevel.INFO}>INFO (info+)</option>
            <option value={LogLevel.WARN}>WARN (warn+)</option>
            <option value={LogLevel.ERROR}>ERROR (errors only)</option>
          </select>
        </label>

        <label>
          <input
            type="checkbox"
            checked={timestamps}
            onChange={(e) => setTimestamps(e.target.checked)}
          />
          Show Timestamps
        </label>

        <label>
          <input
            type="checkbox"
            checked={showCategory}
            onChange={(e) => setShowCategory(e.target.checked)}
          />
          Show Category
        </label>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          onClick={() => handleLog('debug')}
          style={{ padding: '0.5rem 1rem', backgroundColor: '#6b7280' }}
        >
          Debug
        </button>
        <button
          onClick={() => handleLog('info')}
          style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6' }}
        >
          Info
        </button>
        <button
          onClick={() => handleLog('warn')}
          style={{ padding: '0.5rem 1rem', backgroundColor: '#f59e0b' }}
        >
          Warn
        </button>
        <button
          onClick={() => handleLog('error')}
          style={{ padding: '0.5rem 1rem', backgroundColor: '#ef4444' }}
        >
          Error
        </button>
      </div>

      <div
        style={{
          backgroundColor: '#1e1e1e',
          color: '#d4d4d4',
          padding: '1rem',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          minHeight: '200px',
        }}
      >
        <div style={{ color: '#888', marginBottom: '0.5rem' }}>
          Activity Log:
        </div>
        {logs.length === 0 ? (
          <div style={{ color: '#666' }}>Click a button to log...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} style={{ marginBottom: '0.25rem' }}>
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const meta: Meta<typeof LoggerDemo> = {
  title: 'Lib/Logger',
  component: LoggerDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
# Logger Service

A lightweight, structured logging utility for the application.

## Features

- Four log levels: \`debug\`, \`info\`, \`warn\`, \`error\`
- Category namespacing for grouping related logs
- Environment-aware: debug/info suppressed in production
- ISO 8601 timestamps in development
- Automatic PII redaction
- Handles circular references and long messages

## Usage

\`\`\`typescript
import { createLogger } from '@/lib/logger';

const logger = createLogger('auth');

logger.debug('Debug info');
logger.info('User logged in', { userId: '123' });
logger.warn('Session expiring');
logger.error('Login failed', { error: 'Invalid credentials' });
\`\`\`
        `,
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof LoggerDemo>;

export const Interactive: Story = {
  name: 'Interactive Demo',
};

export const LogLevels: Story = {
  name: 'Log Level Examples',
  render: () => {
    const logger = createLogger('example');

    return (
      <div style={{ fontFamily: 'system-ui', padding: '1rem' }}>
        <h3>Log Level Examples</h3>
        <p>Click buttons and check browser console:</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => logger.debug('Debug message', { detail: 1 })}>
            Debug
          </button>
          <button onClick={() => logger.info('Info message', { detail: 2 })}>
            Info
          </button>
          <button onClick={() => logger.warn('Warning message', { detail: 3 })}>
            Warn
          </button>
          <button onClick={() => logger.error('Error message', { detail: 4 })}>
            Error
          </button>
        </div>
      </div>
    );
  },
};

export const SensitiveDataRedaction: Story = {
  name: 'PII Redaction',
  render: () => {
    const logger = createLogger('security');

    const logWithSensitiveData = () => {
      logger.info('User data', {
        userId: '12345',
        password: 'secret123', // Will be redacted
        token: 'abc123xyz', // Will be redacted
        email: 'user@example.com', // Will be redacted
        normalField: 'visible',
      });
    };

    return (
      <div style={{ fontFamily: 'system-ui', padding: '1rem' }}>
        <h3>PII Redaction Demo</h3>
        <p>
          Sensitive fields (password, token, email) are automatically redacted:
        </p>
        <button onClick={logWithSensitiveData}>
          Log with Sensitive Data (check console)
        </button>
      </div>
    );
  },
};
