import { describe, it, expect } from 'vitest';
import { parseRWN } from '../parser';
import { structureToWhiteboard } from '../whiteboard';

function wb(rwn: string): string[] {
    const parsed = parseRWN(rwn);
    expect(parsed).not.toBeNull();
    return structureToWhiteboard(parsed!);
}

describe('structureToWhiteboard', () => {
    it('steady state distance', () => {
        expect(wb('10000m')).toEqual(['10000m']);
    });

    it('steady state time with rate', () => {
        expect(wb('30:00@r20')).toEqual(['30:00  @ r20']);
    });

    it('basic intervals', () => {
        expect(wb('4x500m/1:00r')).toEqual(['4 × 500m / 1:00 rest']);
    });

    it('time intervals', () => {
        expect(wb('8x1:00/1:00r')).toEqual(['8 × 1:00 / 1:00 rest']);
    });

    it('rate ladder (tabular)', () => {
        const lines = wb('4000m@r20 + 3000m@r22 + 2000m@r24 + 1000m@r28');
        expect(lines.length).toBe(4);
        expect(lines[0]).toContain('4000m');
        expect(lines[0]).toContain('r20');
        expect(lines[3]).toContain('1000m');
        expect(lines[3]).toContain('r28');
    });

    it('warmup + intervals + cooldown', () => {
        const lines = wb('[w]10:00 + 5x500m/1:00r + [c]5:00');
        expect(lines[0]).toContain('W/U');
        expect(lines[0]).toContain('10:00');
        const intervalLine = lines.find(l => l.includes('×'));
        expect(intervalLine).toContain('5 × 500m');
        expect(intervalLine).toContain('1:00 rest');
        const cooldown = lines.find(l => l.includes('C/D'));
        expect(cooldown).toContain('5:00');
    });

    it('rate pyramid (tabular)', () => {
        const lines = wb('[w]5:00 + 5:00@r20 + 5:00@r22 + 5:00@r24 + 5:00@r22 + [c]5:00');
        expect(lines[0]).toContain('W/U');
        expect(lines[lines.length - 1]).toContain('C/D');
        // Middle lines should have rates
        const rateLines = lines.filter(l => l.includes('r2'));
        expect(rateLines.length).toBe(4);
    });

    it('partner workout', () => {
        const lines = wb('partner(on=4x1000m/...r, off=wait)');
        expect(lines[0]).toContain('PARTNERS');
        expect(lines[0]).toContain('4 × 1000m each');
        expect(lines[1]).toBe('A: erg');
        expect(lines[2]).toBe('B: rest');
        expect(lines[3]).toContain('Switch each piece');
    });

    it('relay', () => {
        const lines = wb('relay(leg=500m, total=6000m, team_size=4)');
        expect(lines[0]).toContain('RELAY');
        expect(lines[0]).toContain('4 rowers');
        expect(lines[1]).toContain('500m');
        expect(lines[1]).toContain('12');
    });

    it('circuit', () => {
        const lines = wb('circuit(20 burpees, 20 pushups, 20 situps, 1:00 plank)');
        expect(lines[0]).toBe('CIRCUIT');
        expect(lines[1]).toContain('①');
        expect(lines[1]).toContain('20 burpees');
        expect(lines.length).toBe(5); // header + 4 items
    });

    it('variable pyramid', () => {
        const lines = wb('(2000m+1000m+500m)/3:00r');
        expect(lines.some(l => l.includes('2000m'))).toBe(true);
        expect(lines.some(l => l.includes('500m'))).toBe(true);
        expect(lines.some(l => l.includes('3:00 rest'))).toBe(true);
    });

    it('sub-segment breakdown (rate build)', () => {
        const lines = wb('2000m[500m@r22 + 500m@r24 + 500m@r26 + 500m@r30]');
        expect(lines[0]).toContain('2000m');
        expect(lines.length).toBe(5); // header + 4 segments
        expect(lines[1]).toContain('500m');
        expect(lines[1]).toContain('r22');
        expect(lines[4]).toContain('r30');
    });
});
