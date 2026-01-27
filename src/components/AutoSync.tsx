import React, { useEffect, useRef } from 'react';
import { useConcept2Sync } from '../hooks/useConcept2Sync';
import { useAuth } from '../hooks/useAuth';

export const AutoSync: React.FC = () => {
    const { user } = useAuth();
    const { startSync, syncing } = useConcept2Sync();
    const hasSynced = useRef(false);

    useEffect(() => {
        const token = localStorage.getItem('concept2_token');
        if (user && token && !hasSynced.current && !syncing) {
            console.log('AutoSync: Triggering automatic sync (Last 30 days)...');
            hasSynced.current = true;

            startSync({ range: '30days', skipIfRecent: true })
                .then(() => console.log('AutoSync: Complete'))
                .catch(err => console.error('AutoSync: Failed', err));
        }
    }, [user, startSync, syncing]);

    return null;
};
