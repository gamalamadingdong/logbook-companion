import React, { useEffect, useRef } from 'react';
import { useConcept2Sync } from '../hooks/useConcept2Sync';
import { useAuth } from '../hooks/useAuth';

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
            hasSynced.current = true;

            startSync({ range: '30days', skipIfRecent: true })
                .catch(err => console.error('AutoSync: Failed', err));
        }
    }, [user, profile, tokensReady, startSync, syncing]);

    return null;
};
