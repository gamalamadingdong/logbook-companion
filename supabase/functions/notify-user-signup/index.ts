// @ts-expect-error -- Deno resolves remote URL imports at runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'notifications@mail.readyall.org';
    const adminEmail = Deno.env.get('ADMIN_NOTIFICATION_EMAIL') ?? 'samdgammon@gmail.com';

    if (!supabaseUrl || !supabaseServiceRoleKey || !resendApiKey) {
      return jsonResponse(500, { error: 'Missing required server configuration.' });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse(401, { error: 'Missing authorization token.' });
    }

    const jwt = authHeader.replace('Bearer ', '').trim();
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return jsonResponse(401, { error: 'Invalid auth token.' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .eq('user_id', user.id)
      .select('display_name, email, created_at, admin_signup_notified_at')
      .maybeSingle();

    if (profileError) {
      console.error('[notify-user-signup] Select error:', profileError);
      return jsonResponse(500, { error: 'Failed to load user profile.' });
    }

    if (!profile || profile.admin_signup_notified_at) {
      return jsonResponse(200, { ok: true, skipped: true });
    }

    const safeName = escapeHtml(profile.display_name || user.email || 'Unknown user');
    const safeEmail = escapeHtml(profile.email || user.email || 'unknown');
    const createdAt = profile.created_at
      ? new Date(profile.created_at).toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })
      : 'Unknown';

    const emailPayload = {
      from: `ReadyAll <${resendFromEmail}>`,
      to: [adminEmail],
      subject: `New ReadyAll signup: ${profile.display_name || user.email || 'Unknown user'}`,
      html: `
        <div style="font-family: Inter, system-ui, -apple-system, sans-serif; line-height: 1.6; color: #111827; max-width: 560px;">
          <h2 style="margin: 0 0 16px;">New ReadyAll Signup</h2>
          <table style="border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 8px 12px; color: #6b7280; font-size: 14px;">Name</td><td style="padding: 8px 12px; font-weight: 600;">${safeName}</td></tr>
            <tr><td style="padding: 8px 12px; color: #6b7280; font-size: 14px;">Email</td><td style="padding: 8px 12px;">${safeEmail}</td></tr>
            <tr><td style="padding: 8px 12px; color: #6b7280; font-size: 14px;">Created</td><td style="padding: 8px 12px;">${escapeHtml(createdAt)} UTC</td></tr>
          </table>
          <p style="margin: 16px 0 0; font-size: 14px; color: #6b7280;">This alert fires once per user profile after the first successful profile creation.</p>
        </div>
      `,
    };

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      console.error('[notify-user-signup] Resend error:', { status: resendResponse.status, body: errText });
      return jsonResponse(502, { error: 'Failed to send signup notification email.' });
    }

    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ admin_signup_notified_at: nowIso })
      .eq('user_id', user.id)
      .is('admin_signup_notified_at', null);

    if (updateError) {
      console.error('[notify-user-signup] Post-send update error:', updateError);
      return jsonResponse(500, { error: 'Notification email sent, but profile state update failed.' });
    }

    return jsonResponse(200, { ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected server error.';
    return jsonResponse(500, { error: msg });
  }
});
