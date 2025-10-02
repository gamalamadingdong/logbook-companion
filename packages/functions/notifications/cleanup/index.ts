/**
 * CLEANUP NOTIFICATIONS
 * 
 * PURPOSE:
 * Removes old or cancelled notifications and their associated delivery records.
 * Can be triggered manually or scheduled via pg_cron for automatic cleanup.
 * 
 * USAGE:
 * POST https://your-project.supabase.co/functions/v1/cleanup-notifications
 * Authorization: Bearer <service_role_key>
 * 
 * Body Options:
 * 
 * 1. Clean by business:
 * {
 *   "businessId": "business-uuid"
 * }
 * 
 * 2. Clean by resource (task, job, order, etc.):
 * {
 *   "businessId": "business-uuid",
 *   "resourceId": "resource-uuid"
 * }
 * 
 * 3. Clean old notifications (older than X days):
 * {
 *   "businessId": "business-uuid",
 *   "olderThanDays": 90
 * }
 * 
 * CUSTOMIZATION POINTS:
 * - Line 80: Add custom cleanup logic for your domain-specific tables
 * - Line 110: Configure default retention period
 * - Line 140: Add business-specific cleanup rules
 * 
 * DEPENDENCIES:
 * - Supabase tables: notifications, notification_deliveries, notification_history
 * - Service role key for deletion operations
 * 
 * SCHEDULING:
 * Add to supabase/migrations/cron.sql:
 * SELECT cron.schedule('cleanup-old-notifications', '0 2 * * *',
 *   $$SELECT net.http_post(
 *     url:='https://your-project.supabase.co/functions/v1/cleanup-notifications',
 *     headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_KEY"}'::jsonb,
 *     body:='{"olderThanDays": 90}'::jsonb
 *   )$$
 * );
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { businessId, resourceId, olderThanDays } = await req.json()

    if (!businessId) {
      return new Response(
        JSON.stringify({ error: 'businessId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const cleanupResults = {
      notifications: 0,
      deliveries: 0,
      history: 0
    }

    // Build notification query
    let notificationQuery = supabaseClient
      .from('notifications')
      .select('id')
      .eq('business_id', businessId)

    // Filter by resource ID if provided
    if (resourceId) {
      // TODO: Update field name if you use a different naming convention
      // e.g., job_id, task_id, order_id, etc.
      notificationQuery = notificationQuery.eq('resource_id', resourceId)
    }

    // Filter by age if provided
    if (olderThanDays) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)
      notificationQuery = notificationQuery.lt('created_at', cutoffDate.toISOString())
    }

    // Get notifications to delete
    const { data: notificationsToDelete, error: findError } = await notificationQuery

    if (findError) {
      console.error('Error finding notifications to delete:', findError)
      throw findError
    }

    const notificationIds = notificationsToDelete?.map((n: any) => n.id) || []
    console.log(`Found ${notificationIds.length} notifications to clean up`)

    if (notificationIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No notifications to clean up',
          results: cleanupResults 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 1: Clean up notification_deliveries
    const { error: deliveriesError, count: deliveriesCount } = await supabaseClient
      .from('notification_deliveries')
      .delete({ count: 'exact' })
      .in('notification_id', notificationIds)

    if (deliveriesError) {
      console.error('Error deleting notification deliveries:', deliveriesError)
    } else {
      cleanupResults.deliveries = deliveriesCount || 0
      console.log(`Deleted ${deliveriesCount} delivery records`)
    }

    // Step 2: Clean up notification_history (if you have this table)
    const { error: historyError, count: historyCount } = await supabaseClient
      .from('notification_history')
      .delete({ count: 'exact' })
      .in('notification_id', notificationIds)

    if (historyError) {
      // This is optional - might not exist in all schemas
      console.warn('Notification history table not found or error deleting:', historyError.message)
    } else {
      cleanupResults.history = historyCount || 0
      console.log(`Deleted ${historyCount} history records`)
    }

    // Step 3: Delete main notifications
    const { error: notificationsError, count: notificationsCount } = await supabaseClient
      .from('notifications')
      .delete({ count: 'exact' })
      .in('id', notificationIds)

    if (notificationsError) {
      console.error('Error deleting notifications:', notificationsError)
      throw notificationsError
    } else {
      cleanupResults.notifications = notificationsCount || 0
      console.log(`Deleted ${notificationsCount} notifications`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cleaned up ${cleanupResults.notifications} notifications`,
        results: cleanupResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Cleanup error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
