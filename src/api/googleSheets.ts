import axios from 'axios';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

export const initiateGoogleLogin = () => {
    const client_id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirect_uri = window.location.origin + '/sync';

    const params = new URLSearchParams({
        client_id: client_id,
        redirect_uri: redirect_uri,
        response_type: 'token',
        scope: SCOPES,
        include_granted_scopes: 'true',
        state: 'pass-through value'
    });

    window.location.href = `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
};

export const createSheet = async (token: string, title: string, sheetTitles: string[] = []) => {
    const sheetsConfig = sheetTitles.map(t => ({ properties: { title: t } }));

    // If no sheetTitles provided, it defaults to one "Sheet1"
    const body: any = { properties: { title } };
    if (sheetsConfig.length > 0) {
        body.sheets = sheetsConfig;
    }

    const response = await axios.post(
        'https://sheets.googleapis.com/v4/spreadsheets',
        body,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
};

export const appendData = async (token: string, spreadsheetId: string, range: string, values: any[][]) => {
    const response = await axios.post(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
        { values },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
};
