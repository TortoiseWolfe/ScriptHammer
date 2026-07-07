/**
 * MSW Handlers for mocking API responses
 * Used in Storybook and tests
 */

import { http, HttpResponse } from 'msw';

// Mock subscription data for Storybook
const mockSubscriptions = [
  {
    id: 'sub-1',
    provider_subscription_id: 'stripe_sub_123',
    provider: 'stripe',
    status: 'active',
    amount: 2999,
    currency: 'usd',
    interval: 'month',
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString(),
    cancel_at_period_end: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'sub-2',
    provider_subscription_id: 'paypal_sub_456',
    provider: 'paypal',
    status: 'active',
    amount: 9999,
    currency: 'usd',
    interval: 'year',
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(
      Date.now() + 365 * 24 * 60 * 60 * 1000
    ).toISOString(),
    cancel_at_period_end: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Mock payment results for Storybook
const mockPaymentResults = [
  {
    id: 'result-succeeded',
    intent_id: 'intent-123',
    provider: 'stripe',
    transaction_id: 'txn_1234567890',
    status: 'succeeded',
    charged_amount: 4999,
    charged_currency: 'usd',
    webhook_verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'result-failed',
    intent_id: 'intent-456',
    provider: 'paypal',
    transaction_id: 'txn_0987654321',
    status: 'failed',
    charged_amount: 2999,
    charged_currency: 'usd',
    webhook_verified: false,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Generate additional payment history
const mockPaymentHistory = Array.from({ length: 25 }, (_, i) => {
  const statuses = ['succeeded', 'failed', 'refunded', 'pending'];
  const providers = ['stripe', 'paypal'];
  const status = statuses[i % statuses.length];
  const provider = providers[i % providers.length];

  return {
    id: `payment-${i + 1}`,
    intent_id: `intent-${i + 1}`,
    provider,
    transaction_id: `txn_${Math.random().toString(36).substr(2, 9)}`,
    status,
    charged_amount: Math.floor(Math.random() * 10000) + 1000,
    charged_currency: 'usd',
    webhook_verified: i % 3 === 0,
    created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
  };
});

export const handlers = [
  // Web3Forms API mock
  http.post('https://api.web3forms.com/submit', async ({ request }) => {
    const body = await request.formData();
    const honeypot = body.get('botcheck');

    // Simulate bot detection
    if (honeypot) {
      return HttpResponse.json(
        { success: false, message: 'Bot detected' },
        { status: 400 }
      );
    }

    // Simulate successful submission
    return HttpResponse.json(
      {
        success: true,
        message: 'Form submitted successfully',
        data: {
          name: body.get('name'),
          email: body.get('email'),
          message: body.get('message'),
        },
      },
      { status: 200 }
    );
  }),

  // Simulate offline submission failure
  http.post('https://api.web3forms.com/submit-offline', () => {
    return HttpResponse.error();
  }),

  // Supabase REST API: Subscriptions
  http.get('*/rest/v1/subscriptions', ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get('template_user_id');

    // Filter by user ID if provided
    const filtered = userId
      ? mockSubscriptions.filter((s) => userId.includes('demo'))
      : mockSubscriptions;

    return HttpResponse.json(filtered, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Range': `0-${filtered.length - 1}/${filtered.length}`,
      },
    });
  }),

  // Supabase REST API: Payment Results (single result by ID)
  http.get('*/rest/v1/payment_results', ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const select = url.searchParams.get('select');

    // If querying by ID (for PaymentStatusDisplay)
    if (id) {
      const result = [...mockPaymentResults, ...mockPaymentHistory].find(
        (p) => id.includes(p.id) || id.includes(p.status)
      );

      // Return array format (Supabase always returns arrays)
      return HttpResponse.json(result ? [result] : [], {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // For PaymentHistory (returns multiple results with join)
    if (select?.includes('intent')) {
      // Mock joined data with payment_intents
      const withIntents = mockPaymentHistory.map((p) => ({
        ...p,
        intent: {
          customer_email: 'demo@example.com',
        },
      }));

      return HttpResponse.json(withIntents, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Range': `0-${withIntents.length - 1}/${withIntents.length}`,
        },
      });
    }

    // Default: return all payment history
    return HttpResponse.json(mockPaymentHistory, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Range': `0-${mockPaymentHistory.length - 1}/${mockPaymentHistory.length}`,
      },
    });
  }),
];
