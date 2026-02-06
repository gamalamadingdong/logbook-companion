import { describe, it, expect, vi } from 'vitest';
import { findMatchingWorkout, shouldUpgrade } from './reconciliation';

// Mock Supabase Client
const mockSupabase = {
    from: vi.fn(),
    rpc: vi.fn()
};

describe('reconciliation logic', () => {

    describe('shouldUpgrade', () => {
        it('upgrades manual to concept2', () => {
            expect(shouldUpgrade('manual', 'concept2')).toBe(true);
        });

        it('does not upgrade concept2 to manual', () => {
            expect(shouldUpgrade('concept2', 'manual')).toBe(false);
        });

        it('upgrades same source (updates)', () => {
            expect(shouldUpgrade('concept2', 'concept2')).toBe(true);
        });

        it('upgrades erg_link (Silver) to concept2 (Gold)', () => {
            expect(shouldUpgrade('erg_link', 'concept2')).toBe(true);
        });

        it('does not upgrade concept2 (Gold) to erg_link (Silver)', () => {
            expect(shouldUpgrade('concept2', 'erg_link')).toBe(false);
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
