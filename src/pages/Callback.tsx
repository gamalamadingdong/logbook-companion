import React, { useCallback, useEffect, useRef, useState } from 'react';
import { legacyConcept2Enabled } from '../services/concept2Environment';
import { developmentConcept2 } from '../services/concept2Auth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { supabase } from '../services/supabase';

export const Callback: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const hasRun = useRef(false);
    const [failure, setFailure] = useState('');

    const waitForAuthenticatedUser = useCallback(async (maxAttempts = 10, delayMs = 300) => {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) return user;
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        return null;
    }, []);

    const exchangeToken = useCallback(async (code: string) => {
        if (!legacyConcept2Enabled) {
            const state = searchParams.get('state') || '';
            window.history.replaceState({}, '', '/callback');
            try {
                if (!await waitForAuthenticatedUser()) throw new Error('Sign in with the account that started the connection.');
                await developmentConcept2('exchange', { code, state });
                navigate('/sync', { replace: true });
            } catch (error) {
                setFailure(error instanceof Error ? error.message : 'Development connection failed.');
            }
            return;
        }
        try {
            const params = new URLSearchParams();
            params.append('client_id', import.meta.env.VITE_CONCEPT2_CLIENT_ID);
            params.append('client_secret', import.meta.env.VITE_CONCEPT2_CLIENT_SECRET);
            params.append('grant_type', 'authorization_code');
            params.append('code', code);
            params.append('redirect_uri', `${window.location.origin}/callback`);
            params.append('scope', 'user:read,results:write');

            const response = await axios.post('https://log.concept2.com/oauth/access_token', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const token = response.data.access_token;
            const refreshToken = response.data.refresh_token;
            // C2 API: expires_in is seconds
            const expiresAt = new Date(Date.now() + (response.data.expires_in * 1000)).toISOString();

            // Store in LocalStorage for legacy fallback
            localStorage.setItem('concept2_token', token);
            localStorage.setItem('concept2_refresh_token', refreshToken);
            localStorage.setItem('concept2_expires_at', expiresAt);
            window.dispatchEvent(new CustomEvent('concept2-token-updated'));

            // Store in Supabase once auth state is available (OAuth redirect can race auth hydration)
            const user = await waitForAuthenticatedUser();
            if (user) {
                const { error: upsertError } = await supabase.from('user_integrations').upsert({
                    user_id: user.id,
                    concept2_token: token,
                    concept2_refresh_token: refreshToken,
                    concept2_expires_at: expiresAt
                }, { onConflict: 'user_id' });

                if (upsertError) {
                    console.error('Failed to persist Concept2 tokens to user_integrations:', upsertError);
                }
            } else {
                console.warn('Concept2 callback received tokens, but no authenticated Supabase user was available after retries; DB persistence skipped for this callback.');
            }

            // Redirect to Sync page
            window.location.href = '/sync';
        } catch (error) {
            console.error('Token exchange failed', error);
            navigate('/login');
        }
    }, [navigate, waitForAuthenticatedUser, searchParams]);

    useEffect(() => {
        if (hasRun.current) return;
        hasRun.current = true;

        const code = searchParams.get('code');
        if (code) {
            void exchangeToken(code);
        } else {
            if (!legacyConcept2Enabled) {
                window.history.replaceState({}, '', '/callback');
                setFailure('Authorization was denied or the callback is missing a code. Return to Sync and reconnect.');
            } else {
                navigate('/login');
            }
        }
    }, [exchangeToken, navigate, searchParams]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-neutral-900 text-white">
            <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">{failure ? 'Connection failed' : 'Authenticating...'}</h2>
                <p role={failure ? 'alert' : undefined} className="text-neutral-400">{failure || 'Connecting your Concept2 Logbook...'}</p>
                {failure && <a href="/sync" className="underline">Return to Sync</a>}
            </div>
        </div>
    );
};

