import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoginForm } from '../components/auth/LoginForm';
import { SignUpForm } from '../components/auth/SignUpForm';
import { ForgotPasswordForm } from '../components/auth/ForgotPasswordForm';
import { Waves } from 'lucide-react';
import { emitAuthRedirectEvent } from '../utils/authTelemetry';
import { supabase } from '../services/supabase';
import { Button, Card } from '../components/ui';

type AuthMode = 'login' | 'signup' | 'forgot-password';

export const Login: React.FC = () => {
    const { user, session, loginAsGuest } = useAuth();
    const [mode, setMode] = useState<AuthMode>('login');
    const [searchParams] = useSearchParams();
    const startEventSent = useRef(false);
    const crossAppRedirectStarted = useRef(false);

    const returnToRaw = searchParams.get('returnTo');
    const authSource = searchParams.get('authSource') || 'lc';
    const authFlowId = searchParams.get('authFlowId') || undefined;
    const authHop = Number.parseInt(searchParams.get('authHop') || '0', 10);

    const getHubOrigins = () => {
        const origins = new Set<string>([
            'https://readyall.org',
            'https://www.readyall.org',
        ]);

        const hubUrl = import.meta.env.VITE_HUB_URL;
        if (hubUrl) {
            try {
                origins.add(new URL(hubUrl).origin);
            } catch {
                // Ignore invalid env URL and continue with defaults
            }
        }

        return origins;
    };

    const redirectToHubWithSsoHandoff = async (safeReturnTo: string) => {
        const target = new URL(safeReturnTo);
        const returnToPath = `${target.pathname}${target.search}${target.hash}`;

        try {
            const accessToken = session?.access_token;
            const refreshToken = session?.refresh_token;

            if (!accessToken || !refreshToken) {
                throw new Error('missing_session_tokens');
            }

            const { data: ssoToken, error: handoffError } = await supabase.rpc('create_sso_handoff', {
                p_source_app: 'lc',
                p_target_app: 'hub',
                p_return_to: returnToPath,
                p_ttl_seconds: 120,
            });

            if (handoffError || !ssoToken) {
                throw handoffError || new Error('handoff_token_missing');
            }

            const bootstrapUrl = new URL('/auth/bootstrap', target.origin);
            bootstrapUrl.searchParams.set('ssoToken', ssoToken);
            bootstrapUrl.searchParams.set('returnTo', returnToPath);
            bootstrapUrl.hash = new URLSearchParams({
                access_token: accessToken,
                refresh_token: refreshToken,
            }).toString();

            emitAuthRedirectEvent('auth_redirect_success', {
                source: authSource,
                flowId: authFlowId,
                returnTo: safeReturnTo,
                hop: authHop,
            });

            window.location.replace(bootstrapUrl.toString());
        } catch {
            emitAuthRedirectEvent('auth_redirect_error', {
                source: authSource,
                flowId: authFlowId,
                returnTo: safeReturnTo,
                reason: 'sso_handoff_failed',
                hop: authHop,
            });

            window.location.replace(safeReturnTo);
        }
    };

    useEffect(() => {
        if (returnToRaw && !startEventSent.current) {
            emitAuthRedirectEvent('auth_redirect_start', {
                source: authSource,
                flowId: authFlowId,
                returnTo: returnToRaw,
                hop: Number.isFinite(authHop) ? authHop : 0,
            });
            startEventSent.current = true;
        }
    }, [authFlowId, authHop, authSource, returnToRaw]);

    const getSafeReturnTo = (): string | null => {
        const raw = returnToRaw;
        if (!raw) return null;

        if (Number.isFinite(authHop) && authHop >= 4) {
            emitAuthRedirectEvent('auth_redirect_error', {
                source: authSource,
                flowId: authFlowId,
                returnTo: raw,
                reason: 'loop_protection_triggered',
                hop: authHop,
            });
            return null;
        }

        // Safe local app path
        if (raw.startsWith('/')) {
            if (raw.startsWith('/login') || raw.startsWith('/auth')) {
                emitAuthRedirectEvent('auth_redirect_error', {
                    source: authSource,
                    flowId: authFlowId,
                    returnTo: raw,
                    reason: 'unsafe_local_auth_path',
                    hop: authHop,
                });
                return null;
            }
            return raw;
        }

        // Safe absolute URL allowlist (supports both new and legacy LC domains during transition)
        try {
            const target = new URL(raw);
            const allowedOrigins = new Set<string>([
                window.location.origin,
                'https://readyall.org',
                'https://www.readyall.org',
                'https://log.readyall.org',
                'https://logbook-companion.vercel.app',
            ]);

            const hubUrl = import.meta.env.VITE_HUB_URL;
            if (hubUrl) {
                allowedOrigins.add(new URL(hubUrl).origin);
            }

            if (allowedOrigins.has(target.origin)) {
                if (target.pathname.startsWith('/login') || target.pathname.startsWith('/auth')) {
                    emitAuthRedirectEvent('auth_redirect_error', {
                        source: authSource,
                        flowId: authFlowId,
                        returnTo: raw,
                        reason: 'unsafe_absolute_auth_path',
                        hop: authHop,
                    });
                    return null;
                }
                return target.toString();
            }

            emitAuthRedirectEvent('auth_redirect_error', {
                source: authSource,
                flowId: authFlowId,
                returnTo: raw,
                reason: 'origin_not_allowlisted',
                hop: authHop,
            });
        } catch {
            emitAuthRedirectEvent('auth_redirect_error', {
                source: authSource,
                flowId: authFlowId,
                returnTo: raw,
                reason: 'invalid_return_to_url',
                hop: authHop,
            });
            return null;
        }

        return null;
    };

    if (user) {
        const safeReturnTo = getSafeReturnTo();

        if (safeReturnTo) {
            if (safeReturnTo.startsWith('/')) {
                emitAuthRedirectEvent('auth_redirect_success', {
                    source: authSource,
                    flowId: authFlowId,
                    returnTo: safeReturnTo,
                    hop: authHop,
                });
                return <Navigate to={safeReturnTo} replace />;
            }

            try {
                const target = new URL(safeReturnTo);
                const hubOrigins = getHubOrigins();

                if (hubOrigins.has(target.origin)) {
                    if (!crossAppRedirectStarted.current) {
                        crossAppRedirectStarted.current = true;
                        void redirectToHubWithSsoHandoff(safeReturnTo);
                    }

                    return (
                        <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-300">
                            Finishing sign-in…
                        </div>
                    );
                }

                emitAuthRedirectEvent('auth_redirect_success', {
                    source: authSource,
                    flowId: authFlowId,
                    returnTo: safeReturnTo,
                    hop: authHop,
                });

                window.location.replace(target.toString());
            } catch {
                window.location.replace(safeReturnTo);
            }
            return null;
        }

        return <Navigate to="/" replace />;
    }

    const renderAuthForm = () => {
        switch (mode) {
            case 'login':
                return (
                    <LoginForm
                        onForgotPassword={() => setMode('forgot-password')}
                    />
                );
            case 'signup':
                return (
                    <SignUpForm onSwitchToLogin={() => setMode('login')} />
                );
            case 'forgot-password':
                return (
                    <ForgotPasswordForm
                        onSwitchToLogin={() => setMode('login')}
                    />
                );
        }
    };

    return (
        <main className="grid min-h-[100dvh] bg-surface-page font-sans text-content-primary md:min-h-screen md:grid-cols-2">
            <section className="hidden border-r border-border bg-surface-card p-12 md:flex md:flex-col md:justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-primary-surface text-accent-primary"><Waves size={28} /></div>
                <div className="max-w-lg">
                    <h1 className="text-5xl font-bold tracking-tight">Master your <span className="text-accent-primary">rowing data.</span></h1>
                    <p className="mt-6 text-xl leading-relaxed text-content-secondary">Connect your Concept2 logbook, understand your training, and keep the next workout clear.</p>
                    <a href="/about" className="mt-5 inline-flex min-h-11 items-center text-base font-medium text-accent-primary hover:text-accent-primary-hover">Learn more about Logbook Companion &rarr;</a>
                </div>
                <p className="text-sm text-content-muted">&copy; 2026 Logbook Companion</p>
            </section>

            <section className="flex min-h-[100dvh] items-start justify-center overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] md:min-h-screen md:items-center md:p-8">
                <div className="w-full max-w-sm space-y-3">
                    <div className="flex items-center justify-center gap-2 py-1 md:hidden">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-primary-surface text-accent-primary"><Waves size={22} /></span>
                        <span className="text-base font-semibold text-content-primary">Logbook Companion</span>
                    </div>

                    <Card padding="sm" className="w-full">
                        {mode !== 'forgot-password' && (
                            <div className="mb-4 grid grid-cols-2 rounded-lg bg-surface-secondary p-1" role="tablist" aria-label="Authentication mode">
                                <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')} className={`min-h-11 rounded-md px-3 text-sm font-medium transition-colors ${mode === 'login' ? 'bg-surface-card text-content-primary shadow-sm' : 'text-content-muted hover:text-content-primary'}`}>Sign in</button>
                                <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => setMode('signup')} className={`min-h-11 rounded-md px-3 text-sm font-medium transition-colors ${mode === 'signup' ? 'bg-surface-card text-content-primary shadow-sm' : 'text-content-muted hover:text-content-primary'}`}>Create account</button>
                            </div>
                        )}

                        {renderAuthForm()}

                        {mode === 'login' && (
                            <div className="mt-3 border-t border-border pt-3">
                                <Button type="button" variant="secondary" className="min-h-11 w-full" onClick={() => loginAsGuest?.()}>Try Demo Mode</Button>
                            </div>
                        )}
                    </Card>

                    <a href="/about" className="flex min-h-11 items-center justify-center text-sm text-content-muted hover:text-content-primary md:hidden">About Logbook Companion</a>
                </div>
            </section>
        </main>
    );
};
