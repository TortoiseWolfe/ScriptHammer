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
