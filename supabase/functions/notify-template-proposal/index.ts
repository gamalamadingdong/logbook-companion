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

    const body = await req.json();
    const proposalId = typeof body.proposalId === 'string' ? body.proposalId.trim() : '';

    if (!/^[0-9a-f-]{36}$/i.test(proposalId)) {
      return jsonResponse(400, { error: 'proposalId must be a valid UUID.' });
    }

    const nowIso = new Date().toISOString();
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: proposal, error: proposalError } = await supabase
      .from('workout_template_proposals')
      .update({ admin_notified_at: nowIso })
      .eq('id', proposalId)
      .is('admin_notified_at', null)
      .eq('status', 'pending')
      .select('name, description, rwn, training_zone, attribution_name, attribution_contact, created_at')
      .maybeSingle();

    if (proposalError) {
      console.error('[notify-workout-template-proposal] Update/select error:', proposalError);
      return jsonResponse(500, { error: 'Failed to load workout proposal.' });
    }

    if (!proposal) {
      return jsonResponse(200, { ok: true, skipped: true });
    }

    const safeName = escapeHtml(proposal.name);
    const safeDescription = escapeHtml(proposal.description);
    const safeRwn = escapeHtml(proposal.rwn);
    const safeAttributionName = proposal.attribution_name ? escapeHtml(proposal.attribution_name) : 'Anonymous / not provided';
    const safeAttributionContact = proposal.attribution_contact ? escapeHtml(proposal.attribution_contact) : 'Not provided';
    const safeZone = proposal.training_zone ? escapeHtml(proposal.training_zone) : 'Unspecified';
    const submittedAt = new Date(proposal.created_at).toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' });

    const emailPayload = {
      from: `ReadyAll <${resendFromEmail}>`,
      to: [adminEmail],
      subject: `New workout template proposal: ${proposal.name}`,
      html: `
        <div style="font-family: Inter, system-ui, -apple-system, sans-serif; line-height: 1.6; color: #111827; max-width: 640px;">
          <h2 style="margin: 0 0 16px;">New Workout Template Proposal</h2>
          <table style="border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 8px 12px; color: #6b7280; font-size: 14px;">Name</td><td style="padding: 8px 12px; font-weight: 600;">${safeName}</td></tr>
            <tr><td style="padding: 8px 12px; color: #6b7280; font-size: 14px;">Submitted</td><td style="padding: 8px 12px;">${escapeHtml(submittedAt)} UTC</td></tr>
            <tr><td style="padding: 8px 12px; color: #6b7280; font-size: 14px;">Training Zone</td><td style="padding: 8px 12px;">${safeZone}</td></tr>
            <tr><td style="padding: 8px 12px; color: #6b7280; font-size: 14px;">Attribution</td><td style="padding: 8px 12px;">${safeAttributionName}</td></tr>
            <tr><td style="padding: 8px 12px; color: #6b7280; font-size: 14px;">Contact</td><td style="padding: 8px 12px;">${safeAttributionContact}</td></tr>
          </table>
          <div style="margin: 16px 0; padding: 12px 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
            <div style="margin: 0 0 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280;">Description</div>
            <p style="margin: 0; white-space: pre-wrap;">${safeDescription}</p>
          </div>
          <div style="margin: 16px 0; padding: 12px 16px; background: #062f1f; border-radius: 8px; border: 1px solid #14532d;">
            <div style="margin: 0 0 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #86efac;">RWN</div>
            <p style="margin: 0; white-space: pre-wrap; color: #d1fae5; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">${safeRwn}</p>
          </div>
          <p style="margin: 16px 0 0; font-size: 14px; color: #6b7280;">Review proposals at <a href="https://log.readyall.org/library/review" style="color: #2563eb;">ReadyAll workout review</a>.</p>
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
      console.error('[notify-workout-template-proposal] Resend error:', { status: resendResponse.status, body: errText });
    }

    return jsonResponse(200, { ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected server error.';
    return jsonResponse(500, { error: msg });
  }
});
