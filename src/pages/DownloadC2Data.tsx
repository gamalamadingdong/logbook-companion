import { useState } from 'react';
import { getResults, getResultDetail, getStrokes } from '../api/concept2';
import type { C2Result, C2ResultDetail } from '../api/concept2.types';

interface DownloadProgress {
    phase: 'idle' | 'fetching-list' | 'fetching-details' | 'complete' | 'error';
    currentPage?: number;
    totalPages?: number;
    currentWorkout?: number;
    totalWorkouts?: number;
    error?: string;
}

interface ExportData {
    metadata: {
        exportDate: string;
        totalWorkouts: number;
        dateRange: {
            earliest: string;
            latest: string;
        };
        workoutTypes: Record<string, number>;
        strokeDataAvailable: number;
    };
    workouts: C2ResultDetail[];
}

export default function DownloadC2Data() {
    const [progress, setProgress] = useState<DownloadProgress>({ phase: 'idle' });
    const [exportData, setExportData] = useState<ExportData | null>(null);

    const downloadAllData = async () => {
        try {
            setProgress({ phase: 'fetching-list' });

            // Step 1: Fetch all results (paginated)
            const allResults: C2Result[] = [];
            let totalPages = 1;

            // Fetch first page to get total
            const firstPage = await getResults('me', 1);
            allResults.push(...firstPage.data);

            if (firstPage.meta?.pagination) {
                totalPages = firstPage.meta.pagination.total_pages;
                setProgress({
                    phase: 'fetching-list',
                    currentPage: 1,
                    totalPages
                });
            }

            // Fetch remaining pages
            for (let page = 2; page <= totalPages; page++) {
                const pageData = await getResults('me', page);
                allResults.push(...pageData.data);
                setProgress({
                    phase: 'fetching-list',
                    currentPage: page,
                    totalPages
                });

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log(`Fetched ${allResults.length} workouts`);

            // Save summary immediately
            await fetch('/api/save-workout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'summary',
                    workoutData: allResults
                })
            });

            // Step 2: Fetch full details for each workout
            setProgress({
                phase: 'fetching-details',
                currentWorkout: 0,
                totalWorkouts: allResults.length
            });

            const detailedWorkouts: C2ResultDetail[] = [];
            let strokeDataCount = 0;

            for (let i = 0; i < allResults.length; i++) {
                const result = allResults[i];

                try {
                    // Fetch workout detail
                    const detail = await getResultDetail(result.id);

                    // Save workout file immediately
                    await fetch('/api/save-workout', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'workout',
                            workoutId: result.id,
                            workoutData: detail
                        })
                    });

                    // Try to fetch and save stroke data
                    try {
                        const strokes = await getStrokes(result.id);
                        if (strokes && strokes.length > 0) {
                            detail.strokes = strokes;
                            strokeDataCount++;

                            // Save stroke data
                            await fetch('/api/save-workout', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    type: 'strokes',
                                    workoutId: result.id,
                                    workoutData: strokes
                                })
                            });
                        }
                    } catch (err) {
                        // Stroke data not available for this workout
                        console.log(`No stroke data for workout ${result.id}`);
                    }

                    detailedWorkouts.push(detail);

                    setProgress({
                        phase: 'fetching-details',
                        currentWorkout: i + 1,
                        totalWorkouts: allResults.length
                    });

                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 150));
                } catch (err) {
                    console.error(`Failed to fetch detail for workout ${result.id}:`, err);
                    // Continue with next workout
                }
            }

            // Step 3: Generate metadata
            const workoutTypes: Record<string, number> = {};
            let earliest = detailedWorkouts[0]?.date;
            let latest = detailedWorkouts[0]?.date;

            detailedWorkouts.forEach(w => {
                // Count workout types
                workoutTypes[w.workout_type] = (workoutTypes[w.workout_type] || 0) + 1;

                // Track date range
                if (w.date < earliest) earliest = w.date;
                if (w.date > latest) latest = w.date;
            });

            const exportData: ExportData = {
                metadata: {
                    exportDate: new Date().toISOString(),
                    totalWorkouts: detailedWorkouts.length,
                    dateRange: {
                        earliest,
                        latest
                    },
                    workoutTypes,
                    strokeDataAvailable: strokeDataCount
                },
                workouts: detailedWorkouts
            };

            // Save metadata
            await fetch('/api/save-workout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'metadata',
                    workoutData: exportData.metadata
                })
            });

            setExportData(exportData);
            setProgress({ phase: 'complete' });

        } catch (err: any) {
            console.error('Download failed:', err);
            setProgress({
                phase: 'error',
                error: err.message || 'Unknown error'
            });
        }
    };

    const downloadJSON = () => {
        if (!exportData) return;

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `c2-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="container mx-auto p-8 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6">Download C2 Logbook Data</h1>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h2 className="font-semibold text-blue-900 mb-2">What this does:</h2>
                <ul className="list-disc list-inside text-blue-800 space-y-1">
                    <li>Downloads your entire Concept2 logbook history</li>
                    <li>Fetches full workout details (splits, intervals)</li>
                    <li>Includes stroke-by-stroke data (when available)</li>
                    <li>Saves files to <code className="bg-blue-100 px-1 rounded">data/c2-export/</code> as they download</li>
                </ul>
            </div>

            {progress.phase === 'idle' && (
                <button
                    onClick={downloadAllData}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                    Start Download
                </button>
            )}

            {progress.phase === 'fetching-list' && (
                <div className="bg-white border rounded-lg p-6">
                    <h3 className="font-semibold mb-2">Fetching workout list...</h3>
                    <div className="flex items-center gap-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span>
                            Page {progress.currentPage} of {progress.totalPages}
                        </span>
                    </div>
                </div>
            )}

            {progress.phase === 'fetching-details' && (
                <div className="bg-white border rounded-lg p-6">
                    <h3 className="font-semibold mb-2">Fetching workout details...</h3>
                    <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                            <span>Progress</span>
                            <span>{progress.currentWorkout} / {progress.totalWorkouts}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{
                                    width: `${((progress.currentWorkout || 0) / (progress.totalWorkouts || 1)) * 100}%`
                                }}
                            />
                        </div>
                    </div>
                    <p className="text-sm text-gray-600">
                        This may take several minutes depending on your workout count...
                    </p>
                </div>
            )}

            {progress.phase === 'complete' && exportData && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <h3 className="font-semibold text-green-900 mb-4">✅ Download Complete!</h3>

                    <div className="bg-white rounded p-4 mb-4 space-y-2">
                        <div className="flex justify-between">
                            <span className="font-medium">Total Workouts:</span>
                            <span>{exportData.metadata.totalWorkouts}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-medium">Date Range:</span>
                            <span>
                                {exportData.metadata.dateRange.earliest.split(' ')[0]} → {exportData.metadata.dateRange.latest.split(' ')[0]}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="font-medium">With Stroke Data:</span>
                            <span>{exportData.metadata.strokeDataAvailable}</span>
                        </div>
                        <div className="mt-4 pt-4 border-t">
                            <span className="font-medium block mb-2">Workout Types:</span>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                {Object.entries(exportData.metadata.workoutTypes).map(([type, count]) => (
                                    <div key={type} className="flex justify-between">
                                        <span className="text-gray-600">{type}:</span>
                                        <span>{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={downloadJSON}
                        className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition w-full"
                    >
                        💾 Download JSON File
                    </button>
                </div>
            )}

            {progress.phase === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <h3 className="font-semibold text-red-900 mb-2">❌ Error</h3>
                    <p className="text-red-800">{progress.error}</p>
                    <button
                        onClick={() => setProgress({ phase: 'idle' })}
                        className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
                    >
                        Try Again
                    </button>
                </div>
            )}
        </div>
    );
}
