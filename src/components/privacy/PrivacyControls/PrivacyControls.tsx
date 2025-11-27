'use client';

import React, { useState } from 'react';
import { useConsent } from '../../../contexts/ConsentContext';
import {
  exportUserData,
  downloadJSON,
  clearUserData,
} from '../../../utils/privacy';
import { createLogger } from '@/lib/logger/logger';

const logger = createLogger('components:privacy:PrivacyControls');

export interface PrivacyControlsProps {
  className?: string;
  compact?: boolean;
  expanded?: boolean;
  expandable?: boolean;
  showConfirmation?: boolean;
  theme?: 'light' | 'dark';
  onManage?: () => void;
  onRevoke?: () => void;
  onExport?: () => void;
  onDelete?: () => void;
}

/**
 * Privacy Controls Component
 * Provides a summary of privacy settings and quick actions
 */
export function PrivacyControls({
  className = '',
  compact = false,
  expanded: initialExpanded = false,
  expandable = false,
  showConfirmation = false,
  theme,
  onManage,
  onRevoke,
  onExport,
  onDelete,
}: PrivacyControlsProps) {
  const { consent, isLoading, openModal, resetConsent, hasConsented } =
    useConsent();

  const [expanded, setExpanded] = useState(initialExpanded);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div
        className={`card ${theme === 'dark' ? 'bg-base-200' : 'bg-base-100'} ${className}`}
      >
        <div className="card-body">
          <div className="flex items-center gap-2">
            <span className="loading loading-spinner loading-sm"></span>
            <span>Loading privacy settings...</span>
          </div>
        </div>
      </div>
    );
  }

  const handleManage = () => {
    openModal();
    onManage?.();
  };

  const handleRevoke = () => {
    if (showConfirmation && !showRevokeConfirm) {
      setShowRevokeConfirm(true);
      return;
    }
    resetConsent();
    onRevoke?.();
    setShowRevokeConfirm(false);
  };

  const handleExport = async () => {
    try {
      const data = await exportUserData();
      downloadJSON(data);
      onExport?.();
    } catch (error) {
      logger.error('Failed to export data', { error });
    }
  };

  const handleDelete = async () => {
    if (showConfirmation && !showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    try {
      const result = await clearUserData({
        keepLocalStorage: ['cookieConsent'],
        keepCookies: ['necessary'],
      });

      if (result.success) {
        setDeleteStatus('Your data has been successfully deleted.');
        onDelete?.();
      } else {
        setDeleteStatus('Failed to delete data. Please try again.');
      }
    } catch (error) {
      logger.error('Failed to delete data', { error });
      setDeleteStatus('An error occurred while deleting your data.');
    }

    setShowDeleteConfirm(false);
    setTimeout(() => setDeleteStatus(null), 5000);
  };

  const formatMethod = (method?: string): string => {
    if (!method) return 'Not set';
    return method
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleDateString();
  };

  if (compact) {
    return (
      <div
        role="region"
        aria-label="Privacy controls"
        className={`inline-flex items-center gap-2 rounded-lg p-2 ${theme === 'dark' ? 'bg-base-200' : 'bg-base-100'} ${className} compact`}
      >
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <button
            onClick={handleManage}
            className="btn btn-sm btn-ghost"
            aria-label="Manage cookie preferences"
          >
            Manage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Privacy controls"
      className={`card ${theme === 'dark' ? 'bg-base-200' : 'bg-base-100'} shadow-lg ${className} `}
    >
      <div className="card-body">
        <h3 className="card-title text-lg">Privacy Settings</h3>

        {/* Consent Status */}
        <div role="status" aria-live="polite" className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">Consent Status:</span>
            {hasConsented() ? (
              <span className="badge badge-success">Active</span>
            ) : (
              <span className="badge badge-warning">No consent given</span>
            )}
          </div>

          {/* Cookie Summary */}
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span>Necessary:</span>
              <span className="text-success">✓</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Functional:</span>
              <span
                className={consent.functional ? 'text-success' : 'text-error'}
              >
                {consent.functional ? '✓' : '✗'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Analytics:</span>
              <span
                className={consent.analytics ? 'text-success' : 'text-error'}
              >
                {consent.analytics ? '✓' : '✗'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Marketing:</span>
              <span
                className={consent.marketing ? 'text-success' : 'text-error'}
              >
                {consent.marketing ? '✓' : '✗'}
              </span>
            </div>
          </div>

          {/* Expandable Details */}
          {(expanded || (expandable && expanded)) && (
            <div className="border-base-300 mt-4 space-y-2 border-t pt-4 text-sm">
              <div className="flex items-center justify-between">
                <span>Last Updated:</span>
                <span>{formatDate(consent.lastUpdated)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Consent Method:</span>
                <span className="text-xs">{formatMethod(consent.method)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="card-actions mt-4 flex-wrap justify-end gap-2">
          {expandable && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="btn btn-sm btn-ghost"
              aria-label="Show details"
            >
              Show Details
            </button>
          )}
          {expandable && expanded && (
            <button
              onClick={() => setExpanded(false)}
              className="btn btn-sm btn-ghost"
              aria-label="Hide details"
            >
              Hide Details
            </button>
          )}
          <button
            onClick={handleManage}
            className="btn btn-sm btn-primary"
            aria-label="Manage cookie preferences"
          >
            Manage Cookies
          </button>
          <button
            onClick={handleExport}
            className="btn btn-sm btn-ghost"
            aria-label="Export my data"
          >
            Export My Data
          </button>
          <button
            onClick={handleDelete}
            className="btn btn-sm btn-ghost text-warning"
            aria-label="Delete my data"
          >
            Delete My Data
          </button>
          {hasConsented() && (
            <button
              onClick={handleRevoke}
              className="btn btn-sm btn-ghost text-error"
              aria-label="Revoke consent"
            >
              Revoke Consent
            </button>
          )}
        </div>

        {/* Revoke Confirmation */}
        {showRevokeConfirm && (
          <div className="alert alert-warning mt-4">
            <div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 flex-shrink-0 stroke-current"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <h3 className="font-bold">Are you sure?</h3>
                <div className="text-xs">
                  This will reset all your cookie preferences to default.
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowRevokeConfirm(false)}
                className="btn btn-sm"
                aria-label="Cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                className="btn btn-sm btn-error"
                aria-label="Confirm revoke"
              >
                Confirm
              </button>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="alert alert-error mt-4">
            <div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 flex-shrink-0 stroke-current"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <h3 className="font-bold">Delete All Data?</h3>
                <div className="text-xs">
                  This will permanently delete all your stored data except
                  necessary cookies. This action cannot be undone.
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn btn-sm"
                aria-label="Cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="btn btn-sm btn-error"
                aria-label="Confirm delete"
              >
                Delete All Data
              </button>
            </div>
          </div>
        )}

        {/* Delete Status */}
        {deleteStatus && (
          <div
            className={`alert ${deleteStatus.includes('success') ? 'alert-success' : 'alert-error'} mt-4`}
          >
            <span>{deleteStatus}</span>
          </div>
        )}
      </div>
    </div>
  );
}
