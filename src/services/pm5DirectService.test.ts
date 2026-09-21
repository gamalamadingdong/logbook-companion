import { describe, expect, it, vi } from 'vitest';
import type { PM5Driver, WorkoutConfig } from '@readyall/erglink/pm5';
import type { ActiveWorkoutSpec } from '../types/ergSession.types';
import { activeWorkoutSpecToWorkoutConfig, DirectPM5Service } from './pm5DirectService';

function createDriver(programWorkout: (workout: WorkoutConfig) => Promise<void>): PM5Driver {
  return {
    initialize: async () => undefined,
    isAvailable: async () => true,
    startScan: async () => undefined,
    stopScan: async () => undefined,
    onDeviceDiscovered: () => undefined,
    connect: async () => undefined,
    disconnect: async () => undefined,
    isConnected: () => true,
    onData: () => undefined,
    getConnectedDevice: () => ({ id: 'pm5-1', name: 'PM5' }),
    getDiagnostics: async () => ({
      device: { id: 'pm5-1', name: 'PM5' },
      controlValueLimit: 20,
      readErrors: [],
    }),
    probeStatus: async () => ({
      rawStatus: 1,
      frameToggle: false,
      previousFrameStatus: 'ok',
      stateMachineState: 'ready',
    }),
    getCaptureEvidence: () => ({
      strokeNotifications: 0,
      splitNotifications: 0,
      summaryNotifications: 0,
    }),
    programWorkout,
    setRaceState: async () => undefined,
  };
}

describe('direct PM5 service', () => {
  it('maps fixed interval work from split_value', () => {
    const config = activeWorkoutSpecToWorkoutConfig({
      _v: 1,
      type: 'interval_distance',
      split_value: 500,
      rest: 210,
      repeats: 8,
    });

    expect(config).toMatchObject({
      type: 'interval_distance',
      value: 500,
      rest: 210,
      repeats: 8,
    });
  });

  it('attaches variable rest steps to the preceding work interval', () => {
    const config = activeWorkoutSpecToWorkoutConfig({
      _v: 1,
      type: 'variable_interval',
      intervals: [
        { type: 'distance', value: 250 },
        { type: 'rest', value: 90 },
        { type: 'distance', value: 500 },
        { type: 'rest', value: 180 },
      ],
    });

    expect(config.intervals).toEqual([
      { type: 'distance', value: 250, rest: 90 },
      { type: 'distance', value: 500, rest: 180 },
    ]);
  });

  it('returns a programmed receipt only after the driver resolves', async () => {
    const programWorkout = vi.fn(async () => undefined);
    const service = new DirectPM5Service(
      createDriver(programWorkout),
      (() => {
        const values = ['2026-09-20T22:00:00.000Z', '2026-09-20T22:00:01.000Z'];
        return () => values.shift() ?? '2026-09-20T22:00:02.000Z';
      })(),
    );
    const request: ActiveWorkoutSpec = {
      _v: 1,
      programming_request_id: 'request-1',
      type: 'fixed_distance',
      value: 2000,
    };

    await expect(service.program(request)).resolves.toMatchObject({
      request_id: 'request-1',
      status: 'programmed',
      received_at: '2026-09-20T22:00:00.000Z',
      completed_at: '2026-09-20T22:00:01.000Z',
    });
    expect(programWorkout).toHaveBeenCalledWith(expect.objectContaining({ type: 'fixed_distance', value: 2000 }));
  });

  it('preserves an explicit PM5 rejection in the receipt', async () => {
    const service = new DirectPM5Service(createDriver(async () => {
      throw new Error('PM5 rejected the previous CSAFE frame');
    }));

    const receipt = await service.program({
      _v: 1,
      programming_request_id: 'request-2',
      type: 'fixed_time',
      value: 1800,
    });

    expect(receipt.status).toBe('rejected');
    expect(receipt.error).toContain('rejected');
  });
});
