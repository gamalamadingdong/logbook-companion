// @ts-expect-error -- Deno resolves remote URL imports at runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type InviteRequest = {
  teamId?: string;
  recipientEmail?: string;
  inviteCode?: string;
  inviteUrl?: string;
  teamName?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
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
    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'invites@mail.readyall.org';

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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return jsonResponse(401, { error: 'Invalid auth token.' });
    }

    const body = (await req.json()) as InviteRequest;
    const teamId = body.teamId?.trim();
    const recipientEmail = body.recipientEmail?.trim().toLowerCase();

    if (!teamId || !recipientEmail) {
      return jsonResponse(400, { error: 'teamId and recipientEmail are required.' });
    }

    if (!emailPattern.test(recipientEmail)) {
      return jsonResponse(400, { error: 'Invalid recipient email.' });
    }

    const { data: member, error: memberError } = await supabase
      .from('team_members')
      .select('role, teams(name, invite_code)')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (memberError) {
      return jsonResponse(500, { error: 'Failed to validate team membership.' });
    }

    if (!member || !['coach', 'coxswain'].includes(member.role)) {
      return jsonResponse(403, { error: 'Only coaches/coxswains can send invites.' });
    }

    const team = member.teams as { name?: string; invite_code?: string } | null;
    const inviteCode = body.inviteCode?.trim() || team?.invite_code;
    const teamName = body.teamName?.trim() || team?.name || 'Your team';

    if (!inviteCode) {
      return jsonResponse(400, { error: 'Invite code is required.' });
    }

    const inviteUrl = body.inviteUrl?.trim() || `https://log.readyall.org/join?code=${encodeURIComponent(inviteCode)}`;

    const senderName = escapeHtml(teamName);
    const safeInviteUrl = escapeHtml(inviteUrl);

    const emailPayload = {
      from: `ReadyAll <${resendFromEmail}>`,
      to: [recipientEmail],
      subject: `${teamName} invited you to join their team on ReadyAll`,
      html: `
        <div style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.6; color: #111827;">
          <h2 style="margin: 0 0 12px;">You have a team invite</h2>
          <p style="margin: 0 0 12px;"><strong>${senderName}</strong> invited you to join their team on ReadyAll.</p>
          <p style="margin: 0 0 16px;">Use invite code <strong>${escapeHtml(inviteCode)}</strong> or click below:</p>
          <p style="margin: 0 0 20px;">
            <a href="${safeInviteUrl}" style="display: inline-block; padding: 10px 16px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">Join Team</a>
          </p>
          <p style="margin: 0; color: #4b5563; font-size: 14px;">If the button doesn't work, copy this URL:</p>
          <p style="margin: 6px 0 0; color: #1f2937; font-size: 14px; word-break: break-all;">${safeInviteUrl}</p>
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
      console.error('[send-team-invite] Resend rejected request', {
        status: resendResponse.status,
        body: errText,
        recipientEmail,
        from: resendFromEmail,
      });
      return jsonResponse(502, {
        error: 'Failed to send invite email.',
        providerStatus: resendResponse.status,
        providerBody: errText,
      });
    }

    const resendData = (await resendResponse.json()) as { id?: string };

    return jsonResponse(200, {
      ok: true,
      id: resendData.id ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error.';
    return jsonResponse(500, { error: message });
  }
});
