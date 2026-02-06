import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

export function c2DataSaverPlugin(): Plugin {
    return {
        name: 'c2-data-saver',
        configureServer(server) {
            server.middlewares.use('/api/save-workout', async (req, res) => {
                if (req.method !== 'POST') {
                    res.statusCode = 405;
                    res.end('Method not allowed');
                    return;
                }

                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString();
                });

                req.on('end', () => {
                    try {
                        const data = JSON.parse(body);
                        const { workoutId, workoutData, type } = data;

                        // Determine directory based on type
                        const baseDir = path.join(process.cwd(), 'data', 'c2-export');
                        let targetDir: string;
                        let filename: string;

                        switch (type) {
                            case 'workout':
                                targetDir = path.join(baseDir, 'workouts');
                                filename = `${workoutId}.json`;
                                break;
                            case 'strokes':
                                targetDir = path.join(baseDir, 'strokes');
                                filename = `${workoutId}.json`;
                                break;
                            case 'metadata':
                                targetDir = baseDir;
                                filename = 'metadata.json';
                                break;
                            case 'summary':
                                targetDir = baseDir;
                                filename = 'results-summary.json';
                                break;
                            default:
                                res.statusCode = 400;
                                res.end(JSON.stringify({ error: 'Invalid type' }));
                                return;
                        }

                        // Ensure directory exists
                        fs.mkdirSync(targetDir, { recursive: true });

                        // Write file
                        const filePath = path.join(targetDir, filename);
                        fs.writeFileSync(filePath, JSON.stringify(workoutData, null, 2));

                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({
                            success: true,
                            path: filePath,
                            message: `Saved ${type} ${workoutId || ''}`
                        }));
                    } catch (error: any) {
                        console.error('Error saving workout:', error);
                        res.statusCode = 500;
                        res.end(JSON.stringify({ error: error.message }));
                    }
                });
            });
        },
    };
}
