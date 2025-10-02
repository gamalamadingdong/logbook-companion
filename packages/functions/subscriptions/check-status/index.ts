/**
 * CHECK SUBSCRIPTION STATUS
 * 
 * PURPOSE:
 * Checks the current subscription status from Stripe and syncs it with your database.
 * Use this to verify subscription state, especially useful for detecting changes that
 * might have been missed by webhooks or for manual reconciliation.
 * 
 * USAGE:
 * POST https://your-project.supabase.co/functions/v1/check-subscription-status
 * Authorization: Bearer <service_role_key>
 * 
 * Body:
 * {
 *   "businessId": "business-uuid",
 *   "stripeCustomerId": "cus_xxx"
 * }
 * 
 * Returns:
 * {
 *   "subscription": { /* Stripe subscription object */ },
 *   "updated": true,
 *   "current": "professional"
 * }
 * 
 * CUSTOMIZATION POINTS:
 * - Line 100-120: Update tier determination logic
 * - Line 140-160: Customize database update fields
 * 
 * DEPENDENCIES:
 * - Stripe secret key (STRIPE_SECRET_KEY)
 * - Supabase tables: businesses (with subscription fields)
 * 
 * USE CASES:
 * - Periodic sync job to ensure database matches Stripe
 * - Manual admin reconciliation
 * - Verify subscription after webhook delivery issues
 * - Check status before allowing feature access
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    // Initialize Supabase with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    // Get the business ID and customer ID from the request
    const { businessId, stripeCustomerId } = await req.json()

    if (!businessId || !stripeCustomerId) {
      return new Response(
        JSON.stringify({ error: 'Missing businessId or stripeCustomerId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🔍 Checking subscription status for business ${businessId}, customer ${stripeCustomerId}`)

    // Get the current subscription from Stripe
    const customer = await stripe.customers.retrieve(stripeCustomerId, {
      expand: ['subscriptions']
    }) as Stripe.Customer

    if (!customer.subscriptions || customer.subscriptions.data.length === 0) {
      console.log('❌ No active subscriptions found')
      return new Response(
        JSON.stringify({ subscription: null, updated: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const subscription = customer.subscriptions.data[0] // Get the first active subscription
    console.log(`📋 Found subscription: ${subscription.id}, status: ${subscription.status}`)

    // Determine the subscription tier from the price ID
    const priceId = subscription.items.data[0]?.price.id
    const { tier, employeeLimit, features } = getSubscriptionTierFromPriceId(priceId)

    console.log(`🎯 Subscription tier: ${tier}`)

    // Get current business data
    const { data: currentBusiness, error: fetchError } = await supabaseClient
      .from('businesses')
      .select('subscription_tier, subscription_status, stripe_subscription_id')
      .eq('id', businessId)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch business: ${fetchError.message}`)
    }

    // Check if an update is needed
    const needsUpdate = 
      currentBusiness.subscription_tier !== tier ||
      currentBusiness.subscription_status !== subscription.status ||
      currentBusiness.stripe_subscription_id !== subscription.id

    if (!needsUpdate) {
      console.log('✅ Subscription data is already up to date')
      return new Response(
        JSON.stringify({ subscription, updated: false, current: tier }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // TODO: Update these fields to match your businesses table schema
    // Update the business record
    const { error: updateError } = await supabaseClient
      .from('businesses')
      .update({
        subscription_tier: tier,
        subscription_status: subscription.status,
        employee_limit: employeeLimit,
        features_enabled: features,
        stripe_subscription_id: subscription.id,
        subscription_current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', businessId)

    if (updateError) {
      throw new Error(`Failed to update business: ${updateError.message}`)
    }

    console.log('✅ Business subscription updated successfully')

    return new Response(
      JSON.stringify({ 
        subscription, 
        updated: true, 
        current: tier,
        previousTier: currentBusiness.subscription_tier 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ Error checking subscription status:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// TODO: Update this function to match your Stripe price IDs
function getSubscriptionTierFromPriceId(priceId: string) {
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
      employeeLimit: -1,
      features: ['core', 'email_notifications', 'advanced_analytics', 'priority_support', 'api_access']
    }
  }

  return priceMapping[priceId] || { tier: 'free', employeeLimit: 5, features: ['core'] }
}
