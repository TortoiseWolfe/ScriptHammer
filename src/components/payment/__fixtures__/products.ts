import type { Product } from '@/types/commerce';

export const landingPage: Product = {
  id: 'svc-landing',
  lane: 'service',
  name: 'Landing Page',
  tagline: 'One page. Live on your domain. Leads in your inbox.',
  description: null,
  amount: 120000,
  amount_mode: 'fixed',
  min_amount: null,
  max_amount: null,
  currency: 'usd',
  type: 'one_time',
  interval: null,
  stripe_price_id: null,
  paypal_plan_id: null,
  features: [],
  metadata: { deposit_pct: 50 },
  sort_order: 20,
  active: true,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

export const discovery: Product = {
  ...landingPage,
  id: 'svc-discovery',
  name: 'Discovery',
  tagline: 'Prove it works before you commit.',
  amount: 25000,
  metadata: {},
};

/**
 * A monthly Care Plan. Seeded `active=false` in production (migration:467), so nobody
 * can buy one today — which is precisely why it needs a fixture: the recurring branch of
 * `cancellationTerms` is otherwise unreachable by any test or any human.
 */
export const carePlan: Product = {
  ...landingPage,
  id: 'svc-care',
  name: 'Care Plan',
  tagline: 'Someone answers when it breaks.',
  amount: 9900,
  type: 'recurring',
  interval: 'month',
  metadata: {},
  active: false,
};
