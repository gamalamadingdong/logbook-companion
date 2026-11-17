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

type InviteCoachesRequest = {
  teamId?: string;
  entries?: { email: string; firstName?: string; lastName?: string }[];
  emails?: string[]; // legacy fallback
  role?: 'coach' | 'coxswain';
  orgId?: string;
};

type InviteResult = {
  email: string;
  status: 'created' | 'added' | 'error';
  message?: string;
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

    if (!supabaseUrl || !supabaseServiceRoleKey) {
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

    // Verify the caller
    const {
      data: { user: caller },
      error: callerError,
    } = await supabase.auth.getUser(jwt);

    if (callerError || !caller) {
      return jsonResponse(401, { error: 'Invalid auth token.' });
    }

    const body = (await req.json()) as InviteCoachesRequest;
    const teamId = body.teamId?.trim();
    const role = body.role ?? 'coach';
    const orgId = body.orgId?.trim() || null;

    // Support both new entries[] format and legacy emails[] format
    const entries: { email: string; firstName: string; lastName: string }[] = body.entries
      ? body.entries.map((e) => ({
          email: (e.email || '').trim().toLowerCase(),
          firstName: (e.firstName || '').trim(),
          lastName: (e.lastName || '').trim(),
        }))
      : (body.emails || []).map((e) => ({ email: e.trim().toLowerCase(), firstName: '', lastName: '' }));

    if (!teamId) {
      return jsonResponse(400, { error: 'teamId is required.' });
    }

    if (entries.length === 0) {
      return jsonResponse(400, { error: 'entries (or emails) array is required and must not be empty.' });
    }

    if (entries.length > 50) {
      return jsonResponse(400, { error: 'Maximum 50 entries per request.' });
    }

    if (!['coach', 'coxswain'].includes(role)) {
      return jsonResponse(400, { error: 'role must be "coach" or "coxswain".' });
    }

    // Verify team administration before using the service-role client for writes.
    const { data: canAdmin, error: adminError } = await supabase.rpc('can_admin_team', {
      p_team_id: teamId, p_user_id: caller.id,
    });
    if (adminError) return jsonResponse(500, { error: 'Failed to validate team administration.' });
    if (canAdmin !== true) return jsonResponse(403, { error: 'Only team administrators can invite staff.' });

    // If orgId provided, verify the team belongs to the org
    if (orgId) {
      const { data: teamOrg } = await supabase
        .from('teams')
        .select('org_id')
        .eq('id', teamId)
        .single();

      if (teamOrg?.org_id !== orgId) {
        return jsonResponse(400, { error: 'Team does not belong to the specified organization.' });
      }
    }

    // Look up org name for email personalization
    let orgName = '';
    if (orgId) {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single();
      orgName = orgData?.name || '';
    }

    // Look up team name for email personalization
    const { data: teamData } = await supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single();
    const teamName = teamData?.name || '';

    const results: InviteResult[] = [];

    for (const entry of entries) {
      const email = entry.email;
      const firstName = entry.firstName;
      const lastName = entry.lastName;
      const displayName = [firstName, lastName].filter(Boolean).join(' ') || email.split('@')[0];

      if (!emailPattern.test(email)) {
        results.push({ email, status: 'error', message: 'Invalid email format.' });
        continue;
      }

      try {
        // Look up if user already exists via profile
        const { data: existingProfile } = await supabase
          .from('user_profiles')
          .select('user_id, display_name, email')
          .ilike('email', email)
          .maybeSingle();

        let userId: string;
        let wasNewUser = false;

        const inviteData_metadata = {
          invited_as: role,
          first_name: firstName,
          last_name: lastName,
          org_name: orgName,
          team_name: teamName,
        };

        if (existingProfile) {
          // Verify the auth user still exists (profile may be orphaned if user was deleted from dashboard)
          const { data: { user: authCheck } } = await supabase.auth.admin.getUserById(existingProfile.user_id);
          if (authCheck) {
            userId = existingProfile.user_id;
            // Update display name if names were provided and current is just email prefix
            if (firstName && existingProfile.display_name === existingProfile.email?.split('@')[0]) {
              await supabase.from('user_profiles').update({ display_name: displayName }).eq('user_id', userId);
            }
          } else {
            // Orphaned profile — clean it up and invite fresh
            await supabase.from('user_profiles').delete().eq('user_id', existingProfile.user_id);

            const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
              email,
              {
                data: inviteData_metadata,
                redirectTo: `${Deno.env.get('SITE_URL') || 'https://logbook.readyall.org'}/auth/callback?next=${encodeURIComponent('/reset-password?type=invite')}`,
              },
            );

            if (inviteError) {
              results.push({ email, status: 'error', message: inviteError.message });
              continue;
            }

            userId = inviteData.user.id;
            wasNewUser = true;

            await supabase.from('user_profiles').upsert({
              user_id: userId,
              email: email,
              display_name: displayName,
              preferences: { onboarding_complete: true },
            }, { onConflict: 'user_id' });
          }
        } else {
          // Invite via Supabase — sends a branded invite email.
          const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
            email,
            {
              data: inviteData_metadata,
              redirectTo: `${Deno.env.get('SITE_URL') || 'https://logbook.readyall.org'}/auth/callback?next=${encodeURIComponent('/reset-password?type=invite')}`,
            },
          );

          if (inviteError) {
            // User might exist in auth but not in profiles
            if (inviteError.message?.toLowerCase().includes('already been registered') ||
                inviteError.message?.toLowerCase().includes('already registered')) {
              const { data: { users } } = await supabase.auth.admin.listUsers();
              const authUser = users?.find((u: { email?: string }) => u.email?.toLowerCase() === email);
              if (authUser) {
                userId = authUser.id;
                await supabase
                  .from('user_profiles')
                  .upsert({
                    user_id: authUser.id,
                    email: email,
                    display_name: displayName,
                  }, { onConflict: 'user_id' });
              } else {
                results.push({ email, status: 'error', message: inviteError.message });
                continue;
              }
            } else {
              results.push({ email, status: 'error', message: inviteError.message });
              continue;
            }
          } else {
            userId = inviteData.user.id;
            wasNewUser = true;

            // Create user_profiles row — skip onboarding for invited coaches
            await supabase
              .from('user_profiles')
              .upsert({
                user_id: userId,
                email: email,
                display_name: displayName,
                preferences: { onboarding_complete: true },
              }, { onConflict: 'user_id' });
          }
        }

        // Check if already a team member
        const { data: existingMember } = await supabase
          .from('team_members')
          .select('id, role')
          .eq('team_id', teamId)
          .eq('user_id', userId)
          .maybeSingle();

        if (existingMember) {
          if (existingMember.role === 'coxswain' || existingMember.role === 'member') {
            const { error: linkError } = await supabase.rpc('ensure_team_member_athlete_link', {
              p_team_id: teamId, p_user_id: userId,
            });
            if (linkError) {
              results.push({ email, status: 'error', message: 'Existing membership could not be linked to its athlete roster. Retry this invitation.' });
              continue;
            }
          }
          results.push({
            email,
            status: 'added',
            message: `Already a team member (${existingMember.role}).`,
          });
          continue;
        }

        // Add to team
        const { error: teamInsertError } = await supabase
          .from('team_members')
          .insert({
            team_id: teamId,
            user_id: userId,
            role: role,
            is_admin: false,
          });

        if (teamInsertError) {
          results.push({ email, status: 'error', message: teamInsertError.message });
          continue;
        }

        // Staff invitations are team-scoped; never grant club membership implicitly.
        if (role === 'coxswain') {
          const { error: linkError } = await supabase.rpc('ensure_team_member_athlete_link', {
            p_team_id: teamId, p_user_id: userId,
          });
          if (linkError) {
            results.push({ email, status: 'error', message: 'Team access saved, but athlete roster linking failed. Review this member before retrying.' });
            continue;
          }
        }

        results.push({
          email,
          status: wasNewUser ? 'created' : 'added',
          message: wasNewUser
            ? 'Invite email sent — they\'ll receive a link to set their password.'
            : 'Existing user added to team.',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unexpected error';
        results.push({ email, status: 'error', message });
      }
    }

    const created = results.filter((r) => r.status === 'created').length;
    const added = results.filter((r) => r.status === 'added').length;
    const errors = results.filter((r) => r.status === 'error').length;

    return jsonResponse(200, {
      ok: true,
      summary: { created, added, errors, total: results.length },
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error.';
    console.error('[invite-coaches] Unhandled error:', message);
    return jsonResponse(500, { error: message });
  }
});
