'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useConsent } from '../../../contexts/ConsentContext';
import { CookieCategory } from '../../../utils/consent-types';

export interface ConsentModalProps {
  className?: string;
  onSave?: () => void;
  onClose?: () => void;
  privacyPolicyUrl?: string;
  cookiePolicyUrl?: string;
  showDetails?: boolean;
}

interface CategoryInfo {
  category: CookieCategory;
  title: string;
  description: string;
  details?: string;
  alwaysOn?: boolean;
}

const COOKIE_CATEGORIES: CategoryInfo[] = [
  {
    category: CookieCategory.NECESSARY,
    title: 'Necessary Cookies',
    description:
      'Essential for the website to function properly. These cookies cannot be disabled.',
    details:
      'These cookies are required for basic site functionality including page navigation, form submission, and security features. They do not store any personally identifiable information.',
    alwaysOn: true,
  },
  {
    category: CookieCategory.FUNCTIONAL,
    title: 'Functional Cookies',
    description:
      'Remember your preferences and choices to provide a personalized experience.',
    details:
      'These cookies help us provide enhanced functionality and personalization. They may be set by us or by third party providers whose services we use.',
  },
  {
    category: CookieCategory.ANALYTICS,
    title: 'Analytics Cookies',
    description:
      'Help us understand how you use our website to improve your experience.',
    details:
      'We use these cookies to collect information about how visitors use our website. This helps us improve the site and provide better content.',
  },
  {
    category: CookieCategory.MARKETING,
    title: 'Marketing Cookies',
    description:
      'Used to show you relevant ads and measure the effectiveness of our campaigns.',
    details:
      'These cookies track your online activity to help advertisers deliver more relevant advertising. They are usually placed by advertising networks with our permission.',
  },
];

/**
 * Cookie Consent Modal Component
 * Provides detailed control over cookie preferences
 */
export function ConsentModal({
  className = '',
  onSave,
  onClose,
  privacyPolicyUrl,
  cookiePolicyUrl,
  showDetails = false,
}: ConsentModalProps) {
  const {
    consent,
    showModal,
    isLoading,
    updateConsent,
    savePreferences,
    acceptAll,
    rejectAll,
    closeModal,
  } = useConsent();

  const [expandedCategories, setExpandedCategories] = useState<
    Set<CookieCategory>
  >(new Set());
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);
  const lastFocusableRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => {
    closeModal();
    onClose?.();
  }, [closeModal, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModal) {
        handleClose();
      }
    };

    if (showModal) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
    return undefined;
  }, [showModal, handleClose]);

  // Focus management
  useEffect(() => {
    if (showModal && firstFocusableRef.current) {
      // Small delay to ensure modal is rendered
      setTimeout(() => {
        firstFocusableRef.current?.focus();
      }, 100);
    }
  }, [showModal]);

  // Do not render if modal should not be shown or still loading
  if (!showModal || isLoading) {
    return null;
  }

  const handleSave = () => {
    savePreferences(consent);
    onSave?.();
  };

  const handleAcceptAll = () => {
    acceptAll();
    onSave?.();
  };

  const handleRejectAll = () => {
    rejectAll();
    onSave?.();
  };

  const toggleCategory = (category: CookieCategory, enabled: boolean) => {
    if (category !== CookieCategory.NECESSARY) {
      updateConsent(category, enabled);
    }
  };

  const toggleDetails = (category: CookieCategory) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const getCategoryValue = (category: CookieCategory): boolean => {
    switch (category) {
      case CookieCategory.NECESSARY:
        return true;
      case CookieCategory.FUNCTIONAL:
        return consent.functional;
      case CookieCategory.ANALYTICS:
        return consent.analytics;
      case CookieCategory.MARKETING:
        return consent.marketing;
      default:
        return false;
    }
  };

  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div
      className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black"
      onClick={handleClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-label="Cookie preferences modal"
        aria-modal="true"
        className={`bg-base-100 mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg shadow-xl ${className} `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-base-300 flex items-center justify-between border-b p-6">
          <h2 className="text-2xl font-bold">Manage Cookie Preferences</h2>
          <button
            ref={firstFocusableRef}
            onClick={handleClose}
            className="btn btn-sm btn-circle btn-ghost"
            aria-label="Close modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Description */}
            <div className="prose max-w-none">
              <p className="text-base-content/80">
                We use cookies to enhance your browsing experience, analyze site
                traffic, and personalize content. You can choose which types of
                cookies you allow.
              </p>
              {(privacyPolicyUrl || cookiePolicyUrl) && (
                <p className="mt-2 text-sm">
                  Learn more in our{' '}
                  {privacyPolicyUrl && (
                    <>
                      <a
                        href={privacyPolicyUrl}
                        className="link link-primary"
                        aria-label="Privacy Policy"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Privacy Policy
                      </a>
                      {cookiePolicyUrl && ' and '}
                    </>
                  )}
                  {cookiePolicyUrl && (
                    <a
                      href={cookiePolicyUrl}
                      className="link link-primary"
                      aria-label="Cookie Policy"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Cookie Policy
                    </a>
                  )}
                  .
                </p>
              )}
            </div>

            {/* Cookie Categories */}
            <div
              role="group"
              aria-label="Cookie categories"
              className="max-h-96 space-y-4 overflow-y-auto"
            >
              {COOKIE_CATEGORIES.map((categoryInfo) => {
                const isChecked = getCategoryValue(categoryInfo.category);
                const isExpanded = expandedCategories.has(
                  categoryInfo.category
                );

                return (
                  <div
                    key={categoryInfo.category}
                    className="card bg-base-200 shadow-sm"
                  >
                    <div className="card-body p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 pr-4">
                          <h3 className="mb-1 text-lg font-semibold">
                            {categoryInfo.title}
                          </h3>
                          <p className="text-base-content/70 text-sm">
                            {categoryInfo.description}
                          </p>

                          {showDetails && categoryInfo.details && (
                            <>
                              <button
                                onClick={() =>
                                  toggleDetails(categoryInfo.category)
                                }
                                className="btn btn-xs btn-ghost mt-2"
                                aria-label={`Learn more about ${categoryInfo.title.toLowerCase()}`}
                                aria-expanded={isExpanded}
                              >
                                {isExpanded ? 'Hide' : 'Learn more'} ↓
                              </button>
                              {isExpanded && (
                                <div className="bg-base-100 mt-2 rounded p-3 text-sm">
                                  {categoryInfo.details}
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <div className="form-control">
                          <label className="label cursor-pointer">
                            <input
                              type="checkbox"
                              className="toggle toggle-primary"
                              checked={isChecked}
                              disabled={categoryInfo.alwaysOn}
                              onChange={(e) =>
                                toggleCategory(
                                  categoryInfo.category,
                                  e.target.checked
                                )
                              }
                              aria-label={categoryInfo.title}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Last Updated */}
            {consent.lastUpdated && (
              <div className="text-base-content/60 text-sm">
                Last updated: {formatDate(consent.lastUpdated)}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-base-300 border-t p-6">
          <div className="flex flex-col justify-end gap-3 sm:flex-row">
            <button
              onClick={handleRejectAll}
              className="btn btn-ghost"
              aria-label="Reject all optional cookies"
            >
              Reject All
            </button>
            <button
              onClick={handleAcceptAll}
              className="btn btn-outline"
              aria-label="Accept all cookies"
            >
              Accept All
            </button>
            <button
              ref={lastFocusableRef}
              onClick={handleSave}
              className="btn btn-primary"
              aria-label="Save cookie preferences"
            >
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
