# Edge Functions - Extraction Analysis

Based on the ScheduleBoard v2 Supabase functions directory, here's the analysis of what should be extracted for the SGE template.

## ✅ Core Functions to Extract (Essential for Template)

### Authentication & User Management

#### **create-invite** ✅ EXTRACT
- **Purpose**: Creates business invitation codes
- **Why**: Core multi-tenant onboarding
- **Customization**: None needed - generic invite system
- **Priority**: HIGH

#### **process-invite** ✅ EXTRACT
- **Purpose**: Processes invitation acceptance and adds user to business
- **Why**: Completes the onboarding flow
- **Customization**: None needed
- **Priority**: HIGH

#### **get-invite** ✅ EXTRACT
- **Purpose**: Retrieves invitation details by code
- **Why**: Needed for invite preview before acceptance
- **Customization**: None needed
- **Priority**: HIGH

#### **send-invite-email** ✅ EXTRACT
- **Purpose**: Sends invitation email via Resend
- **Why**: Email delivery for invitations
- **Customization**: Update email template and sender domain
- **Priority**: HIGH

#### **delete-user-account** ✅ EXTRACT
- **Purpose**: GDPR-compliant account deletion
- **Why**: Legal requirement for data privacy
- **Customization**: None needed
- **Priority**: HIGH

---

### Subscription Management (Stripe)

#### **create-subscription-intent** ✅ EXTRACT
- **Purpose**: Creates Stripe PaymentIntent for subscription
- **Why**: Core monetization functionality
- **Customization**: Update Stripe product/price IDs
- **Priority**: HIGH (if monetizing)

#### **stripe-webhooks** ✅ EXTRACT
- **Purpose**: Handles Stripe webhook events (payment, subscription changes)
- **Why**: Keeps subscription status in sync
- **Customization**: Update webhook secret
- **Priority**: HIGH (if monetizing)

#### **verify-stripe-session** ✅ EXTRACT
- **Purpose**: Verifies Stripe checkout session completion
- **Why**: Confirms successful subscription signup
- **Customization**: None needed
- **Priority**: HIGH (if monetizing)

#### **check-subscription-status** ✅ EXTRACT
- **Purpose**: Validates current subscription status
- **Why**: Feature gating and access control
- **Customization**: Update tier-based logic
- **Priority**: MEDIUM

#### **manage-subscription-tier** ✅ EXTRACT
- **Purpose**: Handles subscription upgrades/downgrades
- **Why**: Allows tier changes
- **Customization**: Update tier logic
- **Priority**: MEDIUM

#### **confirm-subscription** ⚠️ EXTRACT (Simplify)
- **Purpose**: Confirms subscription after payment
- **Why**: Payment confirmation flow
- **Customization**: Simplify for template
- **Priority**: MEDIUM

---

### Notification System

#### **notification-orchestrator** ✅ EXTRACT
- **Purpose**: Central notification router (email, SMS, push)
- **Why**: Core notification infrastructure
- **Customization**: Update channels and providers
- **Priority**: HIGH

#### **send-notification-email** ✅ EXTRACT
- **Purpose**: Sends notification emails via Resend
- **Why**: Email channel implementation
- **Customization**: Update email templates
- **Priority**: HIGH

#### **send-push-notification** ✅ EXTRACT
- **Purpose**: Sends push notifications to mobile devices
- **Why**: Mobile notification channel
- **Customization**: Update FCM/APNS credentials
- **Priority**: MEDIUM

#### **send-sms-notification** ⚠️ EXTRACT (Optional)
- **Purpose**: Sends SMS notifications via Twilio
- **Why**: SMS channel (optional)
- **Customization**: Update Twilio credentials
- **Priority**: LOW (make optional via CLI)

#### **cleanup-notifications** ✅ EXTRACT
- **Purpose**: Removes old/expired notifications
- **Why**: Database maintenance
- **Customization**: Adjust retention period
- **Priority**: MEDIUM

---

### Admin & Utilities

#### **debug-user-roles** ✅ EXTRACT (Rename: get-user-roles)
- **Purpose**: Gets user's business roles
- **Why**: Useful for admin panels and debugging
- **Customization**: None needed
- **Priority**: MEDIUM

#### **debug-business-settings** ⚠️ SKIP (Too specific)
- **Purpose**: ScheduleBoard-specific debugging
- **Why**: Not generic enough
- **Priority**: N/A

---

## ❌ ScheduleBoard-Specific Functions (DO NOT EXTRACT)

### Business Logic (Not Template Material)

#### **automated-daily-schedule** ❌ SKIP
- **Reason**: ScheduleBoard-specific job scheduling
- **Alternative**: Document pattern for scheduled jobs

#### **send-daily-schedule** ❌ SKIP
- **Reason**: ScheduleBoard-specific feature
- **Alternative**: Example of scheduled notifications

#### **test-daily-automation** ❌ SKIP
- **Reason**: ScheduleBoard testing function

#### **automated-status-updates** ❌ SKIP
- **Reason**: Job status logic specific to ScheduleBoard

#### **test-status-updates** ❌ SKIP
- **Reason**: ScheduleBoard testing function

#### **convert-bid-to-job** ❌ SKIP
- **Reason**: ScheduleBoard-specific business logic

#### **test-timezone-logic** ❌ SKIP
- **Reason**: ScheduleBoard-specific testing

---

### Admin Functions (Too Specific)

#### **admin-upgrade-business** ❌ SKIP
- **Reason**: Internal admin tool, too specific
- **Alternative**: Document pattern for admin operations

#### **debug-email-delivery** ⚠️ DOCUMENT PATTERN
- **Reason**: Useful pattern but too specific
- **Alternative**: Create generic email debugging function

---

### Testing/Deprecated

#### **test-webhook** ❌ SKIP
- **Reason**: Testing function

#### **cleanup-subscriptions** ⚠️ REVIEW
- **Reason**: Might be useful for maintenance
- **Decision**: Extract if it's cleanup logic, skip if ScheduleBoard-specific

#### **subscription-management** ⚠️ REVIEW
- **Reason**: Might overlap with other functions
- **Decision**: Review and merge with existing subscription functions

#### **stripe-webhooks-public** ❌ SKIP
- **Reason**: Likely deprecated or duplicate

#### **sms-delivery-status** ⚠️ OPTIONAL
- **Reason**: Twilio callback handler
- **Decision**: Extract if SMS is included

---

## 📦 Extraction Summary

### Essential (Extract Immediately)
1. ✅ `create-invite`
2. ✅ `process-invite`
3. ✅ `get-invite`
4. ✅ `send-invite-email`
5. ✅ `delete-user-account`
6. ✅ `notification-orchestrator`
7. ✅ `send-notification-email`

### Monetization (Extract if Using Stripe)
8. ✅ `create-subscription-intent`
9. ✅ `stripe-webhooks`
10. ✅ `verify-stripe-session`
11. ✅ `check-subscription-status`
12. ✅ `manage-subscription-tier`

### Optional (Extract as Modules)
13. ⚠️ `send-push-notification` (mobile module)
14. ⚠️ `send-sms-notification` (SMS module)
15. ✅ `cleanup-notifications` (maintenance)

### Utility
16. ✅ `debug-user-roles` → rename to `get-user-roles`

---

## 🎯 Extraction Strategy

### Phase 1: Core Auth & Invites (Week 3)
- Extract invitation system (create, process, get, send-email)
- Extract account deletion
- Test invitation flow end-to-end

### Phase 2: Notifications (Week 3)
- Extract notification-orchestrator
- Extract email notification sender
- Extract cleanup function

### Phase 3: Stripe Integration (Week 3-4)
- Extract subscription functions
- Extract webhook handler
- Document Stripe setup

### Phase 4: Optional Modules (Week 4)
- Package push notifications as optional
- Package SMS as optional
- Create CLI flags for including these

---

## 📝 Template Organization

```
packages/functions/
├── auth/
│   ├── create-invite/
│   ├── process-invite/
│   ├── get-invite/
│   ├── send-invite-email/
│   └── delete-user-account/
│
├── subscriptions/  (optional via CLI)
│   ├── create-subscription-intent/
│   ├── stripe-webhooks/
│   ├── verify-stripe-session/
│   ├── check-subscription-status/
│   └── manage-subscription-tier/
│
├── notifications/
│   ├── notification-orchestrator/
│   ├── send-notification-email/
│   ├── send-push-notification/  (optional)
│   ├── send-sms-notification/   (optional)
│   └── cleanup-notifications/
│
└── utils/
    └── get-user-roles/
```

---

## 🔧 Customization Per Function

### High Customization
- `send-invite-email` - Email templates, sender domain
- `send-notification-email` - Email templates
- `stripe-webhooks` - Webhook secret, product IDs
- `create-subscription-intent` - Pricing tiers

### Medium Customization
- `notification-orchestrator` - Notification channels
- `manage-subscription-tier` - Tier-specific features

### Low Customization (Copy as-is)
- `create-invite` - Generic invite creation
- `process-invite` - Generic invite processing
- `get-invite` - Generic invite retrieval
- `delete-user-account` - GDPR compliance

---

## ✅ Next Actions

1. **Extract auth functions first** (highest priority, least customization)
2. **Extract notification system** (moderate priority, medium customization)
3. **Extract Stripe functions** (conditional on monetization)
4. **Package optional modules** (SMS, push) with CLI flags
5. **Document environment variables** required for each function
6. **Create setup guides** for Resend, Stripe, Twilio, FCM

---

## 📊 Function Count

- **Total ScheduleBoard Functions**: 32
- **Extract as Core**: 7 functions
- **Extract if Monetizing**: 5 functions
- **Extract as Optional**: 3 functions
- **Total Template Functions**: 15 functions (47% extraction rate)
- **Skip (Business-Specific)**: 17 functions (53%)

This is exactly the right approach - **extract infrastructure, skip business logic**.
