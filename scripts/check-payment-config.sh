#!/bin/bash
# Verify that the 9 environment variables needed for payment integration
# are configured correctly:
#   - 4 browser-safe vars in .env (NEXT_PUBLIC_*)
#   - 5 secrets in Supabase Vault
#
# Usage: ./scripts/check-payment-config.sh
#
# Exit codes:
#   0 — all 9 values present
#   1 — at least one missing or .env file not found
#   2 — supabase CLI not available
#
# Companion to docs/PAYMENT-DEPLOYMENT.md Step 3.

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
DIM='\033[0;90m'
NC='\033[0m'

ENV_FILE=".env"
MISSING_COUNT=0

echo "Checking payment configuration..."
echo ""

# ─── Section 1: browser-safe vars in .env ──────────────────────────────

if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}✗${NC} .env file not found. Copy .env.example to .env and fill in values."
  exit 1
fi

echo "─── Browser-safe (.env) ──────────────────────────────────"

BROWSER_VARS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
  "NEXT_PUBLIC_PAYPAL_CLIENT_ID"
)

for var in "${BROWSER_VARS[@]}"; do
  # Match `VAR=value` (not commented out, not empty)
  value=$(grep -E "^${var}=.+" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || echo "")
  if [ -z "$value" ] || [ "$value" = "your-anon-key" ] || [[ "$value" == *"xxxxxxxxxxxxxxxxxxxxxxxx"* ]]; then
    echo -e "  ${RED}✗${NC} ${var} ${DIM}(missing or placeholder)${NC}"
    MISSING_COUNT=$((MISSING_COUNT + 1))
  else
    # Mask sensitive values (show prefix + last 4)
    if [ ${#value} -gt 16 ]; then
      masked="${value:0:8}...${value: -4}"
    else
      masked="${value:0:4}..."
    fi
    echo -e "  ${GREEN}✓${NC} ${var} ${DIM}= ${masked}${NC}"
  fi
done

echo ""

# ─── Section 2: secrets in Supabase Vault ──────────────────────────────

echo "─── Secrets (Supabase Vault) ─────────────────────────────"

if ! command -v supabase >/dev/null 2>&1; then
  echo -e "${YELLOW}⚠${NC} supabase CLI not found in PATH."
  echo "  Install per docs/PAYMENT-DEPLOYMENT.md Prerequisites."
  echo "  Cannot verify Vault secrets without it."
  exit 2
fi

# Try `supabase secrets list` — may fail if not linked to a project
SECRETS_OUTPUT=$(supabase secrets list 2>&1) || {
  echo -e "${YELLOW}⚠${NC} 'supabase secrets list' failed."
  echo "$SECRETS_OUTPUT" | head -3 | sed 's/^/  /'
  echo "  Run 'supabase login' and 'supabase link --project-ref <ref>' first."
  exit 2
}

SECRET_VARS=(
  "STRIPE_SECRET_KEY"
  "STRIPE_WEBHOOK_SECRET"
  "PAYPAL_CLIENT_SECRET"
  "PAYPAL_WEBHOOK_ID"
  "SUPABASE_SERVICE_ROLE_KEY"
)

for var in "${SECRET_VARS[@]}"; do
  if echo "$SECRETS_OUTPUT" | grep -qE "^[[:space:]]*${var}[[:space:]]"; then
    echo -e "  ${GREEN}✓${NC} ${var} ${DIM}(set in Vault)${NC}"
  else
    echo -e "  ${RED}✗${NC} ${var} ${DIM}(not set — run: supabase secrets set ${var}=<value>)${NC}"
    MISSING_COUNT=$((MISSING_COUNT + 1))
  fi
done

echo ""

# ─── Summary ──────────────────────────────────────────────────────────

if [ $MISSING_COUNT -eq 0 ]; then
  echo -e "${GREEN}All 9 payment configuration values are set.${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Deploy Edge Functions:  supabase functions deploy stripe-webhook && supabase functions deploy paypal-webhook && supabase functions deploy send-payment-email"
  echo "  2. Register webhook URLs in Stripe + PayPal dashboards (see Step 5 of PAYMENT-DEPLOYMENT.md)"
  echo "  3. NOTE: outbound Edge Functions (create-stripe-checkout etc.) are NOT yet shipped — see Phase 0 in the deployment doc."
  exit 0
else
  echo -e "${RED}${MISSING_COUNT} value(s) missing or invalid.${NC}"
  echo ""
  echo "Reference: docs/PAYMENT-DEPLOYMENT.md Step 3"
  exit 1
fi
