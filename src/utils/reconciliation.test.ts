import { describe, it, expect, vi } from 'vitest';
import { findMatchingWorkout, shouldUpgrade } from './reconciliation';

// Mock Supabase Client
const mockSupabase = {
    from: vi.fn(),
    rpc: vi.fn()
};

describe('reconciliation logic', () => {

    describe('shouldUpgrade', () => {
        it('preserves an LC manual result when a nearby Concept2 result has a different identity', () => {
            expect(shouldUpgrade('manual', 'concept2', null, '86940')).toBe(false);
        });

        it('preserves ErgLink evidence when a nearby Concept2 result is imported', () => {
            expect(shouldUpgrade('erg_link_live', 'concept2', null, '86940')).toBe(false);
        });

        it('updates only the same imported Concept2 result ID', () => {
            expect(shouldUpgrade('concept2', 'concept2', '86940', '86940')).toBe(true);
            expect(shouldUpgrade('concept2', 'concept2', '86939', '86940')).toBe(false);
        });

        it('never replaces a Concept2 row with a different source', () => {
            expect(shouldUpgrade('concept2', 'manual', '86940', '86940')).toBe(false);
        });
    });

    describe('findMatchingWorkout', () => {
        it('constructs correct query params', async () => {
            const mockData = [
                { id: 'test-id', source: 'manual', distance_meters: 5000, duration_seconds: 1200 }
            ];

            const queryBuilder: any = {
                then: (resolve: any) => resolve({ data: mockData, error: null })
            };
            queryBuilder.select = vi.fn().mockReturnValue(queryBuilder);
            queryBuilder.eq = vi.fn().mockReturnValue(queryBuilder);
            queryBuilder.gte = vi.fn().mockReturnValue(queryBuilder);
            queryBuilder.lte = vi.fn().mockReturnValue(queryBuilder);

            mockSupabase.from.mockReturnValue(queryBuilder);

            const userId = 'user-123';
            const date = new Date('2023-01-01T12:00:00Z');

            const result = await findMatchingWorkout(mockSupabase as any, {
                userId,
                date,
                distance: 5000,
                timeSeconds: 1200,
                tolerance: { timeSeconds: 60, distanceMeters: 100, durationSeconds: 5 }
            });

            expect(mockSupabase.from).toHaveBeenCalledWith('workout_logs');
            expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', userId);

            // Verify time window (60s tolerance = 60000ms)
            // minDate = 12:00:00 - 60s = 11:59:00
            expect(queryBuilder.gte).toHaveBeenCalledWith('completed_at', '2023-01-01T11:59:00.000Z');
            expect(queryBuilder.lte).toHaveBeenCalledWith('completed_at', '2023-01-01T12:01:00.000Z');

            expect(result).toBeDefined();
            expect(result?.id).toBe('test-id');
        });

        it('prefers the exact provider ID over a nearby manual workout', async () => {
            const candidates = [
                { id: 'manual-id', source: 'manual', external_id: null, distance_meters: 5000, duration_seconds: 1200 },
                { id: 'provider-id', source: 'concept2', external_id: '86940', distance_meters: 5000, duration_seconds: 1200 },
            ];
            const queryBuilder: any = {
                then: (resolve: any) => resolve({ data: candidates, error: null }),
            };
            queryBuilder.select = vi.fn().mockReturnValue(queryBuilder);
            queryBuilder.eq = vi.fn().mockReturnValue(queryBuilder);
            queryBuilder.gte = vi.fn().mockReturnValue(queryBuilder);
            queryBuilder.lte = vi.fn().mockReturnValue(queryBuilder);
            mockSupabase.from.mockReturnValue(queryBuilder);

            const result = await findMatchingWorkout(mockSupabase as any, {
                userId: 'user-123', date: new Date('2026-09-18T12:00:00Z'),
                externalId: '86940', distance: 5000, timeSeconds: 1200,
                tolerance: { timeSeconds: 60, distanceMeters: 100, durationSeconds: 5 },
            });
            expect(result).toMatchObject({ id: 'provider-id', external_id: '86940' });
        });

        it('rejects match if distance outside tolerance', async () => {
            const mockData = [
                { id: 'test-id-bad-dist', source: 'manual', distance_meters: 5500, duration_seconds: 1200 }
            ];

            const queryBuilder: any = {
                then: (resolve: any) => resolve({ data: mockData, error: null })
            };
            queryBuilder.select = vi.fn().mockReturnValue(queryBuilder);
            queryBuilder.eq = vi.fn().mockReturnValue(queryBuilder);
            queryBuilder.gte = vi.fn().mockReturnValue(queryBuilder);
            queryBuilder.lte = vi.fn().mockReturnValue(queryBuilder);

            mockSupabase.from.mockReturnValue(queryBuilder);

            const result = await findMatchingWorkout(mockSupabase as any, {
                userId: 'u1',
                date: new Date(),
                distance: 5000,
                timeSeconds: 1200,
                tolerance: { timeSeconds: 60, distanceMeters: 100, durationSeconds: 5 }
            });

            expect(result).toBeNull();
        });
    });
});
