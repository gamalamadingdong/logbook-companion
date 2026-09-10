import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '../services/supabase';
import { resolvedAuthorizationRedirect } from './oauthConsentFlow';

/**
 * /oauth/consent — Authorization UI for Supabase OAuth 2.1 Server.
 *
 * When a third-party OAuth client (e.g. ChatGPT's MCP connector) initiates the
 * authorization-code flow against Supabase Auth's /oauth/authorize endpoint,
 * Supabase validates the request and redirects the user here with an
 * `authorization_id` query parameter. This page:
 *
 *   1. Reads `authorization_id`.
 *   2. Ensures the user is signed in (bounces to /login preserving return path).
 *   3. Fetches client + requested-scope details.
 *   4. Shows a consent screen (approve / deny).
 *   5. On approve/deny, Supabase returns a redirect URL back to the client.
 *
 * Configured via dashboard: Site URL = https://logbook.readyall.org,
 * Authorization Path = /oauth/consent. This route MUST be public in App.tsx
 * (it manages its own session gate), never wrapped in ProtectedRoute.
 */

interface AuthorizationDetails {
    client?: {
        name?: string;
        client_name?: string;
        logo_uri?: string;
        client_uri?: string;
    };
    scope?: string;
    redirect_uri?: string;
}

const SCOPE_LABELS: Record<string, string> = {
    openid: 'Confirm your identity',
    email: 'Read your email address',
    profile: 'Read your basic profile',
    phone: 'Read your phone number',
};

export function OAuthConsent() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'ready' | 'submitting' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);
    const [details, setDetails] = useState<AuthorizationDetails | null>(null);

    const authorizationId = searchParams.get('authorization_id');

    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (!authorizationId) {
                setError('Missing authorization request. This page is only reached during a sign-in request from a connected app.');
                setStatus('error');
                return;
            }

            // Require an active session; if absent, send to login and come back here.
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                const returnTo = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
                navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
                return;
            }

            try {
                const { data, error: detailsError } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
                if (detailsError) throw detailsError;
                if (cancelled) return;
                const redirectUri = resolvedAuthorizationRedirect(data);
                if (redirectUri) {
                    window.location.assign(redirectUri);
                    return;
                }
                setDetails((data ?? {}) as AuthorizationDetails);
                setStatus('ready');
            } catch (err) {
                if (cancelled) return;
                console.error('[oauth/consent] getAuthorizationDetails failed:', err);
                setError((err as Error).message || 'Could not load the authorization request.');
                setStatus('error');
            }
        }

        void load();
        return () => { cancelled = true; };
    }, [authorizationId, navigate]);

    async function decide(approve: boolean) {
        if (!authorizationId) return;
        setStatus('submitting');
        try {
            const { data, error: decideError } = approve
                ? await supabase.auth.oauth.approveAuthorization(authorizationId)
                : await supabase.auth.oauth.denyAuthorization(authorizationId);
            if (decideError) throw decideError;

            const redirectUrl = (data as { redirect_url?: string } | null)?.redirect_url;
            if (redirectUrl) {
                window.location.href = redirectUrl;
                return;
            }
            // No redirect returned — surface a clear terminal state.
            setError('The connected app did not provide a return URL. You can close this window.');
            setStatus('error');
        } catch (err) {
            console.error('[oauth/consent] decision failed:', err);
            setError((err as Error).message || 'Could not complete the authorization.');
            setStatus('error');
        }
    }

    const clientName = details?.client?.client_name || details?.client?.name || 'A connected app';
    const scopes = (details?.scope ?? '').split(/\s+/).filter(Boolean);

    if (status === 'error') {
        return (
            <Shell>
                <div className="inline-flex p-3 bg-red-500/10 rounded-full text-red-400 mb-4">
                    <AlertCircle size={32} />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Authorization Problem</h2>
                <p className="text-neutral-400 text-sm mb-6">{error}</p>
                <button
                    onClick={() => navigate('/')}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-lg transition-colors"
                >
                    Go to Logbook
                </button>
            </Shell>
        );
    }

    if (status === 'loading') {
        return (
            <Shell>
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-4" />
                <p className="text-neutral-400 text-sm">Loading authorization request…</p>
            </Shell>
        );
    }

    return (
        <Shell>
            <div className="inline-flex p-3 bg-indigo-500/10 rounded-full text-indigo-400 mb-4">
                <ShieldCheck size={32} />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Authorize access</h2>
            <p className="text-neutral-400 text-sm mb-5">
                <span className="text-white font-medium">{clientName}</span> wants to access your
                Logbook Companion data.
            </p>

            <div className="text-left bg-neutral-950/60 border border-neutral-800 rounded-lg p-4 mb-6">
                <p className="text-neutral-500 text-xs uppercase tracking-wide mb-2">This will allow it to</p>
                <ul className="space-y-1.5">
                    {scopes.length === 0 && (
                        <li className="text-neutral-300 text-sm">Read your training data on your behalf</li>
                    )}
                    {scopes.map((scope) => (
                        <li key={scope} className="text-neutral-300 text-sm flex items-start gap-2">
                            <span className="text-indigo-400 mt-0.5">•</span>
                            <span>{SCOPE_LABELS[scope] ?? scope}</span>
                        </li>
                    ))}
                    <li className="text-neutral-300 text-sm flex items-start gap-2">
                        <span className="text-indigo-400 mt-0.5">•</span>
                        <span>Read your workout history (subject to your account permissions)</span>
                    </li>
                </ul>
            </div>

            <div className="flex gap-3">
                <button
                    onClick={() => decide(false)}
                    disabled={status === 'submitting'}
                    className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold py-3 rounded-lg transition-colors disabled:opacity-60"
                >
                    Deny
                </button>
                <button
                    onClick={() => decide(true)}
                    disabled={status === 'submitting'}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                    {status === 'submitting' && <Loader2 className="w-4 h-4 animate-spin" />}
                    Allow
                </button>
            </div>
        </Shell>
    );
}

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full text-center">
                {children}
            </div>
        </div>
    );
}

export default OAuthConsent;
