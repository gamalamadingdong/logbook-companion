/**
 * SEND NOTIFICATION EMAIL
 * 
 * PURPOSE:
 * Sends notification emails via Resend with customizable templates for different
 * notification types. Integrates with the notification orchestrator system.
 * 
 * USAGE:
 * POST https://your-project.supabase.co/functions/v1/send-notification-email
 * Authorization: Bearer <service_role_key>
 * 
 * Body:
 * {
 *   "notificationId": "notification-uuid",
 *   "userId": "user-uuid",
 *   "businessId": "business-uuid",
 *   "data": { "taskTitle": "Fix issue", "customerName": "John" }
 * }
 * 
 * CUSTOMIZATION POINTS:
 * - Line 90-150: Customize email templates for different notification types
 * - Line 75: Update sender email domain (must be verified in Resend)
 * - Line 120-140: Add your branding (logo, colors, etc.)
 * - Line 200-220: Add custom notification type handling
 * 
 * DEPENDENCIES:
 * - Resend API key (RESEND_API_KEY environment variable)
 * - Verified sender domain in Resend
 * - Supabase tables: notifications, profiles, businesses, notification_deliveries
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from "https://esm.sh/resend@2.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Resend
const resend = new Resend(Deno.env.get("RESEND_API_KEY"))

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

interface EmailNotificationData {
  notificationId: string
  userId: string
  businessId: string
  data: Record<string, any>
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const emailData: EmailNotificationData = await req.json()
    
    // Get user profile
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, display_name')
      .eq('id', emailData.userId)
      .single()

    if (!userProfile?.email) {
      throw new Error('User email not found')
    }

    // Get business info
    const { data: business } = await supabase
      .from('businesses')
      .select('id, name, display_name, email')
      .eq('id', emailData.businessId)
      .single()

    if (!business) {
      throw new Error('Business not found')
    }

    // Get notification data
    const { data: notification } = await supabase
      .from('notifications')
      .select('id, type, title, message, metadata')
      .eq('id', emailData.notificationId)
      .single()

    if (!notification) {
      throw new Error('Notification not found')
    }

    // Generate email content
    const emailContent = generateEmailContent(notification, userProfile, business, emailData.data)

    // TODO: Update sender domain to your verified Resend domain
    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: `${business.display_name || business.name} <notifications@yourdomain.com>`,
      to: [userProfile.email],
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      tags: [
        { name: 'notification_type', value: notification.type },
        { name: 'notification_id', value: emailData.notificationId },
        { name: 'business_id', value: emailData.businessId }
      ]
    })

    if (emailResponse.error) {
      throw new Error(`Resend error: ${emailResponse.error.message}`)
    }

    // Update delivery status
    await supabase
      .from('notification_deliveries')
      .update({
        status: 'sent',
        provider_id: emailResponse.data?.id,
        delivered_at: new Date().toISOString()
      })
      .eq('notification_id', emailData.notificationId)
      .eq('channel', 'email')

    return new Response(
      JSON.stringify({
        success: true,
        messageId: emailResponse.data?.id,
        recipient: userProfile.email
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Email notification error:', error)
    
    // Update delivery status to failed
    try {
      const data = await req.json()
      await supabase
        .from('notification_deliveries')
        .update({
          status: 'failed',
          error_message: error.message
        })
        .eq('notification_id', data.notificationId)
        .eq('channel', 'email')
    } catch (updateError) {
      console.error('Failed to update delivery status:', updateError)
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// TODO: Customize email templates for your notification types
function generateEmailContent(
  notification: any,
  userProfile: any,
  business: any,
  data: Record<string, any>
) {
  const userName = userProfile.display_name || `${userProfile.first_name} ${userProfile.last_name}`
  const businessName = business.display_name || business.name

  // Base template with branding
  const baseHtml = (content: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${notification.title}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">${businessName}</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">${notification.title}</h2>
          ${content}
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #666; font-size: 12px; text-align: center;">
            You're receiving this email because you're a member of ${businessName}.
            <br>
            To manage your notification preferences, log in to your account.
          </p>
        </div>
      </body>
    </html>
  `

  // Generate content based on notification type
  let htmlContent = ''
  let textContent = `${notification.title}\n\n${notification.message}\n\n`

  switch (notification.type) {
    case 'task_update':
      htmlContent = `
        <p>Hi ${userName},</p>
        <p>${notification.message}</p>
        ${data.taskTitle ? `<p><strong>Task:</strong> ${data.taskTitle}</p>` : ''}
        ${data.dueDate ? `<p><strong>Due:</strong> ${data.dueDate}</p>` : ''}
        ${data.assignedBy ? `<p><strong>Assigned by:</strong> ${data.assignedBy}</p>` : ''}
        <p style="margin-top: 30px;">
          <a href="${data.taskUrl || '#'}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Task
          </a>
        </p>
      `
      textContent += `${data.taskTitle ? `Task: ${data.taskTitle}\n` : ''}`
      textContent += `${data.dueDate ? `Due: ${data.dueDate}\n` : ''}`
      textContent += `${data.taskUrl ? `\nView task: ${data.taskUrl}` : ''}`
      break

    case 'schedule_change':
      htmlContent = `
        <p>Hi ${userName},</p>
        <p>${notification.message}</p>
        ${data.date ? `<p><strong>Date:</strong> ${data.date}</p>` : ''}
        ${data.time ? `<p><strong>Time:</strong> ${data.time}</p>` : ''}
        ${data.location ? `<p><strong>Location:</strong> ${data.location}</p>` : ''}
        <p style="margin-top: 30px;">
          <a href="${data.scheduleUrl || '#'}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Schedule
          </a>
        </p>
      `
      textContent += `${data.date ? `Date: ${data.date}\n` : ''}`
      textContent += `${data.time ? `Time: ${data.time}\n` : ''}`
      textContent += `${data.scheduleUrl ? `\nView schedule: ${data.scheduleUrl}` : ''}`
      break

    case 'system':
      htmlContent = `
        <p>Hi ${userName},</p>
        <p>${notification.message}</p>
        ${data.actionRequired ? `<p><strong>Action required:</strong> ${data.actionRequired}</p>` : ''}
        ${data.deadline ? `<p><strong>Deadline:</strong> ${data.deadline}</p>` : ''}
      `
      textContent += `${data.actionRequired ? `Action required: ${data.actionRequired}\n` : ''}`
      break

    default:
      htmlContent = `
        <p>Hi ${userName},</p>
        <p>${notification.message}</p>
      `
  }

  return {
    subject: notification.title,
    html: baseHtml(htmlContent),
    text: textContent
  }
}
