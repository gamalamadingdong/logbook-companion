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

type TrainingZone = 'UT2' | 'UT1' | 'AT' | 'TR' | 'AN' | null;

interface ProposalPayload {
  name: string;
  description: string;
  workout_type: string;
  training_zone?: TrainingZone;
  difficulty_level?: string;
  rwn: string;
  workout_structure: Record<string, unknown>;
  notes?: string;
  attribution_name?: string;
  attribution_contact?: string;
  turnstileToken: string;
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeOptionalString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > maxLength) {
    throw new Error(`Field exceeds ${maxLength} characters.`);
  }

  return trimmed;
}

function normalizeRequiredString(value: unknown, maxLength: number, fieldName: string): string {
  const normalized = normalizeOptionalString(value, maxLength);
  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }
  return normalized;
}

async function verifyTurnstileToken(secretKey: string, token: string, remoteIp: string | null) {
  const formData = new URLSearchParams({
    secret: secretKey,
    response: token,
  });

  if (remoteIp) {
    formData.set('remoteip', remoteIp);
  }

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    throw new Error(`Turnstile verification failed with status ${response.status}.`);
  }

  const result = await response.json() as { success?: boolean };
  return result.success === true;
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
    const turnstileSecretKey = Deno.env.get('TURNSTILE_SECRET_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey || !turnstileSecretKey) {
      return jsonResponse(500, { error: 'Missing required server configuration.' });
    }

    const payload = await req.json() as Partial<ProposalPayload>;
    const turnstileToken = normalizeRequiredString(payload.turnstileToken, 2048, 'Turnstile token');
    const remoteIpHeader = req.headers.get('CF-Connecting-IP') ?? req.headers.get('x-forwarded-for');
    const remoteIp = remoteIpHeader?.split(',')[0]?.trim() || null;
    const tokenValid = await verifyTurnstileToken(turnstileSecretKey, turnstileToken, remoteIp);

    if (!tokenValid) {
      return jsonResponse(400, { error: 'Bot verification failed. Please try again.' });
    }

    const proposal = {
      name: normalizeRequiredString(payload.name, 160, 'Workout name'),
      description: normalizeRequiredString(payload.description, 2000, 'Description'),
      workout_type: normalizeRequiredString(payload.workout_type, 50, 'Workout type'),
      training_zone: payload.training_zone ?? null,
      difficulty_level: normalizeRequiredString(payload.difficulty_level ?? 'intermediate', 40, 'Difficulty level'),
      rwn: normalizeRequiredString(payload.rwn, 500, 'RWN'),
      workout_structure: payload.workout_structure,
      notes: normalizeOptionalString(payload.notes, 2000),
      attribution_name: normalizeOptionalString(payload.attribution_name, 120),
      attribution_contact: normalizeOptionalString(payload.attribution_contact, 200),
    };

    if (!isObject(proposal.workout_structure)) {
      return jsonResponse(400, { error: 'workout_structure must be a JSON object.' });
    }

    if (proposal.training_zone && !['UT2', 'UT1', 'AT', 'TR', 'AN'].includes(proposal.training_zone)) {
      return jsonResponse(400, { error: 'Invalid training zone.' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let submittedByUserId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const jwt = authHeader.replace('Bearer ', '').trim();
      if (jwt) {
        const { data: { user } } = await supabase.auth.getUser(jwt);
        submittedByUserId = user?.id ?? null;
      }
    }

    const { data, error } = await supabase
      .from('workout_template_proposals')
      .insert({
        ...proposal,
        submitted_by_user_id: submittedByUserId,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[submit-template-proposal] Insert error:', error);
      return jsonResponse(500, { error: 'Failed to submit workout proposal.' });
    }

    fetch(`${supabaseUrl}/functions/v1/notify-template-proposal`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ proposalId: data.id }),
    }).catch((notifyError) => {
      console.error('[submit-template-proposal] Notification trigger failed:', notifyError);
    });

    return jsonResponse(200, { ok: true, proposalId: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    return jsonResponse(500, { error: message });
  }
});
