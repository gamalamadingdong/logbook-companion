# Subscription Functions (Stripe Integration)

Complete Stripe subscription management system with webhooks, payment intent creation, session verification, status checking, and tier management.

## 🎯 Overview

This package provides five Edge Functions that handle the complete subscription lifecycle: signup, payment processing, tier changes, status synchronization, and webhook event handling.

## 📦 Functions

### 1. stripe-webhooks ⚡ CRITICAL

**Purpose**: Processes Stripe webhook events to keep your database in sync with Stripe.

**Endpoint**: `POST /functions/v1/stripe-webhooks` (called by Stripe, not your app)

**Webhook Events Handled**:
- `customer.subscription.created` - New subscription activated
- `customer.subscription.updated` - Subscription changed
- `customer.subscription.deleted` - Subscription cancelled
- `invoice.payment_succeeded` - Payment successful
- `invoice.payment_failed` - Payment failed

**Response**:
```json
{
  "received": true
}
```

**Features**:
- Signature verification for security
- Automatic database synchronization
- Audit trail via subscription_events table
- Handles upgrades, downgrades, and cancellations

**⚠️ CRITICAL**: Without this webhook handler, your database won't know about subscription changes!

---

### 2. create-subscription-intent

**Purpose**: Creates a Stripe subscription with payment intent for embedded payment flows.

**Endpoint**: `POST /functions/v1/create-subscription-intent`

**Request**:
```json
{
  "businessId": "business-uuid",
  "tier": "professional"
}
```

**Response**:
```json
{
  "clientSecret": "pi_xxx_secret_yyy",
  "subscriptionId": "sub_xxx",
  "paymentIntentId": "pi_xxx",
  "success": true
}
```

**Features**:
- Creates or reuses Stripe customer
- Generates payment intent for immediate collection
- Handles duplicate subscription detection
- Returns client secret for Stripe Elements

**Use Case**: Embedded payment forms using Stripe PaymentElement

---

### 3. verify-stripe-session

**Purpose**: Verifies completed Stripe Checkout session and updates database.

**Endpoint**: `POST /functions/v1/verify-stripe-session`

**Request**:
```json
{
  "sessionId": "cs_test_xxx",
  "businessId": "business-uuid"
}
```

**Response**:
```json
{
  "success": true,
  "tier": "professional",
  "subscriptionId": "sub_xxx",
  "status": "active"
}
```

**Features**:
- Validates payment completion
- Extracts subscription details
- Updates business tier and features
- Logs verification event

**Use Case**: After successful redirect from Stripe Checkout

---

### 4. check-subscription-status

**Purpose**: Checks current subscription status from Stripe and syncs with database.

**Endpoint**: `POST /functions/v1/check-subscription-status`

**Request**:
```json
{
  "businessId": "business-uuid",
  "stripeCustomerId": "cus_xxx"
}
```

**Response**:
```json
{
  "subscription": { /* Stripe subscription object */ },
  "updated": true,
  "current": "professional",
  "previousTier": "starter"
}
```

**Features**:
- Fetches live data from Stripe
- Detects discrepancies
- Updates database if needed
- Returns sync status

**Use Case**: Manual reconciliation, periodic sync jobs, or before feature access

---

### 5. manage-subscription-tier

**Purpose**: Handles subscription upgrades, downgrades, and cancellations.

**Endpoint**: `POST /functions/v1/manage-subscription-tier`

**Request** (Upgrade):
```json
{
  "businessId": "business-uuid",
  "targetTier": "enterprise"
}
```

**Request** (Cancel):
```json
{
  "businessId": "business-uuid",
  "targetTier": "free"
}
```

**Response**:
```json
{
  "success": true,
  "action": "upgrade",
  "effectiveDate": "2025-10-02T12:00:00Z",
  "subscriptionId": "sub_xxx"
}
```

**Features**:
- **Upgrades**: Immediate with proration
- **Downgrades**: End of billing period
- **Cancellations**: End of billing period
- Tier hierarchy management

**Use Case**: Self-service plan changes in your app

---

## 🚀 Deployment

### 1. Create Stripe Price IDs

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) > Products
2. Create products for each tier (Starter, Professional, Enterprise)
3. Add monthly and/or annual prices
4. Copy the price IDs (format: `price_xxxxx`)

### 2. Update Price IDs in Functions

Edit each function file and replace placeholder price IDs:

```typescript
// In stripe-webhooks/index.ts, create-intent/index.ts, etc.
const PRICE_IDS = {
  starter: 'price_YOUR_STARTER_MONTHLY',
  professional: 'price_YOUR_PROFESSIONAL_MONTHLY',
  enterprise: 'price_YOUR_ENTERPRISE_MONTHLY',
}
```

### 3. Deploy Functions

```bash
cd packages/functions/subscriptions

# Deploy all subscription functions
supabase functions deploy stripe-webhooks
supabase functions deploy create-intent --no-verify-jwt
supabase functions deploy verify-session --no-verify-jwt
supabase functions deploy check-status --no-verify-jwt
supabase functions deploy manage-tier --no-verify-jwt
```

### 4. Set Environment Variables

```bash
# Required for all functions
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx  # or sk_live_xxx
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Required for webhook function
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### 5. Configure Stripe Webhook

1. Go to Stripe Dashboard > Developers > Webhooks
2. Click "Add endpoint"
3. **URL**: `https://your-project.supabase.co/functions/v1/stripe-webhooks`
4. **Events to listen for**:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the **Signing secret** (format: `whsec_xxx`)
6. Add to Supabase: `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx`

### 6. Verify Deployment

```bash
# Test webhook endpoint (Stripe will verify signature fails, but endpoint should respond)
curl -X POST 'https://your-project.supabase.co/functions/v1/stripe-webhooks' \
  -H 'Content-Type: application/json' \
  -d '{"test": true}'

# Should return 400 (signature verification failed) - this is expected!
```

---

## 🎨 Customization

### Tier Configuration

Update tier mappings to match your business model:

```typescript
// In all function files
function getTierFromPriceId(priceId: string) {
  return {
    'price_YOUR_STARTER': {
      tier: 'starter',
      employeeLimit: 5,
      features: ['core', 'email_notifications']
    },
    'price_YOUR_PRO': {
      tier: 'professional',
      employeeLimit: 20,
      features: ['core', 'email_notifications', 'analytics', 'support']
    },
    'price_YOUR_ENTERPRISE': {
      tier: 'enterprise',
      employeeLimit: -1, // unlimited
      features: ['core', 'email', 'analytics', 'support', 'api', 'integrations']
    }
  }
}
```

### Database Schema

Ensure your `businesses` table has these fields:

```sql
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS employee_limit INTEGER DEFAULT 5;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS features_enabled TEXT[] DEFAULT ARRAY['core'];
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS subscription_current_period_start TIMESTAMPTZ;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ;
```

### Free Tier Defaults

Customize what happens when subscription is cancelled:

```typescript
// In stripe-webhooks/index.ts
async function handleSubscriptionDeleted(supabaseClient, event) {
  await supabaseClient
    .from('businesses')
    .update({
      subscription_tier: 'free',
      employee_limit: 5,           // Your free tier limit
      features_enabled: ['core'],   // Basic features only
      // ...
    })
}
```

---

## 📊 Database Requirements

### Required Tables

```sql
-- Subscription events audit trail (optional but recommended)
CREATE TABLE subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  event_type TEXT NOT NULL,
  stripe_subscription_id TEXT,
  stripe_payment_intent_id TEXT,
  subscription_tier TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_subscription_events_business ON subscription_events(business_id);
CREATE INDEX idx_subscription_events_type ON subscription_events(event_type);
```

---

## 🧪 Testing

### Test Payment Flow (Embedded)

```typescript
// 1. Create subscription intent
const response = await fetch('https://your-project.supabase.co/functions/v1/create-subscription-intent', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    businessId: 'business-uuid',
    tier: 'professional'
  })
})

const { clientSecret } = await response.json()

// 2. Use with Stripe Elements
const stripe = await loadStripe('pk_test_xxx')
const { error } = await stripe.confirmPayment({
  elements,
  clientSecret,
  confirmParams: {
    return_url: 'https://yourapp.com/subscription/success'
  }
})

// 3. Webhook will automatically update database
```

### Test Checkout Flow

```typescript
// 1. Create Stripe Checkout session (in your backend)
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{
    price: 'price_YOUR_PROFESSIONAL',
    quantity: 1,
  }],
  success_url: 'https://yourapp.com/subscription/success?session_id={CHECKOUT_SESSION_ID}',
  cancel_url: 'https://yourapp.com/subscription/cancelled',
  metadata: {
    business_id: 'business-uuid'
  }
})

// 2. Redirect user to session.url

// 3. On success page, verify session
const sessionId = new URLSearchParams(window.location.search).get('session_id')
await fetch('https://your-project.supabase.co/functions/v1/verify-stripe-session', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ sessionId, businessId })
})
```

### Test Webhooks Locally

```bash
# Install Stripe CLI
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhooks

# In another terminal, trigger test webhook
stripe trigger customer.subscription.created
```

### Test Tier Changes

```bash
# Upgrade
curl -X POST 'https://your-project.supabase.co/functions/v1/manage-subscription-tier' \
  -H 'Authorization: Bearer YOUR_USER_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"businessId":"business-uuid","targetTier":"enterprise"}'

# Downgrade (schedules for end of period)
curl -X POST 'https://your-project.supabase.co/functions/v1/manage-subscription-tier' \
  -H 'Authorization: Bearer YOUR_USER_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"businessId":"business-uuid","targetTier":"starter"}'

# Cancel (end of period)
curl -X POST 'https://your-project.supabase.co/functions/v1/manage-subscription-tier' \
  -H 'Authorization: Bearer YOUR_USER_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"businessId":"business-uuid","targetTier":"free"}'
```

---

## 🔐 Security

### Webhook Security

- **Always verify signatures**: Never disable signature verification
- **Use webhook secret**: Get from Stripe dashboard after creating endpoint
- **Service role for updates**: Webhooks bypass normal auth

### Payment Security

- **Never expose secret key**: Only use in Edge Functions
- **Validate user ownership**: Verify user owns the business before changes
- **Log all changes**: Use subscription_events table for audit trail

### Best Practices

1. **Test mode first**: Use `sk_test_` keys until ready for production
2. **Monitor webhook delivery**: Check Stripe dashboard for failed webhooks
3. **Handle idempotency**: Stripe may send duplicate webhooks
4. **Implement retry logic**: For failed webhook processing
5. **Validate price IDs**: Ensure they match your Stripe products

---

## 📈 Monitoring

### Key Metrics

- Subscription creation rate
- Upgrade/downgrade frequency
- Churn rate (cancellations)
- Payment failure rate
- Webhook delivery success rate

### Stripe Dashboard

Monitor in [Stripe Dashboard](https://dashboard.stripe.com):
- **Customers** - All customer records
- **Subscriptions** - Active/cancelled subscriptions
- **Webhooks** - Delivery success/failures
- **Payments** - Payment history
- **Disputes** - Chargebacks

### Database Queries

```sql
-- Active subscriptions by tier
SELECT subscription_tier, COUNT(*) 
FROM businesses 
WHERE subscription_status = 'active' 
GROUP BY subscription_tier;

-- Recent subscription events
SELECT * FROM subscription_events 
ORDER BY created_at DESC 
LIMIT 20;

-- Failed payments
SELECT * FROM subscription_events 
WHERE event_type = 'payment_failed' 
ORDER BY created_at DESC;
```

---

## 🐛 Troubleshooting

### Webhooks Not Working

1. **Check signature verification**: Review logs for signature errors
2. **Verify webhook secret**: `supabase secrets list`
3. **Check endpoint URL**: Must be publicly accessible
4. **Review Stripe dashboard**: Check webhook delivery attempts
5. **Test locally**: Use Stripe CLI to forward webhooks

### Database Not Updating

1. **Check webhook handler**: Review function logs
2. **Verify customer ID**: Must match between Stripe and database
3. **Check RLS policies**: Service role must have write access
4. **Review foreign keys**: Ensure business exists

### Payment Intent Errors

1. **Verify price IDs**: Must match Stripe products
2. **Check customer exists**: Customer must be created first
3. **Review Stripe logs**: Check for API errors
4. **Test card details**: Use [Stripe test cards](https://stripe.com/docs/testing)

### Tier Changes Not Working

1. **Check user authentication**: Must own the business
2. **Verify subscription exists**: Check stripe_subscription_id field
3. **Review proration settings**: Ensure configured correctly
4. **Check tier hierarchy**: Validate TIER_ORDER constant

---

## 💡 Tips

### Development

- **Use test mode**: Stripe provides separate test keys and products
- **Test cards**: Use `4242 4242 4242 4242` for successful payments
- **Webhook testing**: Use Stripe CLI for local development
- **Log everything**: Review function logs when debugging

### Production

- **Switch to live keys**: Update secrets with `sk_live_` keys
- **Monitor webhooks**: Set up alerts for failed deliveries
- **Handle edge cases**: Payment failures, duplicate webhooks, etc.
- **Implement grace periods**: Don't immediately disable features on payment failure

### Cost Optimization

- **Use annual billing**: Offer discounts for annual subscriptions
- **Minimize failed payments**: Send reminders before charges
- **Monitor usage**: Track API calls and optimize queries
- **Clean up old data**: Archive cancelled subscriptions

---

## 🔄 Migration Guide

### From Manual Billing

1. Create Stripe products/prices for each tier
2. Deploy subscription functions
3. Configure webhooks
4. Migrate existing customers to Stripe
5. Update billing UI to use new functions
6. Test thoroughly before switching live

### Testing Checklist

- [ ] Webhook endpoint responds to Stripe
- [ ] Signature verification working
- [ ] Database updates on subscription created
- [ ] Payment success updates status
- [ ] Payment failure handled correctly
- [ ] Upgrades work immediately
- [ ] Downgrades schedule correctly
- [ ] Cancellations retain access until period end
- [ ] Status check syncs properly
- [ ] Free tier defaults applied on cancel

---

## 🔗 Related Resources

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)

---

**Questions or issues?** Check Stripe webhook delivery logs and function logs for detailed error messages.
