import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { supabase } from '../services/supabase';

export const Callback: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const hasRun = useRef(false);

    useEffect(() => {
        if (hasRun.current) return;
        hasRun.current = true;

        const code = searchParams.get('code');
        if (code) {
            exchangeToken(code);
        } else {
            console.error('No code found in URL');
            navigate('/login');
        }
    }, [searchParams]);

    const exchangeToken = async (code: string) => {
        try {
            const params = new URLSearchParams();
            params.append('client_id', import.meta.env.VITE_CONCEPT2_CLIENT_ID);
            params.append('client_secret', import.meta.env.VITE_CONCEPT2_CLIENT_SECRET);
            params.append('grant_type', 'authorization_code');
            params.append('code', code);
            params.append('redirect_uri', `${window.location.origin}/callback`);
            params.append('scope', 'user:read,results:read');

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

            // Store in Supabase if logged in
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('user_integrations').upsert({
                    user_id: user.id,
                    concept2_token: token,
                    concept2_refresh_token: refreshToken,
                    concept2_expires_at: expiresAt
                });
            }

            // Redirect to Sync page
            window.location.href = '/sync';
        } catch (error) {
            console.error('Token exchange failed', error);
            navigate('/login');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-neutral-900 text-white">
            <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Authenticating...</h2>
                <p className="text-neutral-400">Connecting your Concept2 Logbook...</p>
            </div>
        </div>
    );
};

