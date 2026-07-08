export function formatDistanceMeters(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return '0m';

    const kilometers = value / 1000;
    if (kilometers >= 1) {
        const rounded = Math.round((kilometers + Number.EPSILON) * 10) / 10;
        return `${Number.isInteger(rounded) ? rounded : `${rounded.toFixed(1)}`} km`;
    }

    return `${Math.round(value)} m`;
}

export function formatSignedDistanceMeters(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value) || value === 0) return '0m';
    const sign = value > 0 ? '+' : '-';
    return `${sign}${formatDistanceMeters(Math.abs(value))}`;
}

export function formatKilometerLabel(meters: number): string {
    const kilometers = meters / 1000;
    const rounded = Math.round((kilometers + Number.EPSILON) * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : `${rounded.toFixed(1)}`} km`;
}
