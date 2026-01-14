import axios from 'axios';
import type { C2Profile, C2Response, C2Result, C2ResultDetail, C2Stroke } from './concept2.types';

const BASE_URL = 'https://log.concept2.com/api';

export const concept2Client = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor to add Authorization header if token exists
concept2Client.interceptors.request.use((config) => {
    const token = localStorage.getItem('concept2_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    // Add recommended Accept header for API versioning
    config.headers['Accept'] = 'application/vnd.c2logbook.v1+json';
    return config;
});

export const getProfile = async (): Promise<C2Profile> => {
    const response = await concept2Client.get<any>('/users/me');
    console.log('Profile Response:', response.data);
    // Unpack if wrapped in 'data'
    if (response.data && response.data.data) {
        return response.data.data;
    }
    return response.data;
};

export const getResults = async (userId: number | string = 'me', page?: number): Promise<C2Response<C2Result[]>> => {
    // Construct URL based on presence of page param
    let url = `/users/${userId}/results`;
    if (page) {
        url += `?page=${page}`;
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
