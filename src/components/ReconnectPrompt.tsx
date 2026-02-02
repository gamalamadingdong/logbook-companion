import React, { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, X } from 'lucide-react';

/**
 * ReconnectPrompt: A banner that appears when Concept2 refresh token has expired.
 * Listens for 'concept2-reconnect-required' event and prompts user to reconnect.
 */
export const ReconnectPrompt: React.FC = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const handleReconnectRequired = () => {
            console.log('ReconnectPrompt: Reconnection required');
            setVisible(true);
        };

        window.addEventListener('concept2-reconnect-required', handleReconnectRequired);
        return () => window.removeEventListener('concept2-reconnect-required', handleReconnectRequired);
    }, []);

    if (!visible) return null;

    const handleReconnect = () => {
        // Navigate to Sync page to initiate reconnection
        window.location.href = '/sync';
    };

    return (
        <div className="fixed bottom-4 right-4 max-w-sm bg-amber-900/90 border border-amber-700 rounded-lg shadow-xl p-4 z-50 animate-fade-in">
            <button
                onClick={() => setVisible(false)}
                className="absolute top-2 right-2 text-amber-400 hover:text-amber-200"
            >
                <X size={16} />
            </button>
            <div className="flex items-start gap-3">
                <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={20} />
                <div>
                    <h3 className="font-semibold text-amber-100 mb-1">Concept2 Connection Expired</h3>
                    <p className="text-amber-200 text-sm mb-3">
                        Your Concept2 session has expired. Please reconnect to continue syncing workouts.
                    </p>
                    <button
                        onClick={handleReconnect}
                        className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-white text-sm px-3 py-1.5 rounded transition-colors"
                    >
                        Reconnect
                        <ExternalLink size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};
