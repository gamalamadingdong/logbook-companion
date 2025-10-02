/**
 * CREATE SUBSCRIPTION INTENT
 * 
 * PURPOSE:
 * Creates a Stripe subscription with a payment intent for immediate payment collection.
 * This enables embedded payment flows where users enter card details in your app
 * using Stripe Elements or PaymentElement.
 * 
 * USAGE:
 * POST https://your-project.supabase.co/functions/v1/create-subscription-intent
 * Authorization: Bearer <anon_key>
 * 
 * Body:
 * {
 *   "businessId": "business-uuid",
 *   "tier": "professional"  // or "starter", "enterprise", etc.
 * }
 * 
 * Returns:
 * {
 *   "clientSecret": "pi_xxx_secret_yyy",  // Use with Stripe Elements
 *   "subscriptionId": "sub_xxx",
 *   "paymentIntentId": "pi_xxx",
 *   "success": true
 * }
 * 
 * CUSTOMIZATION POINTS:
 * - Line 70-90: Update tier-to-price mapping with your Stripe price IDs
 * - Line 120-140: Customize customer metadata
 * - Line 180-200: Add business-specific subscription metadata
 * 
 * DEPENDENCIES:
 * - Stripe secret key (STRIPE_SECRET_KEY)
 * - Supabase tables: businesses (with stripe_customer_id field)
 * - Optional: subscription_events table for audit trail
 * 
 * FRONTEND USAGE:
 * const response = await fetch('https://your-project.supabase.co/functions/v1/create-subscription-intent', {
 *   method: 'POST',
 *   headers: {
 *     'Authorization': `Bearer ${supabase.auth.session().access_token}`,
 *     'Content-Type': 'application/json'
 *   },
 *   body: JSON.stringify({ businessId, tier: 'professional' })
 * })
 * const { clientSecret } = await response.json()
 * 
 * // Use with Stripe Elements
 * const stripe = await loadStripe('pk_your_publishable_key')
 * const { error } = await stripe.confirmPayment({
 *   elements,
 *   clientSecret,
 *   confirmParams: {
 *     return_url: 'https://yourapp.com/subscription/success'
 *   }
 * })
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// TODO: Update these price IDs with your actual Stripe price IDs
// Get these from Stripe Dashboard > Products > Pricing
const PRICE_IDS: Record<string, string> = {
  starter: 'price_YOUR_STARTER_MONTHLY',
  professional: 'price_YOUR_PROFESSIONAL_MONTHLY',
  enterprise: 'price_YOUR_ENTERPRISE_MONTHLY',
  // Add annual options if you have them
  starter_annual: 'price_YOUR_STARTER_ANNUAL',
  professional_annual: 'price_YOUR_PROFESSIONAL_ANNUAL',
  enterprise_annual: 'price_YOUR_ENTERPRISE_ANNUAL',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Creating subscription intent...')

    // Initialize Stripe and Supabase
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    })

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { businessId, tier } = await req.json()
    console.log(`📋 Request: businessId=${businessId}, tier=${tier}`)

    if (!businessId || !tier) {
      throw new Error('businessId and tier are required')
    }

    if (!PRICE_IDS[tier]) {
      throw new Error(`Invalid tier: ${tier}`)
    }

    // Get business data
    const { data: business, error: businessError } = await supabaseClient
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single()

    if (businessError || !business) {
      console.error('❌ Business not found:', businessError)
      throw new Error('Business not found')
    }

    console.log(`🏢 Business found: ${business.name}`)

    // Get price ID for tier
    const priceId = PRICE_IDS[tier]
    console.log(`💰 Using price ID: ${priceId}`)

    // Get or create Stripe customer
    let customerId = business.stripe_customer_id
    if (!customerId) {
      console.log('👤 Creating new Stripe customer...')
      const customer = await stripe.customers.create({
        email: business.email,
        name: business.name,
        metadata: {
          business_id: business.id,
          // TODO: Add additional metadata if needed
        },
      })
      customerId = customer.id
      console.log(`✅ Customer created: ${customerId}`)

      // Update business with customer ID
      await supabaseClient
        .from('businesses')
        .update({ stripe_customer_id: customerId })
        .eq('id', businessId)

      console.log('📝 Updated business with customer ID')
    } else {
      console.log(`👤 Using existing customer: ${customerId}`)
    }

    // Check for existing active subscriptions
    const existingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10
    })

    // Look for active or incomplete subscriptions for the same price
    const existingSubscription = existingSubscriptions.data.find(sub => 
      (sub.status === 'active' || sub.status === 'incomplete') &&
      sub.items.data[0].price.id === priceId &&
      sub.metadata.business_id === businessId
    )

    if (existingSubscription) {
      console.log(`⚠️ Existing subscription found: ${existingSubscription.id} (${existingSubscription.status})`)
      
      // Return existing subscription's payment intent
      const existingInvoice = await stripe.invoices.retrieve(
        existingSubscription.latest_invoice as string, 
        { expand: ['payment_intent'] }
      )
      
      const existingPaymentIntent = existingInvoice.payment_intent as Stripe.PaymentIntent
      
      if (existingPaymentIntent?.client_secret) {
        console.log(`✅ Reusing existing payment intent: ${existingPaymentIntent.id}`)
        return new Response(JSON.stringify({
          clientSecret: existingPaymentIntent.client_secret,
          subscriptionId: existingSubscription.id,
          paymentIntentId: existingPaymentIntent.id,
          success: true,
          reused: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
    }

    // Create new subscription with payment intent
    console.log('🔄 Creating new subscription...')
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { 
        save_default_payment_method: 'on_subscription',
        payment_method_types: ['card']
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        business_id: businessId,
        tier: tier
        // TODO: Add additional metadata if needed
      }
    })

    const invoice = subscription.latest_invoice as Stripe.Invoice
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent
    
    // Add subscription ID to payment intent metadata
    if (paymentIntent?.id) {
      await stripe.paymentIntents.update(paymentIntent.id, {
        metadata: {
          subscription_id: subscription.id,
          business_id: businessId,
          tier: tier
        }
      })
      console.log('📝 Added metadata to payment intent')
    }

    if (!paymentIntent?.client_secret) {
      throw new Error('Failed to create payment intent')
    }

    console.log(`✅ Subscription created: ${subscription.id}`)
    console.log(`💳 Payment intent created: ${paymentIntent.id}`)

    // Store subscription event (optional)
    await supabaseClient
      .from('subscription_events')
      .insert({
        business_id: businessId,
        event_type: 'subscription_intent_created',
        stripe_subscription_id: subscription.id,
        data: {
          subscription_id: subscription.id,
          payment_intent_id: paymentIntent.id,
          tier: tier
        }
      })

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        subscriptionId: subscription.id,
        paymentIntentId: paymentIntent.id,
        success: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error: any) {
    console.error('❌ Error creating subscription intent:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to create subscription intent',
        success: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
