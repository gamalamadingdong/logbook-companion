import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { supabase } from '../services/supabase';
import { waitForConcept2User } from '../services/concept2Auth';

export default function LegacyConcept2Callback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const hasRun = useRef(false);
    const exchangeToken = useCallback(async (code: string) => {
        try {
            const params = new URLSearchParams();
            params.append('client_id', import.meta.env.VITE_CONCEPT2_CLIENT_ID);
            params.append('client_secret', import.meta.env.VITE_CONCEPT2_CLIENT_SECRET);
            params.append('grant_type', 'authorization_code');
            params.append('code', code);
            params.append('redirect_uri', `${window.location.origin}/callback`);
            params.append('scope', 'user:read,results:write');
            const response = await axios.post('https://log.concept2.com/oauth/access_token', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            const token = response.data.access_token;
            const refreshToken = response.data.refresh_token;
            const expiresAt = new Date(Date.now() + response.data.expires_in * 1000).toISOString();
            localStorage.setItem('concept2_token', token);
            localStorage.setItem('concept2_refresh_token', refreshToken);
            localStorage.setItem('concept2_expires_at', expiresAt);
            window.dispatchEvent(new CustomEvent('concept2-token-updated'));
            const user = await waitForConcept2User();
            if (user) {
                const { error } = await supabase.from('user_integrations').upsert({
                    user_id: user.id, concept2_token: token, concept2_refresh_token: refreshToken,
                    concept2_expires_at: expiresAt,
                }, { onConflict: 'user_id' });
                if (error) console.error('Failed to persist Concept2 tokens to user_integrations:', error);
            } else {
                console.warn('Concept2 callback could not persist credentials before auth hydration.');
            }
            window.location.href = '/sync';
        } catch {
            console.error('Legacy Concept2 token exchange failed.');
            navigate('/login');
        }
    }, [navigate]);
    useEffect(() => {
        if (hasRun.current) return;
        hasRun.current = true;
        const code = searchParams.get('code');
        if (code) void exchangeToken(code);
        else navigate('/login');
    }, [exchangeToken, navigate, searchParams]);
    return <div className="flex items-center justify-center min-h-screen bg-surface-page text-content-primary">
        <div className="text-center">
            <h1 className="text-xl font-semibold mb-2">Authenticating...</h1>
            <p className="text-content-secondary">Connecting your Concept2 Logbook...</p>
        </div>
    </div>;
}
