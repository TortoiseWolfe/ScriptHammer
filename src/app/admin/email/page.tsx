'use client';

import React, { useState, useEffect } from 'react';
import { EmailProviderHealth } from '@/components/organisms/EmailProviderHealth';
import type { EmailRateLimitStatus } from '@/components/organisms/EmailProviderHealth';
import { emailService } from '@/utils/email/email-service';
import type { ProviderStatus } from '@/utils/email/types';

/**
 * /admin/email — provider health dashboard for the dual-provider email
 * abstraction (#34). Layered inside src/app/admin/layout.tsx (ProtectedRoute →
 * AdminGate). Reads emailService.getStatus() / getRateLimitStatus() and renders
 * the EmailProviderHealth organism. Mirrors src/app/admin/payments/page.tsx.
 */
export default function AdminEmailPage() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [rateLimitStatus, setRateLimitStatus] =
    useState<EmailRateLimitStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const status = await emailService.getStatus();
        const rateLimit = emailService.getRateLimitStatus();
        if (cancelled) return;
        setProviders(status);
        setRateLimitStatus(rateLimit);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Failed to load email status'
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Email Provider Health</h1>
      </div>

      {error && (
        <div className="alert alert-error mb-6" role="alert">
          <span>{error}</span>
        </div>
      )}

      <EmailProviderHealth
        providers={providers}
        rateLimitStatus={rateLimitStatus}
        isLoading={isLoading}
        testId="admin-email-health"
      />
    </div>
  );
}
