/**
 * VERIFY STRIPE SESSION
 * 
 * PURPOSE:
 * Verifies a completed Stripe Checkout session and updates your database with the
 * subscription details. Use this after successful payment when using Stripe Checkout
 * (hosted payment page) instead of embedded payment flows.
 * 
 * USAGE:
 * POST https://your-project.supabase.co/functions/v1/verify-stripe-session
 * Authorization: Bearer <user_token>
 * 
 * Body:
 * {
 *   "sessionId": "cs_test_xxx",
 *   "businessId": "business-uuid"
 * }
 * 
 * Returns:
 * {
 *   "success": true,
 *   "tier": "professional",
 *   "subscriptionId": "sub_xxx"
 * }
 * 
 * CUSTOMIZATION POINTS:
 * - Line 120-150: Update database fields to match your schema
 * - Line 180-210: Customize tier determination logic
 * 
 * DEPENDENCIES:
 * - Stripe secret key (STRIPE_SECRET_KEY)
 * - Supabase auth (verifies user owns the business)
 * - Supabase tables: businesses (with subscription fields)
 * - Optional: subscription_events table for audit trail
 * 
 * FRONTEND USAGE:
 * // After Stripe Checkout redirects back to your success URL
 * const sessionId = new URLSearchParams(window.location.search).get('session_id')
 * 
 * const response = await fetch('https://your-project.supabase.co/functions/v1/verify-stripe-session', {
 *   method: 'POST',
 *   headers: {
 *     'Authorization': `Bearer ${session.access_token}`,
 *     'Content-Type': 'application/json'
 *   },
 *   body: JSON.stringify({ sessionId, businessId })
 * })
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔍 Verifying Stripe checkout session...')

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    })

    // Initialize Supabase client with service role for database updates
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { sessionId, businessId } = await req.json()

    if (!sessionId || !businessId) {
      throw new Error('Missing sessionId or businessId')
    }

    console.log(`🔍 Verifying session ${sessionId} for business ${businessId}`)

    // Get the user from the authorization header
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Verify this is a legitimate Stripe checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    console.log(`📋 Session status: ${session.payment_status}, mode: ${session.mode}`)
    
    if (session.payment_status !== 'paid') {
      throw new Error(`Payment not completed. Status: ${session.payment_status}`)
    }

    if (session.mode !== 'subscription') {
      throw new Error('Session is not for a subscription')
    }

    // Get the subscription from the session
    const subscriptionId = session.subscription as string
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    console.log(`📋 Subscription ${subscriptionId} status: ${subscription.status}`)
    
    // Get the price ID to determine the tier
    const priceId = subscription.items.data[0].price.id
    const { tier, employeeLimit, features } = getTierFromPriceId(priceId)
    console.log(`🎯 Determined tier: ${tier} with ${employeeLimit} employee limit`)

    // TODO: Update these fields to match your businesses table schema
    // Update the business in the database
    const { error: updateError } = await supabaseClient
      .from('businesses')
      .update({
        subscription_tier: tier,
        subscription_status: subscription.status,
        employee_limit: employeeLimit,
        features_enabled: features,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer,
        subscription_current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', businessId)

    if (updateError) {
      console.error('❌ Failed to update business:', updateError)
      throw new Error(`Failed to update business: ${updateError.message}`)
    }

    console.log(`✅ Successfully updated business ${businessId} to ${tier} tier`)

    // Log the successful verification
    await supabaseClient
      .from('subscription_events')
      .insert({
        business_id: businessId,
        event_type: 'subscription_verified',
        stripe_subscription_id: subscription.id,
        data: { 
          session_id: sessionId,
          price_id: priceId, 
          tier 
        },
      })

    return new Response(
      JSON.stringify({
        success: true,
        tier,
        subscriptionId: subscription.id,
        status: subscription.status
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ Verification error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Verification failed'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// TODO: Update this function to match your Stripe price IDs and tier structure
function getTierFromPriceId(priceId: string) {
  const priceMapping: Record<string, any> = {
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
      features: ['core', 'email_notifications', 'advanced_analytics', 'priority_support', 'api_access']
    }
  }

  return priceMapping[priceId] || { tier: 'free', employeeLimit: 5, features: ['core'] }
}
