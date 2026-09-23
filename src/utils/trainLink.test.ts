import { describe, expect, it } from 'vitest';
import { readTrainRwn, trainWithRwnPath } from './trainLink';

describe('train handoff link', () => {
  it('builds a Train link carrying the workout', () => {
    expect(trainWithRwnPath('2000m')).toBe('/pm5?rwn=2000m');
  });

  it('encodes notation that is not URL safe', () => {
    // Interval notation contains / and + which must survive the round trip.
    const path = trainWithRwnPath('4x500m/1:00r');
    expect(path).toBe('/pm5?rwn=4x500m%2F1%3A00r');
    expect(readTrainRwn(path.slice(path.indexOf('?')))).toBe('4x500m/1:00r');
  });

  it('trims surrounding whitespace', () => {
    expect(trainWithRwnPath('  30:00  ')).toBe('/pm5?rwn=30%3A00');
  });

  it('reads handed-off notation back', () => {
    expect(readTrainRwn('?rwn=3x20%3A00%2F2%3A00r')).toBe('3x20:00/2:00r');
  });

  it('treats a missing or blank workout as no handoff', () => {
    expect(readTrainRwn('')).toBeNull();
    expect(readTrainRwn('?other=1')).toBeNull();
    expect(readTrainRwn('?rwn=')).toBeNull();
    expect(readTrainRwn('?rwn=%20%20')).toBeNull();
  });
});
