/**
 * Error Handler
 * Error handling and backup utilities for component migration
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Error codes for component operations
 */
const ErrorCode = {
  INVALID_PATH: 'E001',
  PARSE_ERROR: 'E002',
  WRITE_ERROR: 'E003',
  VALIDATION_ERROR: 'E004',
  MIGRATION_ERROR: 'E005',
  PERMISSION_ERROR: 'E006',
  BACKUP_ERROR: 'E007',
};

/**
 * Custom error class for component operations
 */
class ComponentError extends Error {
  constructor(code, message, component = null, file = null) {
    super(message);
    this.name = 'ComponentError';
    this.code = code;
    this.component = component;
    this.file = file;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      component: this.component,
      file: this.file,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Handle file system errors
 * @param {Error} error - Original error
 * @param {string} operation - Operation being performed
 * @param {string} path - File path
 * @returns {ComponentError} Formatted error
 */
function handleFileError(error, operation, path) {
  if (error.code === 'EACCES' || error.code === 'EPERM') {
    return new ComponentError(
      ErrorCode.PERMISSION_ERROR,
      `Permission denied: Cannot ${operation} ${path}`,
      null,
      path
    );
  }

  if (error.code === 'ENOENT') {
    return new ComponentError(
      ErrorCode.INVALID_PATH,
      `Path not found: ${path}`,
      null,
      path
    );
  }

  return new ComponentError(
    ErrorCode.WRITE_ERROR,
    `Failed to ${operation} ${path}: ${error.message}`,
    null,
    path
  );
}

/**
 * Create backup of directory
 * @param {string} sourcePath - Source directory to backup
 * @param {Object} options - Backup options
 * @returns {Object} Backup result
 */
function createBackup(sourcePath, options = {}) {
  const {
    backupDir = path.dirname(sourcePath),
    prefix = '.backup',
    includeTimestamp = true,
  } = options;

  try {
    // Generate backup path
    const timestamp = includeTimestamp
      ? `-${new Date().toISOString().replace(/[:.]/g, '-')}`
      : '';
    const backupName = `${prefix}-${path.basename(sourcePath)}${timestamp}`;
    const backupPath = path.join(backupDir, backupName);

    // Create backup
    copyDirectorySync(sourcePath, backupPath);

    return {
      success: true,
      path: backupPath,
      timestamp: new Date().toISOString(),
      size: getDirectorySize(backupPath),
    };
  } catch (error) {
    throw new ComponentError(
      ErrorCode.BACKUP_ERROR,
      `Failed to create backup: ${error.message}`,
      null,
      sourcePath
    );
  }
}

/**
 * Restore from backup
 * @param {string} backupPath - Backup directory path
 * @param {string} targetPath - Target directory to restore to
 * @returns {boolean} Success status
 */
function restoreBackup(backupPath, targetPath) {
  try {
    // Remove existing target if it exists
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }

    // Copy backup to target
    copyDirectorySync(backupPath, targetPath);

    return true;
  } catch (error) {
    throw new ComponentError(
      ErrorCode.BACKUP_ERROR,
      `Failed to restore backup: ${error.message}`,
      null,
      backupPath
    );
  }
}

/**
 * Synchronously copy directory
 * @param {string} source - Source directory
 * @param {string} destination - Destination directory
 */
function copyDirectorySync(source, destination) {
  // Create destination directory
  fs.mkdirSync(destination, { recursive: true });

  // Read source directory
  const entries = fs.readdirSync(source, { withFileTypes: true });

  // Copy each entry
  entries.forEach((entry) => {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      copyDirectorySync(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  });
}

/**
 * Get directory size
 * @param {string} dirPath - Directory path
 * @returns {number} Size in bytes
 */
function getDirectorySize(dirPath) {
  let size = 0;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  entries.forEach((entry) => {
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      size += getDirectorySize(entryPath);
    } else {
      size += fs.statSync(entryPath).size;
    }
  });

  return size;
}

/**
 * Safe file write with automatic backup
 * @param {string} filePath - File path to write
 * @param {string} content - Content to write
 * @param {Object} options - Write options
 * @returns {boolean} Success status
 */
function safeWriteFile(filePath, content, options = {}) {
  const { backup = true, encoding = 'utf8' } = options;

  try {
    // Create backup if file exists
    if (backup && fs.existsSync(filePath)) {
      const backupPath = `${filePath}.backup`;
      fs.copyFileSync(filePath, backupPath);
    }

    // Write file
    fs.writeFileSync(filePath, content, encoding);

    return true;
  } catch (error) {
    throw handleFileError(error, 'write', filePath);
  }
}

/**
 * Retry operation with exponential backoff
 * @param {Function} operation - Operation to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} delay - Initial delay in ms
 * @returns {*} Operation result
 */
async function retryOperation(operation, maxRetries = 3, delay = 1000) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (i < maxRetries - 1) {
        // Wait with exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, delay * Math.pow(2, i))
        );
      }
    }
  }

  throw lastError;
}

/**
 * Log error to file
 * @param {Error} error - Error to log
 * @param {string} logPath - Log file path
 */
function logError(error, logPath = 'component-errors.log') {
  try {
    const timestamp = new Date().toISOString();
    const errorEntry = `[${timestamp}] ${error.code || 'ERROR'}: ${error.message}\n`;

    fs.appendFileSync(logPath, errorEntry);
  } catch (logError) {
    // Silently fail if logging fails
    console.error('Failed to log error:', logError.message);
  }
}

/**
 * Validate path is safe
 * @param {string} targetPath - Path to validate
 * @param {string} basePath - Base path for validation
 * @returns {boolean} Is path safe
 */
function isPathSafe(targetPath, basePath) {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedBase = path.resolve(basePath);

  return resolvedTarget.startsWith(resolvedBase);
}

module.exports = {
  ErrorCode,
  ComponentError,
  handleFileError,
  createBackup,
  restoreBackup,
  safeWriteFile,
  retryOperation,
  logError,
  isPathSafe,
};
