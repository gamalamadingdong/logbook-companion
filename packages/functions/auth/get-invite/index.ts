/**
 * Get Invite Details - Supabase Edge Function
 * 
 * PURPOSE:
 * Retrieves invitation details by invite code for preview before acceptance.
 * Used to display business name, role, and inviter information to the user.
 * 
 * USAGE:
 * POST /functions/v1/get-invite
 * Body: { inviteCode }
 * 
 * RESPONSE:
 * {
 *   success: true,
 *   data: {
 *     id, business_id, role, email, invite_code, expires_at,
 *     businesses: { id, name, display_name }
 *   }
 * }
 * 
 * CUSTOMIZATION POINTS:
 * 1. Add additional business fields to select (line 61)
 * 2. Add custom validation logic (line 75+)
 * 3. Remove employee lookup if not needed (line 79-88)
 * 
 * DEPENDENCIES:
 * - Supabase service role key (required)
 * - business_invites table
 * - businesses table
 * 
 * EXTRACTED FROM: ScheduleBoard v2
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : undefined;

// TODO: Update ALLOW_ORIGIN for production
const ALLOW_ORIGIN = Deno.env.get('ALLOW_ORIGIN') || 'http://localhost:8080';
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (!supabaseAdmin) {
      return new Response(
        JSON.stringify({ error: 'Supabase admin client not configured' }), 
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }), 
        { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const body = await req.json();
    const { inviteCode } = body || {};
    
    if (!inviteCode) {
      return new Response(
        JSON.stringify({ error: 'Missing inviteCode' }), 
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Lookup the invitation
    // TODO: Add any additional business fields you need for your UI
    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from('business_invites')
      .select(`
        *,
        businesses (
          id,
          name,
          display_name
        )
      `)
      .eq('invite_code', inviteCode)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (inviteErr || !invite) {
      return new Response(
        JSON.stringify({ error: 'Invite not found or expired' }), 
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // TODO: Add custom validation logic here if needed
    // Examples:
    // - Check if business is active
    // - Verify business subscription status
    // - Check if inviter still has permission to invite

    // TODO: If you have a "workers" or "team members" table, you can look it up here
    // This example shows how ScheduleBoard looked up employee records
    // Remove this section if not needed for your app
    let additionalData = null;
    if (invite.email) {
      // Example: Look up if user already exists in your team members table
      // const { data: member } = await supabaseAdmin
      //   .from('team_members')
      //   .select('id, name, email, role')
      //   .eq('business_id', invite.business_id)
      //   .eq('email', invite.email)
      //   .maybeSingle();
      // 
      // additionalData = member;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          ...invite,
          // Include any additional data
          additional_data: additionalData
        }
      }), 
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('get-invite error:', error);
    return new Response(
      JSON.stringify({ error: (error instanceof Error) ? error.message : 'Unknown error' }), 
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
