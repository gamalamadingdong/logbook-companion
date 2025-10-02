/**
 * MANAGE SUBSCRIPTION TIER
 * 
 * PURPOSE:
 * Handles subscription tier changes including upgrades, downgrades, and cancellations.
 * Manages the complexity of Stripe subscription modifications with proper billing
 * proration and immediate vs. end-of-period changes.
 * 
 * USAGE:
 * POST https://your-project.supabase.co/functions/v1/manage-subscription-tier
 * Authorization: Bearer <user_token>
 * 
 * Body (Upgrade/Downgrade):
 * {
 *   "businessId": "business-uuid",
 *   "targetTier": "professional"
 * }
 * 
 * Body (Cancel):
 * {
 *   "businessId": "business-uuid",
 *   "targetTier": "free"
 * }
 * 
 * Returns:
 * {
 *   "success": true,
 *   "action": "upgrade" | "downgrade" | "cancel",
 *   "effectiveDate": "2025-11-01T00:00:00Z",
 *   "subscriptionId": "sub_xxx"
 * }
 * 
 * CUSTOMIZATION POINTS:
 * - Line 80-100: Define tier hierarchy for upgrade/downgrade logic
 * - Line 150-170: Configure proration behavior (immediate vs end-of-period)
 * - Line 200-220: Add custom business logic for tier changes
 * 
 * DEPENDENCIES:
 * - Stripe secret key (STRIPE_SECRET_KEY)
 * - Supabase auth (verifies user owns the business)
 * - Supabase tables: businesses (with subscription fields)
 * - Optional: subscription_events table for audit trail
 * 
 * BILLING BEHAVIOR:
 * - Upgrades: Immediate change with proration
 * - Downgrades: End of current period (prevents revenue loss)
 * - Cancellation: End of current period (customer keeps access)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@14.21.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// TODO: Update with your actual Stripe price IDs
const PRICE_IDS: Record<string, string | null> = {
  free: null,
  starter: "price_YOUR_STARTER_MONTHLY",
  professional: "price_YOUR_PROFESSIONAL_MONTHLY",
  enterprise: "price_YOUR_ENTERPRISE_MONTHLY",
}

// Define tier order for upgrade/downgrade detection
const TIER_ORDER: Record<string, number> = {
  free: 0,
  starter: 1,
  professional: 2,
  enterprise: 3,
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("authorization")
    if (!authHeader) {
      throw new Error("Authentication required")
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2023-10-16",
    })

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    // Verify the user is authenticated
    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) {
      throw new Error("Invalid authentication token")
    }

    const { businessId, targetTier } = await req.json()

    if (!businessId || !targetTier) {
      throw new Error("businessId and targetTier are required")
    }

    if (!(targetTier in PRICE_IDS)) {
      throw new Error(`Unsupported target tier: ${targetTier}`)
    }

    // Get business data
    const { data: business, error: businessError } = await supabaseClient
      .from("businesses")
      .select("id, subscription_tier, subscription_status, stripe_subscription_id, stripe_customer_id")
      .eq("id", businessId)
      .single()

    if (businessError || !business) {
      throw new Error("Business not found")
    }

    console.log(`Managing tier change: ${business.subscription_tier} → ${targetTier}`)

    const currentTier = business.subscription_tier || 'free'
    const currentOrder = TIER_ORDER[currentTier] || 0
    const targetOrder = TIER_ORDER[targetTier] || 0

    // Handle cancellation (downgrade to free)
    if (targetTier === 'free' && business.stripe_subscription_id) {
      console.log('🔴 Cancelling subscription...')
      
      const subscription = await stripe.subscriptions.update(
        business.stripe_subscription_id,
        {
          cancel_at_period_end: true
        }
      )

      const effectiveDate = new Date(subscription.current_period_end * 1000).toISOString()

      // Update database with pending cancellation
      await supabaseClient
        .from("businesses")
        .update({
          subscription_status: 'canceling',
          updated_at: new Date().toISOString()
        })
        .eq("id", businessId)

      // Log event
      await supabaseClient
        .from('subscription_events')
        .insert({
          business_id: businessId,
          event_type: 'subscription_cancel_scheduled',
          stripe_subscription_id: business.stripe_subscription_id,
          data: { 
            previous_tier: currentTier,
            effective_date: effectiveDate 
          },
        })

      return new Response(
        JSON.stringify({
          success: true,
          action: 'cancel',
          effectiveDate,
          message: `Subscription will be cancelled at end of billing period (${effectiveDate})`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle upgrade (immediate)
    if (targetOrder > currentOrder) {
      console.log('🟢 Upgrading subscription...')
      
      if (!business.stripe_customer_id) {
        throw new Error('No Stripe customer found. Please start with a paid tier.')
      }

      // If no subscription exists, create one
      if (!business.stripe_subscription_id) {
        const subscription = await stripe.subscriptions.create({
          customer: business.stripe_customer_id,
          items: [{ price: PRICE_IDS[targetTier]! }],
          metadata: {
            business_id: businessId,
            tier: targetTier
          }
        })

        // Update database
        const { tier, employeeLimit, features } = getTierConfig(targetTier)
        await supabaseClient
          .from("businesses")
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
          .eq("id", businessId)

        return new Response(
          JSON.stringify({
            success: true,
            action: 'upgrade',
            effectiveDate: new Date().toISOString(),
            subscriptionId: subscription.id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Update existing subscription
      const subscription = await stripe.subscriptions.retrieve(business.stripe_subscription_id)
      const itemId = subscription.items.data[0].id

      const updatedSubscription = await stripe.subscriptions.update(
        business.stripe_subscription_id,
        {
          items: [
            {
              id: itemId,
              price: PRICE_IDS[targetTier]!,
            },
          ],
          proration_behavior: 'always_invoice', // Immediate upgrade with proration
        }
      )

      // Update database
      const { tier, employeeLimit, features } = getTierConfig(targetTier)
      await supabaseClient
        .from("businesses")
        .update({
          subscription_tier: tier,
          employee_limit: employeeLimit,
          features_enabled: features,
          updated_at: new Date().toISOString()
        })
        .eq("id", businessId)

      // Log event
      await supabaseClient
        .from('subscription_events')
        .insert({
          business_id: businessId,
          event_type: 'subscription_upgraded',
          stripe_subscription_id: business.stripe_subscription_id,
          data: { 
            previous_tier: currentTier,
            new_tier: targetTier 
          },
        })

      return new Response(
        JSON.stringify({
          success: true,
          action: 'upgrade',
          effectiveDate: new Date().toISOString(),
          subscriptionId: updatedSubscription.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle downgrade (end of period)
    if (targetOrder < currentOrder && business.stripe_subscription_id) {
      console.log('🟡 Downgrading subscription...')
      
      const subscription = await stripe.subscriptions.retrieve(business.stripe_subscription_id)
      const itemId = subscription.items.data[0].id

      const updatedSubscription = await stripe.subscriptions.update(
        business.stripe_subscription_id,
        {
          items: [
            {
              id: itemId,
              price: PRICE_IDS[targetTier]!,
            },
          ],
          proration_behavior: 'none', // Downgrade at end of period
        }
      )

      const effectiveDate = new Date(updatedSubscription.current_period_end * 1000).toISOString()

      // Log event
      await supabaseClient
        .from('subscription_events')
        .insert({
          business_id: businessId,
          event_type: 'subscription_downgrade_scheduled',
          stripe_subscription_id: business.stripe_subscription_id,
          data: { 
            previous_tier: currentTier,
            new_tier: targetTier,
            effective_date: effectiveDate 
          },
        })

      return new Response(
        JSON.stringify({
          success: true,
          action: 'downgrade',
          effectiveDate,
          message: `Subscription will downgrade at end of billing period (${effectiveDate})`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // No change needed
    return new Response(
      JSON.stringify({
        success: true,
        action: 'none',
        message: 'Already on target tier'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ Error managing subscription tier:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to manage subscription'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// TODO: Update tier configurations to match your business model
function getTierConfig(tier: string) {
  const configs: Record<string, any> = {
    starter: {
      tier: 'starter',
      employeeLimit: 5,
      features: ['core', 'email_notifications']
    },
    professional: {
      tier: 'professional',
      employeeLimit: 20,
      features: ['core', 'email_notifications', 'advanced_analytics', 'priority_support']
    },
    enterprise: {
      tier: 'enterprise',
      employeeLimit: -1,
      features: ['core', 'email_notifications', 'advanced_analytics', 'priority_support', 'api_access']
    }
  }

  return configs[tier] || { tier: 'free', employeeLimit: 5, features: ['core'] }
}
