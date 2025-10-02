/**
 * Send Invite Email - Supabase Edge Function
 * 
 * PURPOSE:
 * Sends invitation emails via Resend email service.
 * Includes invitation link and business information.
 * 
 * USAGE:
 * POST /functions/v1/send-invite-email
 * Body: { email, role, businessName, inviteCode, inviterName }
 * 
 * CUSTOMIZATION POINTS:
 * 1. Update email template HTML (line 68-94)
 * 2. Change sender email domain (line 97)
 * 3. Customize subject line (line 98)
 * 4. Add your branding/logo
 * 5. Update SITE_URL for your domain (line 65)
 * 
 * DEPENDENCIES:
 * - Resend API key (required)
 * - Verified sender domain in Resend
 * 
 * EXTRACTED FROM: ScheduleBoard v2
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// TODO: Update ALLOW_ORIGIN for production
const ALLOW_ORIGIN = Deno.env.get('ALLOW_ORIGIN') || 'http://localhost:8080';
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface InviteEmailRequest {
  email: string;
  role: string;
  businessName: string;
  inviteCode: string;
  inviterName: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { email, role, businessName, inviteCode, inviterName }: InviteEmailRequest = await req.json();

    // Validate and sanitize email address
    const sanitizedEmail = (email || '').toString().trim();
    const isValidEmail = (addr: string) => {
      // Simple RFC5322-ish validation
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr);
    }

    if (!sanitizedEmail || !isValidEmail(sanitizedEmail)) {
      console.error('Invalid recipient email:', sanitizedEmail);
      return new Response(
        JSON.stringify({ 
          name: 'validation_error', 
          message: 'Invalid email address' 
        }), 
        {
          status: 422,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // TODO: Update SITE_URL to your production domain
    const inviteUrl = `${Deno.env.get('SITE_URL')||'http://localhost:8080'}/accept-invite?invite=${inviteCode}`;

    // TODO: Customize email template with your branding
    const emailResponse = await resend.emails.send({
      // TODO: Update sender domain to your verified Resend domain
      from: `${businessName} <onboarding@yourdomain.com>`,
      to: sanitizedEmail,
      subject: `You're invited to join ${businessName}`,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1f2937; font-size: 24px; margin: 0;">You're Invited!</h1>
          </div>
          
          <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
            <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px;">
              <strong>${inviterName}</strong> has invited you to join <strong>${businessName}</strong> as a <strong>${role}</strong>.
            </p>
            
            <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 14px;">
              Click the button below to accept your invitation and create your account.
            </p>
            
            <div style="text-align: center;">
              <a href="${inviteUrl}" 
                 style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
                Accept Invitation
              </a>
            </div>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 16px;">
            <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
              This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
          
          <!-- TODO: Add your logo here -->
          <!-- <div style="text-align: center; margin-top: 20px;">
            <img src="https://yourdomain.com/logo.png" alt="Logo" style="height: 30px;">
          </div> -->
        </div>
      `,
    });

    console.log("Invite email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify(emailResponse), 
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error in send-invite-email function:", message);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
