/**
 * Delete User Account - Supabase Edge Function
 * 
 * PURPOSE:
 * GDPR-compliant user account deletion with business cleanup.
 * Handles cascade deletion of user data and business ownership transfer.
 * 
 * USAGE:
 * POST /functions/v1/delete-user-account
 * Headers: Authorization: Bearer <user-token>
 * Body: { confirmationText: "DELETE MY ACCOUNT" }
 * 
 * BEHAVIOR:
 * - If user is the LAST owner of a business → deletes the entire business
 * - If user is NOT the last owner → removes user but preserves business
 * - Anonymizes profile (keeps for audit trail)
 * - Deletes all user-generated content
 * 
 * CUSTOMIZATION POINTS:
 * 1. Update confirmation text (line 42)
 * 2. Add your business-specific tables to deletion logic (line 156+)
 * 3. Customize anonymization strategy (line 220)
 * 4. Add audit logging if needed
 * 
 * DEPENDENCIES:
 * - Supabase service role key (required)
 * - Supabase anon key (required)
 * - All tables from core schema
 * 
 * EXTRACTED FROM: ScheduleBoard v2
 * NOTE: Simplified to remove ScheduleBoard-specific tables (jobs, equipment, etc.)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteAccountRequest {
  confirmationText: string
}

interface DeleteAccountResponse {
  success: boolean
  message: string
  user_id: string
  was_owner: boolean
  businesses_affected: string[]
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { confirmationText }: DeleteAccountRequest = await req.json()

    console.log('Delete account request received')

    // TODO: Customize confirmation text for your app
    if (confirmationText !== 'DELETE MY ACCOUNT') {
      return new Response(
        JSON.stringify({ error: 'Invalid confirmation text. Type "DELETE MY ACCOUNT" to confirm.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get the user from the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create admin client using service role key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Create regular client to verify user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !user) {
      console.error('User authentication error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Deleting account for user:', user.id)

    // Get user's business roles to determine ownership
    const { data: businessRoles, error: rolesError } = await supabaseAdmin
      .from('user_business_roles')
      .select('business_id, role')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (rolesError) {
      console.error('Error fetching business roles:', rolesError)
      throw new Error('Failed to fetch user business roles')
    }

    const businessIds = businessRoles?.map(role => role.business_id) || []
    const ownedBusinessIds = businessRoles?.filter(role => role.role === 'owner').map(role => role.business_id) || []
    const isOwner = ownedBusinessIds.length > 0

    console.log('User business roles:', { businessIds, ownedBusinessIds, isOwner })

    // Check each owned business to see if user is the last owner
    const businessesToDelete: string[] = []
    
    for (const businessId of ownedBusinessIds) {
      const { data: otherOwners, error: ownersError } = await supabaseAdmin
        .from('user_business_roles')
        .select('user_id')
        .eq('business_id', businessId)
        .eq('role', 'owner')
        .eq('status', 'active')
        .neq('user_id', user.id)

      if (ownersError) {
        console.error('Error checking other owners:', ownersError)
        throw new Error('Failed to check business ownership')
      }

      // If no other owners, this business will be deleted
      if (!otherOwners || otherOwners.length === 0) {
        businessesToDelete.push(businessId)
        console.log('Business will be deleted (last owner):', businessId)
      } else {
        console.log('Business will be preserved (other owners exist):', businessId)
      }
    }

    // Delete businesses where user is the last owner
    for (const businessId of businessesToDelete) {
      console.log('Deleting business data for:', businessId)
      
      try {
        // TODO: Add your business-specific tables here
        // Delete in proper order due to foreign key constraints
        
        // Delete notifications
        await supabaseAdmin.from('notification_deliveries').delete().eq('business_id', businessId)
        await supabaseAdmin.from('notification_history').delete().eq('business_id', businessId)
        await supabaseAdmin.from('notifications').delete().eq('business_id', businessId)
        await supabaseAdmin.from('notification_preferences').delete().eq('business_id', businessId)
        
        // Delete usage metrics and subscription events
        await supabaseAdmin.from('usage_metrics').delete().eq('business_id', businessId)
        await supabaseAdmin.from('subscription_events').delete().eq('business_id', businessId)
        
        // Delete all user business roles for this business
        await supabaseAdmin.from('user_business_roles').delete().eq('business_id', businessId)
        
        // Delete business invites
        await supabaseAdmin.from('business_invites').delete().eq('business_id', businessId)
        
        // TODO: Add deletion of your custom business-specific tables here
        // Examples:
        // await supabaseAdmin.from('projects').delete().eq('business_id', businessId)
        // await supabaseAdmin.from('tasks').delete().eq('business_id', businessId)
        // await supabaseAdmin.from('appointments').delete().eq('business_id', businessId)
        // await supabaseAdmin.from('clients').delete().eq('business_id', businessId)
        
        // Finally delete the business itself
        const { error: businessDeleteError } = await supabaseAdmin
          .from('businesses')
          .delete()
          .eq('id', businessId)
          
        if (businessDeleteError) {
          console.error('Error deleting business:', businessDeleteError)
          throw new Error(`Failed to delete business: ${businessId}`)
        }
        
        console.log('Successfully deleted business:', businessId)
      } catch (error) {
        console.error('Error deleting business data:', error)
        throw new Error(`Failed to delete business data for ${businessId}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    // Remove user from remaining businesses (where they're not the last owner)
    const { error: rolesDeleteError } = await supabaseAdmin
      .from('user_business_roles')
      .delete()
      .eq('user_id', user.id)

    if (rolesDeleteError) {
      console.error('Error removing user business roles:', rolesDeleteError)
      throw new Error('Failed to remove user from businesses')
    }

    // TODO: If you have a workers/team members table, unlink user here
    // Example:
    // await supabaseAdmin
    //   .from('team_members')
    //   .update({ user_id: null, status: 'inactive' })
    //   .eq('user_id', user.id)

    // Delete user's personal data
    await supabaseAdmin.from('push_tokens').delete().eq('user_id', user.id)
    await supabaseAdmin.from('notification_preferences').delete().eq('user_id', user.id)
    await supabaseAdmin.from('notifications').delete().eq('user_id', user.id)

    // TODO: Customize anonymization strategy
    // Option 1: Anonymize (keeps record for audit)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        display_name: 'Deleted User',
        first_name: null,
        last_name: null,
        phone: null,
        email: null
      })
      .eq('id', user.id)

    if (profileError) {
      console.error('Error anonymizing profile:', profileError)
      throw new Error('Failed to anonymize user profile')
    }

    // Option 2: Complete deletion (uncomment to use instead of anonymization)
    // await supabaseAdmin.from('profiles').delete().eq('id', user.id)
    // await supabaseAdmin.auth.admin.deleteUser(user.id)

    console.log('Account deletion completed successfully for user:', user.id)

    const response: DeleteAccountResponse = {
      success: true,
      message: 'Account deleted successfully',
      user_id: user.id,
      was_owner: isOwner,
      businesses_affected: businessesToDelete
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Account deletion error:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Account deletion failed',
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
