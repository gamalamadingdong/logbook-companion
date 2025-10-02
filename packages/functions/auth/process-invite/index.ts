/**
 * Process Business Invite - Supabase Edge Function
 * 
 * PURPOSE:
 * Processes an invitation code to add a user to a business with a specific role.
 * Can optionally create a new user account if needed (bypasses rate limits).
 * 
 * USAGE:
 * POST /functions/v1/process-invite
 * Body: { inviteCode, email, password, firstName, lastName, createUser }
 * 
 * FLOWS:
 * 1. New User: createUser=true + email + password → Creates user + adds to business
 * 2. Existing User: createUser=false + authenticated → Adds user to business
 * 
 * CUSTOMIZATION POINTS:
 * 1. Customize valid roles array (line 111)
 * 2. Add custom profile fields (line 145)
 * 3. Add business-specific onboarding logic (line 172+)
 * 4. Customize success response data (line 190)
 * 
 * DEPENDENCIES:
 * - Supabase service role key (required)
 * - business_invites table
 * - profiles table
 * - user_business_roles table
 * 
 * EXTRACTED FROM: ScheduleBoard v2
 * NOTE: Removed employee-specific logic - add your own domain models as needed
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { inviteCode, email, password, firstName, lastName, createUser } = await req.json()

    console.log('Process invite request:', { inviteCode, email, createUser, firstName, lastName })

    if (!inviteCode) {
      return new Response(
        JSON.stringify({ error: 'Missing inviteCode' }),
        { 
          status: 400, 
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

    // Lookup the invitation
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('business_invites')
      .select(`
        id,
        business_id,
        role,
        email,
        invite_code,
        businesses:business_id (
          id,
          name,
          display_name
        )
      `)
      .eq('invite_code', inviteCode)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (inviteError || !invite) {
      console.log('Invite lookup failed:', { inviteError, invite, inviteCode })
      return new Response(
        JSON.stringify({ error: 'Invalid or expired invite' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Found valid invite:', invite.id)

    let userId: string | null = null;

    // Create user if requested (bypasses client-side rate limits)
    if (createUser && email && password) {
      console.log('Creating new user account...')
      
      const { data: authUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          invite_signup: true,
          invite_code: inviteCode,
        },
        email_confirm: true, // Skip email verification for invited users
      })

      if (createUserError) {
        console.error('User creation error:', createUserError)
        return new Response(
          JSON.stringify({ error: `Failed to create user: ${createUserError.message}` }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      userId = authUser.user.id
      console.log('User created:', userId)
    }

    // If not creating user, expect them to be authenticated
    if (!userId && !createUser) {
      return new Response(
        JSON.stringify({ error: 'Either createUser must be true or user must be authenticated' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user already has access to this business
    const { data: existingRole } = await supabaseAdmin
      .from('user_business_roles')
      .select('id, role')
      .eq('user_id', userId)
      .eq('business_id', invite.business_id)
      .eq('status', 'active')
      .maybeSingle()

    if (existingRole) {
      console.log('User already has access to this business')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'User already has access to this business',
          alreadyMember: true,
          role: existingRole.role,
          userId
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create/update user profile using service role (bypasses RLS)
    console.log('Creating/updating user profile...')
    
    // TODO: Customize profile fields for your application
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        display_name: `${firstName || ''} ${lastName || ''}`.trim() || 'Team Member',
        email: email || invite.email,
        first_name: firstName,
        last_name: lastName,
        phone: null, // Can be added later when user updates their profile
      }, {
        onConflict: 'id'
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      throw profileError
    }

    // TODO: Customize valid roles for your application
    const validRoles = ['owner', 'admin', 'manager', 'employee', 'viewer', 'user']
    const canonicalRole = (invite.role && validRoles.includes(invite.role)) ? invite.role : 'employee'

    // Create user business role (grants access to the business)
    console.log('Creating user business role:', canonicalRole)
    
    const { error: roleError } = await supabaseAdmin
      .from('user_business_roles')
      .insert({
        user_id: userId,
        business_id: invite.business_id,
        role: canonicalRole,
        status: 'active'
      })

    if (roleError) {
      console.error('Role creation error:', roleError)
      throw roleError
    }

    // TODO: Add your custom onboarding logic here
    // Examples:
    // - Create worker/team member record
    // - Send welcome notification
    // - Assign to default team
    // - Set up initial preferences
    // 
    // Example from ScheduleBoard (removed):
    // - Created/linked employee record for field workers
    // - Set availability status
    // - Assigned skills
    
    console.log('Custom onboarding logic would go here...')

    // Mark invite as accepted
    const { error: updateInviteError } = await supabaseAdmin
      .from('business_invites')
      .update({
        status: 'accepted',
        used_by_user_id: userId,
        used_at: new Date().toISOString()
      })
      .eq('id', invite.id)
      .eq('status', 'pending')

    if (updateInviteError) {
      console.error('Failed to mark invite as accepted:', updateInviteError)
      // Don't fail the whole process for this
    }

    console.log('Invite processed successfully')

    // TODO: Customize success response data
    return new Response(
      JSON.stringify({ 
        success: true,
        businessId: invite.business_id,
        businessName: invite.businesses?.display_name || invite.businesses?.name,
        role: canonicalRole,
        userId,
        userCreated: !!createUser
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Process invite error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({ error: message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
