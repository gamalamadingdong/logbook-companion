import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { safeLocalRoute } from '../services/nativeNavigation';

/**
 * /auth/callback — PKCE code exchange handler.
 *
 * Supabase redirects here with ?code=... after verifying an invite/recovery link.
 * We exchange the code for a session, then redirect to the intended destination.
 *
 * For invite links:  redirects to /reset-password?type=invite
 * For recovery links: redirects to /reset-password
 * For login links:    redirects to /
 */
export function AuthCallback() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [error, setError] = useState<string | null>(null);
    const attempt = useRef<{ code: string; promise: ReturnType<typeof supabase.auth.exchangeCodeForSession> } | null>(null);

    useEffect(() => {
        const code = searchParams.get('code');
        const next = safeLocalRoute(searchParams.get('next'));

        window.history.replaceState(window.history.state, '', '/auth/callback');
        if (!code || searchParams.has('error')) {
            setError('No authorization code found in the URL.');
            return;
        }

        let active = true;
        if (attempt.current?.code !== code) {
            attempt.current = { code, promise: supabase.auth.exchangeCodeForSession(code) };
        }
        void attempt.current.promise.then(({ error: exchangeError }) => {
            if (!active) return;
            if (exchangeError) {
                console.error('[auth/callback] Code exchange failed.');
                setError(exchangeError.message);
                return;
            }
            // Redirect to intended destination
            navigate(next, { replace: true });
        }).catch(() => {
            if (active) setError('Unable to verify this link. Check your connection and request a new link.');
        });
        return () => { active = false; };
    }, [searchParams, navigate]);

    if (error) {
        return (
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full text-center">
                    <div className="inline-flex p-3 bg-red-500/10 rounded-full text-red-400 mb-4">
                        <AlertCircle size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Link Expired</h2>
                    <p className="text-neutral-400 text-sm mb-6">
                        This link has expired or is no longer valid.
                        Please use &quot;Forgot Password&quot; on the login page, or ask your coach to resend the invite.
                    </p>
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-lg transition-colors"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full text-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-4" />
                <p className="text-neutral-400 text-sm">Verifying your link…</p>
            </div>
        </div>
    );
}
