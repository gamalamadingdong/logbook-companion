/**
 * Simple Least Squares Linear Regression
 * Returns points for the start and end of the line.
 */
export const calculateLinearRegression = (
    data: { x: number; y: number }[]
): { x: number; y: number }[] | null => {
    const n = data.length;
    if (n < 2) return null;

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
        sumX += data[i].x;
        sumY += data[i].y;
        sumXY += (data[i].x * data[i].y);
        sumXX += (data[i].x * data[i].x);
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const startX = data[0].x;
    const endX = data[n - 1].x;

    return [
        { x: startX, y: slope * startX + intercept },
        { x: endX, y: slope * endX + intercept }
    ];
};

export const getLinearRegressionStats = (
    data: { x: number; y: number }[]
): { slope: number; intercept: number; r2: number } | null => {
    const n = data.length;
    if (n < 2) return null;

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    let sumYY = 0;

    for (let i = 0; i < n; i++) {
        sumX += data[i].x;
        sumY += data[i].y;
        sumXY += (data[i].x * data[i].y);
        sumXX += (data[i].x * data[i].x);
        sumYY += (data[i].y * data[i].y);
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R2
    // r = (nΣxy - ΣxΣy) / sqrt((nΣx^2 - (Σx)^2)(nΣy^2 - (Σy)^2))
    const numerator = (n * sumXY - sumX * sumY);
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
    const r = denominator === 0 ? 0 : numerator / denominator;

    return { slope, intercept, r2: r * r };
};
