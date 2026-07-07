import React, { useEffect, useRef } from 'react';
import { useConcept2Sync } from '../hooks/useConcept2Sync';
import { useAuth } from '../hooks/useAuth';

const AUTO_SYNC_IN_FLIGHT_KEY = 'c2_foreground_auto_sync_in_flight';
const AUTO_SYNC_IN_FLIGHT_TTL_MS = 5 * 60 * 1000;

export const AutoSync: React.FC = () => {
    const { user, profile, tokensReady } = useAuth();
    const { startSync, syncing } = useConcept2Sync();
    const hasSynced = useRef(false);

    useEffect(() => {
        // Wait for tokens to be restored from DB
        if (!tokensReady) return;

        // Check user preference (default: true)
        const autoSyncEnabled = (profile as any)?.preferences?.auto_sync !== false;
        if (!autoSyncEnabled) {
            return;
        }

        const token = localStorage.getItem('concept2_token');
        if (user && token && !hasSynced.current && !syncing) {
            const inFlightStartedAt = Number.parseInt(sessionStorage.getItem(AUTO_SYNC_IN_FLIGHT_KEY) || '', 10);
            if (Number.isFinite(inFlightStartedAt) && Date.now() - inFlightStartedAt < AUTO_SYNC_IN_FLIGHT_TTL_MS) {
                return;
            }

            hasSynced.current = true;
            sessionStorage.setItem(AUTO_SYNC_IN_FLIGHT_KEY, Date.now().toString());

            startSync({ range: 'sinceLastSync', skipIfRecent: true })
                .catch(err => console.error('AutoSync: Failed', err))
                .finally(() => sessionStorage.removeItem(AUTO_SYNC_IN_FLIGHT_KEY));
        }
    }, [user, profile, tokensReady, startSync, syncing]);

    return null;
};
