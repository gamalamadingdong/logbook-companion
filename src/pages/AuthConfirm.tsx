import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabase';

/**
 * /auth/confirm — Verifies email tokens client-side.
 *
 * Used instead of Supabase's /auth/v1/verify endpoint to prevent
 * email link pre-fetching (Safe Links, etc.) from consuming one-time tokens.
 *
 * Expected query params:
 *   - token_hash: The hashed OTP token from the email
 *   - type: The verification type (invite, recovery, signup, email_change)
 *   - next: (optional) Where to redirect after verification
 */
export function AuthConfirm() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type') as 'invite' | 'recovery' | 'signup' | 'email_change';
        const next = searchParams.get('next') || (type === 'invite' ? '/reset-password?type=invite' : '/');

        if (!tokenHash || !type) {
            setError('Invalid link — missing verification parameters.');
            return;
        }

        supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error: verifyError }) => {
            if (verifyError) {
                console.error('[auth/confirm] OTP verification failed:', verifyError.message);
                setError(verifyError.message);
                return;
            }
            navigate(next, { replace: true });
        });
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
                <p className="text-neutral-400 text-sm">Verifying your invite…</p>
            </div>
        </div>
    );
}
