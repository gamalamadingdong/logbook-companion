# Notification Functions

Complete multi-channel notification system with email delivery, orchestration, and cleanup capabilities.

## 🎯 Overview

This package provides three Edge Functions that work together to deliver notifications across multiple channels (email, push, SMS, in-app) with user preference management and quiet hours support.

## 📦 Functions

### 1. notification-orchestrator

**Purpose**: Routes notifications to appropriate channels based on priority and user preferences.

**Endpoint**: `POST /functions/v1/notification-orchestrator`

**Request**:
```json
{
  "type": "task-assigned",
  "recipients": ["user-id-1", "user-id-2"],
  "businessId": "business-uuid",
  "priority": 2,
  "data": {
    "taskTitle": "Fix HVAC System",
    "customerName": "John Doe",
    "dueDate": "2025-10-15"
  }
}
```

**Response**:
```json
{
  "success": true,
  "results": [
    {
      "userId": "user-id-1",
      "notificationId": "notification-uuid",
      "channels": ["in-app", "email"]
    }
  ]
}
```

**Features**:
- Multi-channel routing (email, push, SMS, in-app)
- Respects user notification preferences
- Quiet hours support with automatic rescheduling
- Priority-based channel selection
- Batch processing for multiple recipients

---

### 2. send-notification-email

**Purpose**: Sends notification emails via Resend with customizable templates.

**Endpoint**: `POST /functions/v1/send-notification-email`

**Request**:
```json
{
  "notificationId": "notification-uuid",
  "userId": "user-uuid",
  "businessId": "business-uuid",
  "data": {
    "taskTitle": "Fix HVAC System",
    "taskUrl": "https://yourapp.com/tasks/123"
  }
}
```

**Response**:
```json
{
  "success": true,
  "messageId": "resend-message-id",
  "recipient": "user@example.com"
}
```

**Features**:
- Resend API integration
- Customizable HTML templates per notification type
- Automatic delivery status tracking
- Fallback text versions
- Email tagging for analytics

---

### 3. cleanup-notifications

**Purpose**: Removes old or cancelled notifications and delivery records.

**Endpoint**: `POST /functions/v1/cleanup-notifications`

**Request** (by age):
```json
{
  "businessId": "business-uuid",
  "olderThanDays": 90
}
```

**Request** (by resource):
```json
{
  "businessId": "business-uuid",
  "resourceId": "task-uuid"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Cleaned up 45 notifications",
  "results": {
    "notifications": 45,
    "deliveries": 120,
    "history": 45
  }
}
```

**Features**:
- Age-based cleanup
- Resource-based cleanup
- Cascade deletion of related records
- Can be scheduled via pg_cron

---

## 🚀 Deployment

### 1. Deploy Functions

```bash
cd packages/functions/notifications

# Deploy all notification functions
supabase functions deploy orchestrator --no-verify-jwt
supabase functions deploy send-email --no-verify-jwt
supabase functions deploy cleanup --no-verify-jwt
```

### 2. Set Environment Variables

```bash
# Required for all functions
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Required for email function
supabase secrets set RESEND_API_KEY=re_your_api_key

# Optional: CORS configuration
supabase secrets set ALLOW_ORIGIN=https://yourapp.com
```

### 3. Verify Deployment

```bash
# Test orchestrator
curl -X POST 'https://your-project.supabase.co/functions/v1/notification-orchestrator' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"type":"task-assigned","recipients":["user-id"],"businessId":"business-id","priority":2,"data":{"taskTitle":"Test"}}'
```

---

## 🎨 Customization

### Notification Types

Update `NotificationType` enum in `orchestrator/index.ts`:

```typescript
export enum NotificationType {
  // Your custom types
  ORDER_PLACED = 'order-placed',
  APPOINTMENT_REMINDER = 'appointment-reminder',
  INVOICE_DUE = 'invoice-due',
  // ... add your domain-specific types
}
```

### Email Templates

Customize templates in `send-email/index.ts`:

```typescript
function generateEmailContent(notification, userProfile, business, data) {
  // Add your custom notification types
  switch (notification.type) {
    case 'order-placed':
      return {
        subject: `New Order #${data.orderNumber}`,
        html: `<h1>Your order is confirmed!</h1>...`,
        text: `Your order #${data.orderNumber} is confirmed...`
      }
    // ... more types
  }
}
```

### Channel Selection Logic

Customize in `orchestrator/index.ts`:

```typescript
function determineChannels(priority, preferences) {
  const channels = []
  
  // Your custom logic
  if (priority >= NotificationPriority.HIGH) {
    channels.push('email', 'push')
  }
  
  // Add SMS for critical notifications
  if (priority === NotificationPriority.CRITICAL && preferences.sms_enabled) {
    channels.push('sms')
  }
  
  return channels
}
```

### Sender Domain

Update in `send-email/index.ts` (line 75):

```typescript
from: `${businessName} <notifications@yourdomain.com>`
```

**Important**: Domain must be verified in Resend dashboard.

---

## 📊 Database Requirements

### Tables Needed

```sql
-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  business_id UUID NOT NULL REFERENCES businesses(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL,
  metadata JSONB,
  read BOOLEAN DEFAULT false,
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Delivery tracking
CREATE TABLE notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_id TEXT,
  error_message TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User preferences
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  business_id UUID NOT NULL REFERENCES businesses(id),
  notification_type TEXT NOT NULL,
  in_app_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  timezone TEXT DEFAULT 'UTC',
  UNIQUE(user_id, business_id, notification_type)
);

-- Optional: History tracking
CREATE TABLE notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 🧪 Testing

### Test Orchestrator

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/notification-orchestrator' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "task-assigned",
    "recipients": ["'$USER_ID'"],
    "businessId": "'$BUSINESS_ID'",
    "priority": 2,
    "data": {
      "taskTitle": "Test Notification",
      "taskUrl": "https://app.com/tasks/1"
    }
  }'
```

### Test Email Delivery

```bash
# Check notification was created
psql -c "SELECT * FROM notifications ORDER BY created_at DESC LIMIT 1;"

# Check delivery status
psql -c "SELECT * FROM notification_deliveries WHERE channel = 'email' ORDER BY created_at DESC LIMIT 1;"
```

### Test Cleanup

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/cleanup-notifications' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "businessId": "'$BUSINESS_ID'",
    "olderThanDays": 90
  }'
```

---

## 🤖 Automated Cleanup

Schedule cleanup via pg_cron:

```sql
-- Add to supabase/migrations/cron.sql
SELECT cron.schedule(
  'cleanup-old-notifications',
  '0 2 * * *', -- 2 AM daily
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/cleanup-notifications',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_KEY"}'::jsonb,
    body := '{"olderThanDays": 90}'::jsonb
  );
  $$
);
```

---

## 🔐 Security

### Service Role Usage

- **Orchestrator**: Uses service role to bypass RLS for notification creation
- **Email**: Uses service role to access user profiles and business data
- **Cleanup**: Uses service role for bulk deletion

### Best Practices

1. **Never expose service role key** in client-side code
2. **Validate user permissions** before sending notifications
3. **Rate limit** notification creation to prevent spam
4. **Sanitize email content** to prevent XSS
5. **Verify email addresses** before sending

---

## 📈 Monitoring

### Key Metrics

- Notification creation rate
- Delivery success rate by channel
- Average delivery time
- Failed delivery reasons
- User preference changes

### Resend Dashboard

Monitor email delivery in Resend dashboard:
- Open rates
- Click rates
- Bounce rates
- Spam complaints

---

## 🐛 Troubleshooting

### Emails Not Sending

1. **Check Resend API key**: `supabase secrets list`
2. **Verify sender domain**: Must be verified in Resend
3. **Check logs**: `supabase functions logs send-email`
4. **Test Resend directly**: Use Resend dashboard

### Notifications Not Created

1. **Check orchestrator logs**: `supabase functions logs orchestrator`
2. **Verify user IDs exist**: Query profiles table
3. **Check RLS policies**: Ensure service role can write
4. **Validate JSON payload**: Use proper types

### Cleanup Not Working

1. **Check business ID**: Must exist in businesses table
2. **Verify service role key**: Required for deletion
3. **Check foreign key constraints**: Ensure cascade deletion set up
4. **Review logs**: `supabase functions logs cleanup`

---

## 💡 Tips

### Performance

- **Batch notifications** for multiple users
- **Use scheduled_for** to defer non-urgent notifications
- **Implement retry logic** for failed deliveries
- **Archive old notifications** instead of deleting for audit

### User Experience

- **Allow granular preferences** per notification type
- **Respect quiet hours** for non-critical notifications
- **Provide unsubscribe options** in emails
- **Group related notifications** to reduce noise

### Cost Optimization

- **Use in-app for low priority** notifications
- **Batch emails** when possible (Resend supports batch)
- **Clean up old data** regularly
- **Monitor delivery failures** to avoid wasted API calls

---

## 🔗 Related Resources

- [Resend Documentation](https://resend.com/docs)
- [Supabase Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [pg_cron Documentation](https://github.com/citusdata/pg_cron)

---

**Questions or issues?** Check the troubleshooting guide or review function logs for detailed error messages.
