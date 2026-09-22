import { lazy, useEffect, useRef, useState } from 'react';
import { legacyConcept2Enabled } from '../services/concept2Environment';
import { developmentConcept2, nativeConcept2Auth, waitForConcept2User } from '../services/concept2Auth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { nativeDevelopmentReturn } from '../../supabase/functions/_shared/concept2/nativeAuth';
import { Button, Card } from '../components/ui';

const LegacyCallback = legacyConcept2Enabled ? lazy(() => import('./LegacyConcept2Callback')) : null;

export function Callback() {
    return LegacyCallback ? <LegacyCallback /> : <DevelopmentCallback />;
}

function DevelopmentCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [failure, setFailure] = useState('');
    const [handoff, setHandoff] = useState<string | null>(null);
    const attempt = useRef<{ key: string; promise: Promise<string | null> } | null>(null);

    useEffect(() => {
        let active = true;
        const key = searchParams.toString();
        if (attempt.current?.key !== key) {
            attempt.current = { key, promise: (async () => {
                window.history.replaceState(window.history.state, '', '/callback');
                if (Capacitor.isNativePlatform()) {
                    await nativeConcept2Auth.complete(searchParams);
                    return null;
                }
                const mobileReturn = nativeDevelopmentReturn(searchParams);
                if (mobileReturn) return mobileReturn;
                const code = searchParams.get('code');
                if (!code || searchParams.has('error')) {
                    throw new Error('Concept2 authorization was canceled or the return is incomplete. Reconnect from Sync.');
                }
                if (!await waitForConcept2User()) throw new Error('Sign in with the account that started the connection.');
                await developmentConcept2('exchange', { code, state: searchParams.get('state') || '' });
                return null;
            })() };
        }
        void attempt.current.promise.then(url => {
            if (!active) return;
            setFailure('');
            if (url) setHandoff(url);
            else navigate('/sync', { replace: true });
        }).catch(error => {
            if (active) {
                setHandoff(null);
                setFailure(error instanceof Error ? error.message : 'Development connection failed. Reconnect from Sync.');
            }
        });
        return () => { active = false; };
    }, [navigate, searchParams]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-surface-page text-content-primary px-4">
            <Card padding="lg" className="w-full max-w-md text-center space-y-4">
                <h1 className="text-xl font-semibold">{failure ? 'Connection failed' : handoff ? 'Return to the app' : 'Authenticating...'}</h1>
                <p role={failure ? 'alert' : 'status'} className="text-content-secondary">
                    {failure || (handoff ? 'Finish connecting Concept2 in the Logbook Companion app that started this request.' : 'Connecting your Concept2 Logbook...')}
                </p>
                {handoff && !failure && <a href={handoff} className="min-h-11 inline-flex items-center underline text-accent-primary-text">
                    Return to Logbook Companion
                </a>}
                {failure && <Button className="min-h-11" onClick={() => navigate('/sync', { replace: true })}>Return to Sync</Button>}
            </Card>
        </div>
    );
}
