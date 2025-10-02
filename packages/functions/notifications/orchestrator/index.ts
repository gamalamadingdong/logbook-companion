/**
 * NOTIFICATION ORCHESTRATOR
 * 
 * PURPOSE:
 * Multi-channel notification routing system that handles all notification types
 * across email, in-app, push, and SMS channels. Respects user preferences, quiet
 * hours, and priority levels.
 * 
 * USAGE:
 * POST https://your-project.supabase.co/functions/v1/notification-orchestrator
 * Authorization: Bearer <anon_key>
 * 
 * Body:
 * {
 *   "type": "job-assigned",
 *   "recipients": ["user-id-1", "user-id-2"],
 *   "businessId": "business-uuid",
 *   "priority": 2,
 *   "data": {
 *     "jobId": "job-uuid",
 *     "jobTitle": "Fix HVAC System",
 *     "customerName": "John Doe"
 *   }
 * }
 * 
 * CUSTOMIZATION POINTS:
 * - Line 40-60: Add/remove notification types for your domain
 * - Line 190-220: Customize channel selection logic
 * - Line 240-270: Add custom notification templates
 * - Line 320-350: Implement domain-specific message generation
 * 
 * DEPENDENCIES:
 * - Supabase tables: notifications, notification_preferences, notification_deliveries
 * - Optional: send-notification-email function for email delivery
 * - Optional: push notification service integration
 * - Optional: SMS service integration (Twilio, AWS SNS, etc.)
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// TODO: Customize notification types for your application
// These are generic types - adapt to your domain (e.g., appointments, tasks, orders)
export enum NotificationType {
  // Work-related
  TASK_ASSIGNED = 'task-assigned',
  TASK_COMPLETED = 'task-completed',
  TASK_CANCELLED = 'task-cancelled',
  TASK_RESCHEDULED = 'task-rescheduled',
  
  // Schedule-related
  SCHEDULE_UPDATED = 'schedule-updated',
  REMINDER = 'reminder',
  
  // Business-related
  BUSINESS_INVITATION = 'business-invitation',
  USER_JOINED = 'user-joined',
  SUBSCRIPTION_EXPIRING = 'subscription-expiring',
  PAYMENT_FAILED = 'payment-failed',
  
  // System
  SYSTEM_MAINTENANCE = 'system-maintenance',
  SECURITY_ALERT = 'security-alert'
}

export enum NotificationPriority {
  LOW = 1,      // In-app only
  NORMAL = 2,   // In-app + email
  HIGH = 3,     // In-app + email + push
  URGENT = 4,   // All channels
  CRITICAL = 5  // All channels + immediate delivery
}

interface NotificationEvent {
  type: any // Accept both enum and string values
  recipients: string[] // user IDs
  businessId: string
  priority: any
  data: Record<string, any>
  scheduledFor?: string
  resourceId?: string // Generic: could be jobId, taskId, orderId, etc.
}

interface NotificationPreference {
  in_app_enabled: boolean
  email_enabled: boolean
  sms_enabled: boolean
  push_enabled: boolean
  quiet_hours_start?: string
  quiet_hours_end?: string
  timezone: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const event: NotificationEvent = await req.json()
    
    console.log('Processing notification event:', event.type)
    
    const results = []
    
    for (const userId of event.recipients) {
      try {
        // Get user preferences
        const preferences = await getUserPreferences(supabase, userId, event.businessId, event.type)
        
        // Check quiet hours
        let scheduledFor = event.scheduledFor
        if (isInQuietHours(preferences)) {
          console.log(`User ${userId} is in quiet hours, scheduling for later`)
          scheduledFor = calculateNextActiveTime(preferences)
        }
        
        // Create notification record
        const notification = await createNotificationRecord(supabase, event, userId, scheduledFor)
        
        // Determine delivery channels
        const channels = determineChannels(event.priority, preferences)
        
        // Queue delivery for each channel
        for (const channel of channels) {
          await queueDelivery(supabase, notification.id, channel, event.data, userId, event.businessId)
        }
        
        results.push({ userId, notificationId: notification.id, channels })
      } catch (userError) {
        console.error(`Error processing notification for user ${userId}:`, userError)
        results.push({ userId, error: userError.message })
      }
    }
    
    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error processing notification:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function getUserPreferences(
  supabase: any, 
  userId: string, 
  businessId: string, 
  type: string
): Promise<NotificationPreference> {
  try {
    const dbType = mapNotificationTypeForDb(type)
    
    const { data } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .eq('notification_type', dbType)
      .single()

    // Return user preferences or safe defaults
    return data || {
      in_app_enabled: true,
      email_enabled: true,
      sms_enabled: false, // Default SMS off (requires phone number)
      push_enabled: true,
      timezone: 'UTC'
    }
  } catch (error) {
    console.error('Error fetching user preferences:', error)
    // Return safe defaults
    return {
      in_app_enabled: true,
      email_enabled: true,
      sms_enabled: false,
      push_enabled: true,
      timezone: 'UTC'
    }
  }
}

function isInQuietHours(preferences: NotificationPreference): boolean {
  if (!preferences.quiet_hours_start || !preferences.quiet_hours_end) {
    return false
  }

  const now = new Date()
  const timezone = preferences.timezone || 'UTC'
  
  const currentTime = now.toLocaleTimeString('en-US', { 
    timeZone: timezone, 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  })
  
  return currentTime >= preferences.quiet_hours_start && currentTime <= preferences.quiet_hours_end
}

function calculateNextActiveTime(preferences: NotificationPreference): string {
  // Simple implementation - schedule for end of quiet hours
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0) // Default to 9 AM next day
  return tomorrow.toISOString()
}

async function createNotificationRecord(
  supabase: any, 
  event: NotificationEvent, 
  userId: string, 
  scheduledFor?: string
) {
  const dbType = mapNotificationTypeForDb(event.type)

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      business_id: event.businessId,
      type: dbType,
      title: generateTitle(event.type, event.data),
      message: generateMessage(event.type, event.data),
      priority: mapPriorityForDb(event.priority),
      metadata: event.data,
      scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating notification record:', error)
    throw error
  }

  return data
}

// TODO: Map your custom notification types to database-allowed types
// Update this based on your notification_type enum in the database
function mapNotificationTypeForDb(type: any): string {
  const typeStr = typeof type === 'string' ? type : String(type)
  
  switch (typeStr) {
    // Task/work notifications
    case 'task-assigned':
    case 'task-completed':
    case 'task-cancelled':
    case NotificationType.TASK_ASSIGNED:
    case NotificationType.TASK_COMPLETED:
    case NotificationType.TASK_CANCELLED:
      return 'task_update' // TODO: Use your enum value
    
    // Schedule notifications
    case 'schedule-updated':
    case 'reminder':
    case NotificationType.SCHEDULE_UPDATED:
    case NotificationType.REMINDER:
      return 'schedule_change' // TODO: Use your enum value
    
    // System notifications
    case 'system-maintenance':
    case 'security-alert':
    case 'subscription-expiring':
    case 'payment-failed':
    case NotificationType.SYSTEM_MAINTENANCE:
    case NotificationType.SECURITY_ALERT:
    case NotificationType.SUBSCRIPTION_EXPIRING:
    case NotificationType.PAYMENT_FAILED:
      return 'system' // TODO: Use your enum value
    
    default:
      return 'system'
  }
}

function mapPriorityForDb(priority: any): string {
  switch (priority) {
    case NotificationPriority.LOW:
    case 1:
      return 'low'
    case NotificationPriority.NORMAL:
    case 2:
      return 'normal'
    case NotificationPriority.HIGH:
    case 3:
    case NotificationPriority.URGENT:
    case 4:
      return 'high'
    case NotificationPriority.CRITICAL:
    case 5:
      return 'urgent'
    default:
      return 'normal'
  }
}

// TODO: Customize channel selection based on your business logic
function determineChannels(priority: any, preferences: NotificationPreference): string[] {
  const channels: string[] = []
  
  // In-app notifications (always enabled for active users)
  if (preferences.in_app_enabled) {
    channels.push('in-app')
  }
  
  // Email notifications
  if (preferences.email_enabled) {
    channels.push('email')
  }
  
  // Push notifications for normal+ priority
  if (priority >= NotificationPriority.NORMAL && preferences.push_enabled) {
    channels.push('push')
  }
  
  // SMS for high+ priority (requires phone number and SMS service setup)
  if (priority >= NotificationPriority.HIGH && preferences.sms_enabled) {
    channels.push('sms')
  }
  
  return channels
}

async function queueDelivery(
  supabase: any,
  notificationId: string,
  channel: string,
  data: Record<string, any>,
  userId: string,
  businessId: string
) {
  try {
    // Create delivery record
    const { error } = await supabase
      .from('notification_deliveries')
      .insert({
        notification_id: notificationId,
        channel: channel,
        status: 'pending'
      })

    if (error) {
      console.error('Error creating delivery record:', error)
      return
    }

    // Trigger appropriate service based on channel
    switch (channel) {
      case 'email':
        await triggerEmailService(supabase, notificationId, userId, businessId, data)
        break
      case 'push':
        // TODO: Implement push notification service
        console.log('Push notifications not yet implemented')
        break
      case 'sms':
        // TODO: Implement SMS service (Twilio, AWS SNS, etc.)
        console.log('SMS notifications not yet implemented')
        break
      case 'in-app':
        // In-app notifications are stored in database only
        await supabase
          .from('notification_deliveries')
          .update({ status: 'sent', delivered_at: new Date().toISOString() })
          .eq('notification_id', notificationId)
          .eq('channel', 'in-app')
        break
    }
  } catch (error) {
    console.error('Error queuing delivery:', error)
  }
}

async function triggerEmailService(
  supabase: any,
  notificationId: string,
  userId: string,
  businessId: string,
  data: Record<string, any>
) {
  try {
    // Call the email service function
    const { error } = await supabase.functions.invoke('send-notification-email', {
      body: { notificationId, userId, businessId, data }
    })

    if (error) {
      console.error('Error triggering email service:', error)
    }
  } catch (error) {
    console.error('Error invoking email function:', error)
  }
}

// TODO: Customize title generation for your notification types
function generateTitle(type: string, data: Record<string, any>): string {
  switch (type) {
    case 'task-assigned':
      return 'New Task Assigned'
    case 'task-completed':
      return 'Task Completed'
    case 'schedule-updated':
      return 'Schedule Updated'
    case 'subscription-expiring':
      return 'Subscription Expiring Soon'
    default:
      return 'Notification'
  }
}

// TODO: Customize message generation for your notification types
function generateMessage(type: string, data: Record<string, any>): string {
  switch (type) {
    case 'task-assigned':
      return `You have been assigned: ${data.taskTitle || 'a new task'}`
    case 'task-completed':
      return `Task completed: ${data.taskTitle || 'task'}`
    case 'schedule-updated':
      return `Your schedule has been updated for ${data.date || 'today'}`
    case 'subscription-expiring':
      return `Your subscription expires on ${data.expirationDate}`
    default:
      return 'You have a new notification'
  }
}
