import React, { useEffect, useRef } from 'react';

declare global {
    interface Window {
        turnstile?: {
            render: (
                container: HTMLElement,
                options: {
                    sitekey: string;
                    theme?: 'light' | 'dark' | 'auto';
                    callback: (token: string) => void;
                    'expired-callback'?: () => void;
                    'error-callback'?: () => void;
                }
            ) => string;
            remove: (widgetId: string) => void;
        };
    }
}

const TURNSTILE_SCRIPT_ID = 'cf-turnstile-script';
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let turnstileScriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
    if (window.turnstile) {
        return Promise.resolve();
    }

    if (turnstileScriptPromise) {
        return turnstileScriptPromise;
    }

    turnstileScriptPromise = new Promise((resolve, reject) => {
        const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(), { once: true });
            existingScript.addEventListener('error', () => reject(new Error('Failed to load Turnstile script.')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.id = TURNSTILE_SCRIPT_ID;
        script.src = TURNSTILE_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Turnstile script.'));
        document.head.appendChild(script);
    });

    return turnstileScriptPromise;
}

interface TurnstileWidgetProps {
    siteKey: string;
    onTokenChange: (token: string | null) => void;
}

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({ siteKey, onTokenChange }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function mountWidget() {
            await loadTurnstileScript();

            if (cancelled || !containerRef.current || !window.turnstile) {
                return;
            }

            widgetIdRef.current = window.turnstile.render(containerRef.current, {
                sitekey: siteKey,
                theme: 'auto',
                callback: (token) => onTokenChange(token),
                'expired-callback': () => onTokenChange(null),
                'error-callback': () => onTokenChange(null),
            });
        }

        mountWidget().catch(() => {
            onTokenChange(null);
        });

        return () => {
            cancelled = true;
            if (widgetIdRef.current && window.turnstile) {
                window.turnstile.remove(widgetIdRef.current);
            }
        };
    }, [onTokenChange, siteKey]);

    return <div ref={containerRef} />;
};
