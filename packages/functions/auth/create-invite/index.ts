/**
 * Create Business Invite - Supabase Edge Function
 * 
 * PURPOSE:
 * Creates invitation codes for users to join a business with a specific role.
 * Optionally sends invitation email via Resend if configured.
 * 
 * USAGE:
 * POST /functions/v1/create-invite
 * Body: { businessId, email, role, inviterId, inviterName, businessName }
 * 
 * CUSTOMIZATION POINTS:
 * 1. Update default role (currently 'employee')
 * 2. Customize invite expiration (currently 7 days)
 * 3. Update email template HTML (see line 95)
 * 4. Change email sender domain (see line 105)
 * 5. Adjust SITE_URL for your domain
 * 
 * DEPENDENCIES:
 * - Supabase service role key (required)
 * - Resend API key (optional - for email sending)
 * - business_invites table (from core schema)
 * 
 * EXTRACTED FROM: ScheduleBoard v2
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

// TODO: Update this to your production domain
const SITE_URL = Deno.env.get('SITE_URL') || 'http://localhost:8080';

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
    const { businessId, email, role, inviterId, inviterName, businessName } = body || {};

    // TODO: Customize default role for your application
    // Options: 'owner', 'admin', 'manager', 'employee', 'viewer', 'user'
    const canonicalRole = role || 'employee';
    const prettyRole = canonicalRole.charAt(0).toUpperCase() + canonicalRole.slice(1);

    // Validate required fields
    if (!businessId || !email || !inviterId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: businessId, email, inviterId' }), 
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Generate invite code and expiration
    const inviteCode = crypto.randomUUID();
    const expiresAt = new Date();
    
    // TODO: Customize expiration period (currently 7 days)
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Insert invite into database (uses service role to bypass RLS)
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('business_invites')
      .insert({
        business_id: businessId,
        email,
        role: canonicalRole,
        invite_code: inviteCode,
        expires_at: expiresAt.toISOString(),
        created_by_user_id: inviterId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting invite:', insertError);
      return new Response(
        JSON.stringify({ error: insertError.message || 'Failed to create invite' }), 
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Send invitation email if Resend is configured
    if (RESEND_API_KEY) {
      try {
        const inviteUrl = `${SITE_URL.replace(/\/$/, '')}/accept-invite?invite=${inviteCode}`;

        // TODO: Customize email template for your brand
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You've been invited!</h2>
            <p>${inviterName || 'A team member'} invited you to join <strong>${businessName || 'their business'}</strong> as a <strong>${prettyRole}</strong>.</p>
            <p style="margin: 30px 0;">
              <a href="${inviteUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Accept Invitation
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">This invite expires in 7 days.</p>
            <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="color: #666; font-size: 12px; word-break: break-all;">${inviteUrl}</p>
          </div>
        `;

        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // TODO: Update sender email domain to match your verified Resend domain
            from: `${businessName || 'Team'} <onboarding@yourdomain.com>`,
            to: [email],
            subject: `${inviterName || 'Team'} invited you to ${businessName || 'join the team'} as ${prettyRole}`,
            html,
          }),
        });

        if (!resp.ok) {
          const text = await resp.text().catch(() => 'resend error');
          // Rollback: delete the invite if email fails
          await supabaseAdmin.from('business_invites').delete().eq('id', inserted.id);
          console.error('Resend email failed:', resp.status, text);
          return new Response(
            JSON.stringify({ error: 'Failed to send invitation email' }), 
            { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        console.log('Invitation email sent successfully to:', email);
      } catch (e) {
        // Rollback: delete the invite if email fails
        await supabaseAdmin.from('business_invites').delete().eq('id', inserted.id);
        console.error('Error sending invite email:', e);
        return new Response(
          JSON.stringify({ error: 'Failed to send invitation email' }), 
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, inviteCode }), 
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Create-invite error:', error);
    return new Response(
      JSON.stringify({ error: (error instanceof Error) ? error.message : 'Unknown error' }), 
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
