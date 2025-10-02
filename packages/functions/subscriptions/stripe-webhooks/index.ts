/**
 * STRIPE WEBHOOKS HANDLER
 * 
 * PURPOSE:
 * Processes Stripe webhook events to synchronize subscription status with your database.
 * This is CRITICAL for maintaining accurate billing state. Without this, your app won't
 * know when subscriptions are created, updated, cancelled, or when payments fail.
 * 
 * USAGE:
 * This endpoint is called by Stripe, not your application.
 * Configure in Stripe Dashboard > Developers > Webhooks:
 * URL: https://your-project.supabase.co/functions/v1/stripe-webhooks
 * 
 * Events to listen for:
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_succeeded
 * - invoice.payment_failed
 * 
 * CUSTOMIZATION POINTS:
 * - Line 180-230: Update tier mapping to match your Stripe price IDs
 * - Line 90-120: Customize subscription data updates for your schema
 * - Line 250-280: Add custom webhook event handlers
 * - Line 140-160: Customize free tier defaults when subscription cancelled
 * 
 * DEPENDENCIES:
 * - Stripe secret key (STRIPE_SECRET_KEY)
 * - Stripe webhook secret (STRIPE_WEBHOOK_SECRET) - get from Stripe Dashboard
 * - Supabase tables: businesses (with subscription fields)
 * - Optional: subscription_events table for audit trail
 * 
 * SECURITY:
 * - Uses Stripe signature verification (DO NOT REMOVE)
 * - Uses Supabase service role key to bypass RLS
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    })

    // Initialize Supabase with service role (bypasses RLS)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    )

    // Verify webhook signature
    const signature = req.headers.get('stripe-signature')
    const body = await req.text()
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

    if (!signature || !webhookSecret) {
      console.error('Missing Stripe signature or webhook secret')
      return new Response('Bad Request', { status: 400, headers: corsHeaders })
    }

    // Construct event from webhook (this verifies the signature)
    let event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
      console.log(`✅ Verified webhook: ${event.type}`)
    } catch (err: any) {
      console.error('❌ Webhook signature verification failed:', err.message)
      return new Response('Invalid signature', { status: 400, headers: corsHeaders })
    }

    // Handle the webhook event
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(supabaseClient, event)
        break
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(supabaseClient, event)
        break
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(supabaseClient, event)
        break
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(supabaseClient, event)
        break
      
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function handleSubscriptionChange(supabaseClient: any, event: any) {
  const subscription = event.data.object
  const priceId = subscription.items.data[0].price.id
  const { tier, employeeLimit, features } = getTierFromPriceId(priceId)

  console.log(`Processing subscription change: ${tier}`)

  // Find business by Stripe customer ID
  const { data: business } = await supabaseClient
    .from('businesses')
    .select('id')
    .eq('stripe_customer_id', subscription.customer)
    .single()

  if (!business) {
    console.error('Business not found for customer:', subscription.customer)
    return
  }

  // TODO: Update these fields to match your businesses table schema
  // Update subscription in database
  const { error } = await supabaseClient
    .from('businesses')
    .update({
      subscription_tier: tier,
      subscription_status: subscription.status,
      employee_limit: employeeLimit,
      features_enabled: features,
      stripe_subscription_id: subscription.id,
      subscription_current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    })
    .eq('id', business.id)

  if (error) {
    console.error('Failed to update business:', error)
  } else {
    console.log(`✅ Updated business ${business.id} to ${tier} tier`)
  }

  // Log event (optional - create subscription_events table if needed)
  await supabaseClient
    .from('subscription_events')
    .insert({
      business_id: business.id,
      event_type: event.type === 'customer.subscription.created' ? 'subscription_created' : 'subscription_updated',
      stripe_subscription_id: subscription.id,
      data: { 
        tier, 
        status: subscription.status,
        price_id: priceId 
      },
    })
}

async function handleSubscriptionDeleted(supabaseClient: any, event: any) {
  const subscription = event.data.object
  
  // Find business by Stripe subscription ID
  const { data: business } = await supabaseClient
    .from('businesses')
    .select('*')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (!business) {
    console.error('Business not found for subscription:', subscription.id)
    return
  }

  // TODO: Customize free tier defaults for your application
  // Downgrade to free tier
  await supabaseClient
    .from('businesses')
    .update({
      subscription_tier: 'free',
      subscription_status: 'canceled',
      employee_limit: 5, // Default free tier limit
      features_enabled: ['core'], // Basic features only
      stripe_subscription_id: null,
      subscription_current_period_start: null,
      subscription_current_period_end: null,
    })
    .eq('id', business.id)

  // Log event
  await supabaseClient
    .from('subscription_events')
    .insert({
      business_id: business.id,
      event_type: 'subscription_canceled',
      stripe_subscription_id: subscription.id,
      data: { reason: 'subscription_deleted' },
    })

  console.log(`✅ Subscription canceled for business ${business.id}`)
}

async function handlePaymentSucceeded(supabaseClient: any, event: any) {
  const invoice = event.data.object
  const subscriptionId = invoice.subscription
  
  if (!subscriptionId) return

  // Find business by Stripe subscription ID
  const { data: business } = await supabaseClient
    .from('businesses')
    .select('*')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  if (!business) {
    console.error('Business not found for subscription:', subscriptionId)
    return
  }

  // Update subscription status to active
  await supabaseClient
    .from('businesses')
    .update({
      subscription_status: 'active',
    })
    .eq('id', business.id)

  // Log event
  await supabaseClient
    .from('subscription_events')
    .insert({
      business_id: business.id,
      event_type: 'payment_succeeded',
      stripe_subscription_id: subscriptionId,
      data: { 
        invoice_id: invoice.id, 
        amount_paid: invoice.amount_paid,
        currency: invoice.currency 
      },
    })

  console.log(`✅ Payment succeeded for business ${business.id}`)
}

async function handlePaymentFailed(supabaseClient: any, event: any) {
  const invoice = event.data.object
  const subscriptionId = invoice.subscription
  
  if (!subscriptionId) return

  // Find business by Stripe subscription ID
  const { data: business } = await supabaseClient
    .from('businesses')
    .select('*')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  if (!business) {
    console.error('Business not found for subscription:', subscriptionId)
    return
  }

  // Update subscription status to past_due
  await supabaseClient
    .from('businesses')
    .update({
      subscription_status: 'past_due',
    })
    .eq('id', business.id)

  // Log event
  await supabaseClient
    .from('subscription_events')
    .insert({
      business_id: business.id,
      event_type: 'payment_failed',
      stripe_subscription_id: subscriptionId,
      data: { 
        invoice_id: invoice.id, 
        amount_due: invoice.amount_due,
        currency: invoice.currency,
        attempt_count: invoice.attempt_count 
      },
    })

  console.log(`⚠️ Payment failed for business ${business.id}`)
}

// TODO: CRITICAL - Update these price IDs with your actual Stripe price IDs
// Get these from Stripe Dashboard > Products > Pricing
function getTierFromPriceId(priceId: string) {
  const priceMapping: Record<string, any> = {
    // Example monthly prices
    'price_YOUR_STARTER_MONTHLY': {
      tier: 'starter',
      employeeLimit: 5,
      features: ['core', 'email_notifications']
    },
    'price_YOUR_PROFESSIONAL_MONTHLY': {
      tier: 'professional',
      employeeLimit: 20,
      features: ['core', 'email_notifications', 'advanced_analytics', 'priority_support']
    },
    'price_YOUR_ENTERPRISE_MONTHLY': {
      tier: 'enterprise',
      employeeLimit: -1, // unlimited
      features: ['core', 'email_notifications', 'advanced_analytics', 'priority_support', 'api_access', 'custom_integrations']
    },
    
    // Example annual prices (usually discounted)
    'price_YOUR_STARTER_ANNUAL': {
      tier: 'starter',
      employeeLimit: 5,
      features: ['core', 'email_notifications']
    },
    'price_YOUR_PROFESSIONAL_ANNUAL': {
      tier: 'professional',
      employeeLimit: 20,
      features: ['core', 'email_notifications', 'advanced_analytics', 'priority_support']
    },
    'price_YOUR_ENTERPRISE_ANNUAL': {
      tier: 'enterprise',
      employeeLimit: -1,
      features: ['core', 'email_notifications', 'advanced_analytics', 'priority_support', 'api_access', 'custom_integrations']
    }
  }

  // Default to free tier if price not found
  return priceMapping[priceId] || { 
    tier: 'free', 
    employeeLimit: 5, 
    features: ['core'] 
  }
}
