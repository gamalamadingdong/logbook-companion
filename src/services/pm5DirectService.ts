import { PM5CapacitorDriver } from '@readyall/erglink/pm5/capacitor';
import type {
  PM5CaptureEvidence,
  PM5Data,
  PM5Device,
  PM5Diagnostic,
  PM5Driver,
  PM5StatusProbe,
  WorkoutConfig,
} from '@readyall/erglink/pm5';
import type {
  ActiveWorkoutSpec,
  PM5ProgrammingReceiptV1,
  PM5ProgrammingStatus,
} from '../types/ergSession.types';

export function activeWorkoutSpecToWorkoutConfig(workout: ActiveWorkoutSpec): WorkoutConfig {
  const fixedInterval = workout.type === 'interval_distance' || workout.type === 'interval_time';
  const intervals: NonNullable<WorkoutConfig['intervals']> = [];

  for (const interval of workout.intervals ?? []) {
    if (interval.type === 'rest') {
      const previous = intervals.at(-1);
      if (previous) previous.rest = interval.value;
      continue;
    }
    intervals.push({
      type: interval.type,
      value: interval.value,
      rest: interval.rest ?? 0,
    });
  }

  return {
    type: workout.type,
    value: workout.value ?? (fixedInterval ? workout.split_value : undefined),
    split: workout.split_value,
    rest: workout.rest,
    repeats: workout.repeats,
    intervals: workout.intervals ? intervals : undefined,
  };
}

function classifyProgrammingError(error: unknown): { status: PM5ProgrammingStatus; message: string } {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (normalized.includes('rejected')) return { status: 'rejected', message };
  if (normalized.includes('not ready')) return { status: 'not_ready', message };
  if (normalized.includes('unsupported') || normalized.includes('limited to 20 bytes')) {
    return { status: 'unsupported', message };
  }
  return { status: 'transport_error', message };
}

export class DirectPM5Service {
  private readonly driver: PM5Driver;
  private readonly now: () => string;

  constructor(
    driver: PM5Driver,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.driver = driver;
    this.now = now;
  }

  initialize(): Promise<void> {
    return this.driver.initialize();
  }

  isAvailable(): Promise<boolean> {
    return this.driver.isAvailable();
  }

  onDeviceDiscovered(callback: (device: PM5Device) => void): void {
    this.driver.onDeviceDiscovered(callback);
  }

  startScan(): Promise<void> {
    return this.driver.startScan();
  }

  stopScan(): Promise<void> {
    return this.driver.stopScan();
  }

  connect(deviceId: string): Promise<void> {
    return this.driver.connect(deviceId);
  }

  disconnect(): Promise<void> {
    return this.driver.disconnect();
  }

  isConnected(): boolean {
    return this.driver.isConnected();
  }

  getConnectedDevice(): PM5Device | null {
    return this.driver.getConnectedDevice();
  }

  onData(callback: (data: PM5Data) => void): void {
    this.driver.onData(callback);
  }

  getDiagnostics(): Promise<PM5Diagnostic> {
    return this.driver.getDiagnostics();
  }

  probeStatus(): Promise<PM5StatusProbe> {
    return this.driver.probeStatus();
  }

  getCaptureEvidence(): PM5CaptureEvidence {
    return this.driver.getCaptureEvidence();
  }

  async program(request: ActiveWorkoutSpec): Promise<PM5ProgrammingReceiptV1> {
    const receivedAt = this.now();
    const requestId = request.programming_request_id;
    if (!requestId) {
      return {
        _v: 1,
        request_id: 'missing-request-id',
        status: 'unsupported',
        received_at: receivedAt,
        completed_at: this.now(),
        error: 'Programming request is missing programming_request_id',
      };
    }

    try {
      await this.driver.programWorkout(activeWorkoutSpecToWorkoutConfig(request));
      return {
        _v: 1,
        request_id: requestId,
        status: 'programmed',
        received_at: receivedAt,
        completed_at: this.now(),
      };
    } catch (error) {
      const classified = classifyProgrammingError(error);
      return {
        _v: 1,
        request_id: requestId,
        status: classified.status,
        received_at: receivedAt,
        completed_at: this.now(),
        error: classified.message,
      };
    }
  }
}

export const directPM5Service = new DirectPM5Service(new PM5CapacitorDriver());
