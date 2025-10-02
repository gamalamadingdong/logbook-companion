# Edge Functions

Production-ready Supabase Edge Functions extracted from ScheduleBoard v2.

## 📦 What's Included

### Authentication & Invitations (5 functions)

| Function | Purpose | Status |
|----------|---------|--------|
| **create-invite** | Creates business invite codes | ✅ Complete |
| **process-invite** | Processes invite acceptance | ✅ Complete |
| **get-invite** | Retrieves invite details | ✅ Complete |
| **send-invite-email** | Sends invite emails via Resend | ✅ Complete |
| **delete-user-account** | GDPR-compliant account deletion | ✅ Complete |

[📖 Auth Functions Documentation](./auth/README.md)

### Notification System (3 functions)

| Function | Purpose | Status |
|----------|---------|--------|
| **notification-orchestrator** | Multi-channel notification routing | ✅ Complete |
| **send-notification-email** | Email delivery via Resend | ✅ Complete |
| **cleanup-notifications** | Automated notification cleanup | ✅ Complete |

[📖 Notification Functions Documentation](./notifications/README.md)

### Subscription System (5 functions)

| Function | Purpose | Status |
|----------|---------|--------|
| **stripe-webhooks** | Stripe webhook event processing | ✅ Complete |
| **create-subscription-intent** | Payment intent creation | ✅ Complete |
| **verify-stripe-session** | Checkout session verification | ✅ Complete |
| **check-subscription-status** | Status sync with Stripe | ✅ Complete |
| **manage-subscription-tier** | Tier upgrades/downgrades | ✅ Complete |

[📖 Subscription Functions Documentation](./subscriptions/README.md)

---

## 🚀 Quick Start

### 1. Prerequisites

- Supabase project with core schema applied (`infra/schema/core.sql`)
- Supabase CLI installed: `npm install -g supabase`
- Environment variables configured

### 2. Deploy Functions

```bash
# Deploy all auth functions
supabase functions deploy create-invite
supabase functions deploy process-invite
supabase functions deploy get-invite
supabase functions deploy send-invite-email
supabase functions deploy delete-user-account
```

### 3. Set Environment Variables

```bash
# Required for all functions
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set SUPABASE_ANON_KEY=your-anon-key

# Required for email functions
supabase secrets set RESEND_API_KEY=re_your_key

# Required for invite links
supabase secrets set SITE_URL=https://yourapp.com
supabase secrets set ALLOW_ORIGIN=https://yourapp.com
```

---

## 📚 Function Documentation

### **create-invite**

Creates invitation codes for users to join a business.

**Endpoint:** `POST /functions/v1/create-invite`

**Request Body:**
```typescript
{
  businessId: string;      // UUID of the business
  email: string;           // Email to send invite to
  role: string;            // Role to assign (owner, admin, manager, employee, viewer, user)
  inviterId: string;       // UUID of user creating the invite
  inviterName: string;     // Name of inviter (for email)
  businessName: string;    // Business name (for email)
}
```

**Response:**
```typescript
{
  success: true,
  inviteCode: string  // UUID invite code
}
```

**Customization Points:**
- Line 78: Default role assignment
- Line 92: Invite expiration period (default 7 days)
- Line 131-145: Email template HTML
- Line 151: Sender email domain

---

### **process-invite**

Processes an invitation code to add a user to a business.

**Endpoint:** `POST /functions/v1/process-invite`

**Request Body:**
```typescript
{
  inviteCode: string;      // The invitation code
  
  // For new users (creates account):
  createUser?: boolean;     // Set true to create new user
  email?: string;           // Email for new account
  password?: string;        // Password for new account
  firstName?: string;       // User's first name
  lastName?: string;        // User's last name
}
```

**Response:**
```typescript
{
  success: true,
  businessId: string,
  businessName: string,
  role: string,
  userId: string,
  userCreated: boolean,     // True if new user was created
  alreadyMember?: boolean   // True if user already had access
}
```

**Flows:**
1. **New User:** Set `createUser=true` → Creates user account + adds to business
2. **Existing User:** Authenticate with token → Adds authenticated user to business

**Customization Points:**
- Line 111: Valid roles array
- Line 145: Profile fields
- Line 172+: Custom onboarding logic (add your domain models)

---

### **get-invite**

Retrieves invitation details for preview before acceptance.

**Endpoint:** `POST /functions/v1/get-invite`

**Request Body:**
```typescript
{
  inviteCode: string  // The invitation code to lookup
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    id: string,
    business_id: string,
    role: string,
    email: string,
    invite_code: string,
    expires_at: string,
    businesses: {
      id: string,
      name: string,
      display_name: string
    },
    additional_data?: any  // Your custom data
  }
}
```

**Customization Points:**
- Line 61: Add additional business fields to select
- Line 75: Add custom validation logic
- Line 79-88: Add lookup for your team members table (optional)

---

### **send-invite-email**

Sends invitation emails via Resend.

**Endpoint:** `POST /functions/v1/send-invite-email`

**Request Body:**
```typescript
{
  email: string;           // Recipient email
  role: string;            // Role they're being invited as
  businessName: string;    // Business name
  inviteCode: string;      // Invite code for the link
  inviterName: string;     // Who is inviting them
}
```

**Response:**
```typescript
{
  id: string,              // Resend email ID
  from: string,
  to: string[],
  created_at: string
}
```

**Customization Points:**
- Line 78: SITE_URL for invite links
- Line 82-110: Email template HTML
- Line 97: Sender email domain (must be verified in Resend)
- Line 98: Email subject line
- Add your logo/branding

---

### **delete-user-account**

GDPR-compliant user account deletion with business cleanup.

**Endpoint:** `POST /functions/v1/delete-user-account`

**Headers:**
```
Authorization: Bearer <user-jwt-token>
```

**Request Body:**
```typescript
{
  confirmationText: "DELETE MY ACCOUNT"  // Exact text required
}
```

**Response:**
```typescript
{
  success: true,
  message: "Account deleted successfully",
  user_id: string,
  was_owner: boolean,
  businesses_affected: string[]  // IDs of businesses that were deleted
}
```

**Behavior:**
- If user is the **last owner** of a business → Deletes entire business and all data
- If user is **not the last owner** → Removes user but preserves business
- Anonymizes profile (keeps record for audit trail)
- Deletes all user-generated content

**Customization Points:**
- Line 42: Confirmation text
- Line 156+: Add your business-specific tables to deletion
- Line 220: Choose anonymization vs complete deletion strategy

---

## 🔧 Customization Guide

### 1. Update Email Templates

All email functions have customizable HTML templates:

```typescript
// In send-invite-email/index.ts or create-invite/index.ts
const html = `
  <div style="font-family: Arial, sans-serif;">
    <!-- Your custom HTML here -->
    <!-- Add your logo -->
    <!-- Customize colors, fonts, layout -->
  </div>
`;
```

### 2. Add Custom Profile Fields

```typescript
// In process-invite/index.ts, line 145
const { error: profileError } = await supabaseAdmin
  .from('profiles')
  .upsert({
    id: userId,
    display_name: `${firstName} ${lastName}`.trim(),
    email: email,
    first_name: firstName,
    last_name: lastName,
    
    // TODO: Add your custom fields
    department: null,
    job_title: null,
    bio: null,
  }, { onConflict: 'id' })
```

### 3. Add Custom Onboarding Logic

```typescript
// In process-invite/index.ts, after line 172
// Example: Create a team member record
await supabaseAdmin.from('team_members').insert({
  user_id: userId,
  business_id: invite.business_id,
  role: canonicalRole,
  status: 'active',
  joined_at: new Date().toISOString()
});

// Example: Send welcome notification
await supabaseAdmin.from('notifications').insert({
  user_id: userId,
  business_id: invite.business_id,
  type: 'welcome',
  title: 'Welcome to the team!',
  message: `You've been added as a ${canonicalRole}.`
});
```

### 4. Customize Roles

Update the valid roles array in process-invite:

```typescript
// Line 111
const validRoles = [
  'owner',
  'admin',
  'manager',
  'contractor',  // Add custom role
  'employee',
  'viewer',
  'user'
];
```

Make sure your database schema's `app_role` enum includes these roles.

### 5. Add Business-Specific Deletion Logic

```typescript
// In delete-user-account/index.ts, after line 156
// Add your custom tables
await supabaseAdmin.from('your_projects').delete().eq('business_id', businessId);
await supabaseAdmin.from('your_tasks').delete().eq('business_id', businessId);
await supabaseAdmin.from('your_appointments').delete().eq('business_id', businessId);
```

---

## 🧪 Testing

### Test create-invite

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/create-invite' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "businessId": "your-business-uuid",
    "email": "newuser@example.com",
    "role": "employee",
    "inviterId": "your-user-uuid",
    "inviterName": "John Doe",
    "businessName": "Acme Inc"
  }'
```

### Test get-invite

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/get-invite' \
  -H 'Content-Type: application/json' \
  -d '{
    "inviteCode": "the-invite-code-from-create"
  }'
```

### Test process-invite (new user)

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/process-invite' \
  -H 'Content-Type: application/json' \
  -d '{
    "inviteCode": "the-invite-code",
    "createUser": true,
    "email": "newuser@example.com",
    "password": "securepassword123",
    "firstName": "Jane",
    "lastName": "Smith"
  }'
```

---

## ⚠️ Common Issues

### Email Sending Fails

**Problem:** Invite creation fails with "Email send failed"

**Solutions:**
1. Verify RESEND_API_KEY is set correctly
2. Verify sender domain in Resend dashboard
3. Check sender email matches verified domain
4. Review Resend API logs for detailed errors

### Invite Not Found

**Problem:** get-invite returns 404

**Causes:**
- Invite code is incorrect
- Invite has expired (>7 days old)
- Invite status is not 'pending' (already used)

### User Already Has Access

**Problem:** process-invite returns `alreadyMember: true`

**This is expected behavior** when a user already has an active role in the business. The function gracefully handles this case.

### Account Deletion Fails

**Problem:** delete-user-account returns 500 error

**Solutions:**
1. Check that foreign key relationships are properly configured
2. Review console logs for specific table deletion errors
3. Ensure RLS policies don't block service role operations
4. Add missing tables to deletion logic

---

## 📖 Complete User Flow Example

### 1. Admin Creates Invite

```typescript
const { data } = await supabase.functions.invoke('create-invite', {
  body: {
    businessId: currentBusiness.id,
    email: 'newemployee@example.com',
    role: 'employee',
    inviterId: currentUser.id,
    inviterName: `${currentUser.first_name} ${currentUser.last_name}`,
    businessName: currentBusiness.name
  }
});

// Email automatically sent if Resend is configured
console.log('Invite created:', data.inviteCode);
```

### 2. New User Receives Email & Clicks Link

Browser navigates to: `https://yourapp.com/accept-invite?invite=abc-123-def`

### 3. UI Previews Invite

```typescript
const { data } = await supabase.functions.invoke('get-invite', {
  body: { inviteCode: 'abc-123-def' }
});

// Show UI: "John Doe invited you to join Acme Inc as Employee"
```

### 4. User Accepts & Creates Account

```typescript
const { data } = await supabase.functions.invoke('process-invite', {
  body: {
    inviteCode: 'abc-123-def',
    createUser: true,
    email: 'newemployee@example.com',
    password: userPassword,
    firstName: 'Jane',
    lastName: 'Smith'
  }
});

// User now has account and access to business
// Redirect to app dashboard
```

### 5. User Can Delete Account Later

```typescript
const { data } = await supabase.functions.invoke('delete-user-account', {
  headers: {
    Authorization: `Bearer ${session.access_token}`
  },
  body: {
    confirmationText: 'DELETE MY ACCOUNT'
  }
});

// All user data removed or anonymized
```

---

## 🔐 Security Considerations

### Service Role Key

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client
- Only use in Edge Functions server-side
- Functions use service role to bypass RLS when needed

### Email Validation

- All email functions validate and sanitize email addresses
- Prevents email injection attacks
- Uses RFC5322 validation

### Authentication

- delete-user-account requires valid JWT token
- Verifies user identity before deletion
- Uses confirmation text to prevent accidents

### Rate Limiting

- Supabase Edge Functions have built-in rate limiting
- process-invite with `createUser=true` bypasses client rate limits
- Monitor function invocations in Supabase dashboard

---

## 📊 Monitoring & Logs

### View Function Logs

```bash
# View logs in real-time
supabase functions logs create-invite --tail

# View specific time range
supabase functions logs process-invite --since=1h
```

### Dashboard Monitoring

1. Go to Supabase Dashboard → Edge Functions
2. Click on function name
3. View invocations, errors, and performance metrics

### Common Log Messages

```
✅ "Invitation email sent successfully"
✅ "User created: <user-id>"
✅ "Invite processed successfully"
⚠️ "User already has access to this business"
❌ "Invalid or expired invite"
❌ "Email send failed"
```

---

## 🚀 Next Steps

1. **Deploy these functions** to your Supabase project
2. **Test the complete flow** with a test business and user
3. **Customize email templates** with your branding
4. **Add custom onboarding logic** for your domain
5. **Extract notification functions** (coming in next phase)

---

**Extracted From:** ScheduleBoard v2  
**Status:** ✅ Production-ready  
**Dependencies:** Core schema (`infra/schema/core.sql`)  
**Optional:** Resend API key for email sending
