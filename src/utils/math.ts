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
