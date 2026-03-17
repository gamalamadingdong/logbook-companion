import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';

export const ResetPassword: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [isNewUser, setIsNewUser] = useState(false);

    // Supabase puts auth tokens in the URL hash for invite/recovery links.
    // The JS client picks them up automatically via onAuthStateChange,
    // but we need to wait for that to complete before showing the form.
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
                setIsInitializing(false);
            }
        });

        // Check if we already have a session (e.g., user navigated here manually)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                // Detect new users: invited users have no confirmed_at or very recent creation
                const createdAt = session.user?.created_at ? new Date(session.user.created_at) : null;
                const confirmedAt = session.user?.confirmed_at ? new Date(session.user.confirmed_at) : null;
                if (createdAt && confirmedAt) {
                    const diffMs = Math.abs(confirmedAt.getTime() - createdAt.getTime());
                    // If confirmed within 5 minutes of creation, likely an invite flow
                    if (diffMs < 5 * 60 * 1000) {
                        setIsNewUser(true);
                    }
                }
                setIsInitializing(false);
            }
        });

        // Also check for invite-specific query param
        if (searchParams.get('type') === 'invite') {
            setIsNewUser(true);
        }

        // Fallback: stop waiting after 5 seconds
        const timeout = setTimeout(() => setIsInitializing(false), 5000);

        return () => {
            subscription.unsubscribe();
            clearTimeout(timeout);
        };
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            const { error: updateError } = await supabase.auth.updateUser({ password });
            if (updateError) throw updateError;
            setSuccess(true);
            setTimeout(() => navigate('/'), 3000);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to update password.');
        } finally {
            setLoading(false);
        }
    };

    if (isInitializing) {
        return (
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-4" />
                    <p className="text-neutral-400 text-sm">Verifying your link…</p>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full text-center">
                    <div className="inline-flex p-3 bg-emerald-500/10 rounded-full text-emerald-500 mb-4">
                        <CheckCircle size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">
                        {isNewUser ? 'Welcome to ReadyAll!' : 'Password Updated'}
                    </h2>
                    <p className="text-neutral-400 text-sm">
                        {isNewUser
                            ? 'Your password has been set. Redirecting to your dashboard…'
                            : 'Redirecting to dashboard…'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
                        <Lock size={24} />
                    </div>
                    <h1 className="text-xl font-bold text-white">
                        {isNewUser ? 'Set Your Password' : 'Set New Password'}
                    </h1>
                </div>

                {isNewUser && (
                    <p className="text-neutral-400 text-sm mb-6 ml-[44px]">
                        Welcome! Choose a password to secure your account.
                        You&apos;ll use this to log in from now on.
                    </p>
                )}

                {!isNewUser && <div className="mb-6" />}

                {error && (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-neutral-400 mb-1">
                            {isNewUser ? 'Password' : 'New Password'}
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="At least 8 characters"
                            required
                            minLength={8}
                            autoFocus
                        />
                    </div>
                    <div>
                        <label htmlFor="confirm-password" className="block text-sm font-medium text-neutral-400 mb-1">
                            Confirm Password
                        </label>
                        <input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Re-enter password"
                            required
                            minLength={8}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
                    >
                        {loading ? 'Updating…' : (isNewUser ? 'Set Password & Continue' : 'Update Password')}
                    </button>
                </form>
            </div>
        </div>
    );
};
