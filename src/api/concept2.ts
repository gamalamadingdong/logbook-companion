import axios from 'axios';
import type { C2Profile, C2Response, C2Result, C2ResultDetail, C2Stroke } from './concept2.types';

const BASE_URL = 'https://log.concept2.com/api';
import { supabase } from '../services/supabase';

export const concept2Client = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Helper: Clear local tokens
function clearLocalTokens() {
    localStorage.removeItem('concept2_token');
    localStorage.removeItem('concept2_refresh_token');
    localStorage.removeItem('concept2_expires_at');
    // Dispatch reconnect-required event for UI to handle
    window.dispatchEvent(new CustomEvent('concept2-reconnect-required'));
}

// Helper: Refresh the access token using the refresh token
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(refreshToken: string): Promise<string> {
    if (refreshPromise) {
        console.log('Refresh already in progress, attaching to existing promise...');
        return refreshPromise;
    }

    refreshPromise = (async () => {
        const clientId = import.meta.env.VITE_CONCEPT2_CLIENT_ID;
        const clientSecret = import.meta.env.VITE_CONCEPT2_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error("Missing Concept2 Client ID or Secret in environment variables.");
        }

        const params = new URLSearchParams();
        params.append('client_id', clientId);
        params.append('client_secret', clientSecret);
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', refreshToken);

        try {
            console.log('Initiating unique token refresh request...');
            const response = await axios.post('https://log.concept2.com/oauth/access_token', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const newToken = response.data.access_token;
            const newRefreshToken = response.data.refresh_token;

            localStorage.setItem('concept2_token', newToken);
            if (newRefreshToken) {
                localStorage.setItem('concept2_refresh_token', newRefreshToken);
            }
            if (response.data.expires_in) {
                const expiresAt = new Date(Date.now() + (response.data.expires_in * 1000)).toISOString();
                localStorage.setItem('concept2_expires_at', expiresAt);
            }

            // Persist to DB async (don't block)
            supabase.auth.getUser().then(({ data: { user } }) => {
                if (user) {
                    supabase.from('user_integrations').upsert({
                        user_id: user.id,
                        concept2_token: newToken,
                        concept2_refresh_token: newRefreshToken,
                        concept2_expires_at: response.data.expires_in
                            ? new Date(Date.now() + (response.data.expires_in * 1000)).toISOString()
                            : undefined
                    }, { onConflict: 'user_id' }).then(() => console.log('DB Token Update Success'));
                }
            });

            return newToken;
        } catch (error: any) {
            if (error.response && error.response.status === 400) {
                console.error("Fatal: Invalid Refresh Token or Config (400). Clearing session.");
                clearLocalTokens();
                throw new Error("FATAL_REFRESH_ERROR");
            }
            throw error;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

// Interceptor to add Authorization header if token exists (with proactive refresh)
concept2Client.interceptors.request.use(async (config) => {
    // Proactive expiry check
    const expiresAt = localStorage.getItem('concept2_expires_at');
    const refreshToken = localStorage.getItem('concept2_refresh_token');

    if (expiresAt && refreshToken) {
        const expiryTime = new Date(expiresAt).getTime();
        const buffer = 5 * 60 * 1000; // 5 minutes
        if (Date.now() > expiryTime - buffer) {
            console.log('Token expiring soon, refreshing proactively...');
            try {
                const newToken = await refreshAccessToken(refreshToken);
                config.headers.Authorization = `Bearer ${newToken}`;
                config.headers['Accept'] = 'application/vnd.c2logbook.v1+json';
                return config;
            } catch (err: any) {
                console.error('Proactive token refresh failed:', err);
                if (err.message === "FATAL_REFRESH_ERROR" || (err.response && err.response.status === 400)) {
                    // Stop the request if we know auth is dead
                    return Promise.reject(err);
                }
                // If it's network error, we might still struggle through or let 401 handler try later
            }
        }
    }

    const token = localStorage.getItem('concept2_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers['Accept'] = 'application/vnd.c2logbook.v1+json';
    return config;
});

// Interceptor to handle 401s (Token Refresh) and 5xx (Retry)
concept2Client.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        const isNetworkError = !error.response && (error.message === 'Network Error' || error.code === 'ERR_NETWORK');
        const isserverError = error.response && [500, 502, 503, 504, 429].includes(error.response.status);

        // RETRY LOGIC for 5xx, 429, or Network Errors (CORS/Drop)
        if (isserverError || isNetworkError) {
            originalRequest._retryCount = originalRequest._retryCount || 0;
            if (originalRequest._retryCount < 3) {
                originalRequest._retryCount++;
                const delay = Math.pow(2, originalRequest._retryCount) * 1000; // 2s, 4s, 8s
                console.log(`API Error (Status: ${error.response?.status || 'Network'}). Retrying in ${delay}ms (Attempt ${originalRequest._retryCount}/3)...`);

                await new Promise(resolve => setTimeout(resolve, delay));
                return concept2Client(originalRequest);
            }
        }

        // If 401 and not already retrying
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            const refreshToken = localStorage.getItem('concept2_refresh_token');

            if (refreshToken) {
                try {
                    console.log('Concept2 Token expired. Refreshing...');
                    // Reuse the helper logic (which handles env vars and 400s) instead of rewriting it
                    const newToken = await refreshAccessToken(refreshToken);

                    console.log('Token refresh successful.');
                    // Update header and retry
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    return concept2Client(originalRequest);

                } catch (refreshError) {
                    console.error("Token refresh failed during retry:", refreshError);
                    clearLocalTokens();
                    // Don't reject, just let it fail -> UI might redirect
                }
            }
        }
        return Promise.reject(error);
    }
);

export const getProfile = async (): Promise<C2Profile> => {
    const response = await concept2Client.get<any>('/users/me');
    console.log('Profile Response:', response.data);
    // Unpack if wrapped in 'data'
    if (response.data && response.data.data) {
        return response.data.data;
    }
    return response.data;
};

export const getResults = async (userId: number | string = 'me', page?: number, params: Record<string, any> = {}): Promise<C2Response<C2Result[]>> => {
    // Construct URL
    let url = `/users/${userId}/results`;

    // Build Query Params
    const query = new URLSearchParams();
    if (page) query.append('page', page.toString());

    // Add optional filters (from, to, type)
    if (params.from) query.append('from', params.from);
    if (params.to) query.append('to', params.to); // Docs: 'to' is inclusive or exclusive? Usually inclusive ISO or date
    if (params.type) query.append('type', params.type);

    const queryString = query.toString();
    if (queryString) {
        url += `?${queryString}`;
    }

    const response = await concept2Client.get<C2Response<C2Result[]>>(url);
    return response.data;
};

export const getResultDetail = async (resultId: number): Promise<C2ResultDetail> => {
    // The "me" alias doesn't work for specific result endpoint in some APIs, 
    // but the docs say /api/users/{user}/results/{result_id}. 
    const response = await concept2Client.get<any>(`/users/me/results/${resultId}`);
    // Unpack if wrapped in 'data'
    if (response.data && response.data.data) {
        return response.data.data;
    }
    return response.data;
};

export const getStrokes = async (resultId: number): Promise<C2Stroke[]> => {
    try {
        const response = await concept2Client.get<any>(`/users/me/results/${resultId}/strokes`);
        // Docs say body: { data: [...] }
        return response.data.data;
    } catch (error: any) {
        if (error.response && error.response.status === 404) {
            return []; // No strokes available
        }
        throw error;
    }
};
