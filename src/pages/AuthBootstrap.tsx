import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';

function normalizeInternalReturnTo(raw: string | null): string {
  if (!raw) return '/';

  if (raw.startsWith('/')) {
    if (raw.startsWith('/login') || raw.startsWith('/auth')) return '/';
    return raw;
  }

  try {
    const target = new URL(raw);
    if (target.origin === window.location.origin) {
      if (target.pathname.startsWith('/login') || target.pathname.startsWith('/auth')) return '/';
      return `${target.pathname}${target.search}${target.hash}`;
    }
  } catch {
    return '/';
  }

  return '/';
}

function parseHashTokens(): { accessToken: string | null; refreshToken: string | null } {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);

  return {
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
  };
}

function clearHashFromUrl() {
  const url = new URL(window.location.href);
  window.history.replaceState({}, '', `${url.pathname}${url.search}`);
}

type ConsumeSsoHandoffRow = {
  requested_return_to: string | null;
};

export const AuthBootstrap: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Bootstrapping session...');

  const ssoToken = searchParams.get('ssoToken');
  const fallbackReturnTo = useMemo(
    () => normalizeInternalReturnTo(searchParams.get('returnTo')),
    [searchParams]
  );

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      if (!ssoToken) {
        setErrorMessage('Missing SSO token.');
        return;
      }

      const { accessToken, refreshToken } = parseHashTokens();

      if (!accessToken || !refreshToken) {
        setErrorMessage('Missing session tokens from source app. Please sign in again.');
        return;
      }

      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      clearHashFromUrl();

      if (setSessionError) {
        if (!isMounted) return;
        setErrorMessage('Unable to establish LC session from SSO handoff.');
        return;
      }

      if (!isMounted) return;
      setStatusMessage('Validating handoff...');

      const { data, error: consumeError } = await supabase.rpc('consume_sso_handoff', {
        p_token: ssoToken,
        p_expected_target: 'lc',
      });

      if (consumeError) {
        if (!isMounted) return;
        setErrorMessage('Handoff token could not be consumed. It may be expired or already used.');
        return;
      }

      const rows = (data as ConsumeSsoHandoffRow[] | null) ?? [];
      const requestedReturnTo = normalizeInternalReturnTo(rows[0]?.requested_return_to ?? null);
      const target = requestedReturnTo !== '/' ? requestedReturnTo : fallbackReturnTo;

      window.location.assign(target);
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [fallbackReturnTo, ssoToken]);

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-6">
      <section className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-white">
        <h1 className="text-2xl font-semibold">Single Sign-On</h1>
        <p className="mt-2 text-sm text-neutral-400">{statusMessage}</p>

        {errorMessage ? (
          <div className="mt-4 rounded-md border border-red-900/50 bg-red-950/20 p-3 text-sm text-red-300">
            {errorMessage}
            <a href="/login" className="ml-2 font-medium underline">
              Sign in manually
            </a>
          </div>
        ) : null}
      </section>
    </div>
  );
};
