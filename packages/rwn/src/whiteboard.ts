/**
 * Convert WorkoutStructure to a coach's whiteboard representation.
 * Produces terse, human-readable text — the kind of thing a coach
 * would actually write on a dry-erase board before practice.
 *
 * Design principles (user-confirmed):
 *   - Tabular format for rate/pace ladders (right-aligned values)
 *   - W/U: / C/D: block labels
 *   - Orchestration type as header (PARTNERS, RELAY, etc.)
 *   - Minimal words — context is implied
 */

import type {
    WorkoutStructure,
    WorkoutStep,
    IntervalStructure,
    VariableStructure,
    SteadyStateStructure,
    SessionExtension,
    BlockType,
} from './types';

// ── Formatters ──────────────────────────────────────────────

function fmtTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '?';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${mins}:00`;
}

function fmtVal(value: number, unit: string): string {
    if (unit === 'meters' || unit === 'distance') return `${value}m`;
    if (unit === 'seconds' || unit === 'time') return fmtTime(value);
    if (unit === 'calories') return `${value}cal`;
    return `${value}`;
}

function fmtGuidance(step: {
    target_rate?: number;
    target_rate_max?: number;
    target_pace?: string;
    target_pace_max?: string;
}): string {
    const parts: string[] = [];
    if (step.target_rate) {
        parts.push(
            step.target_rate_max
                ? `r${step.target_rate}–${step.target_rate_max}`
                : `r${step.target_rate}`,
        );
    }
    if (step.target_pace) {
        parts.push(
            step.target_pace_max
                ? `${step.target_pace}–${step.target_pace_max}`
                : step.target_pace,
        );
    }
    return parts.join(', ');
}

function fmtModality(mod?: string): string {
    if (!mod || mod === 'row') return '';
    return mod.charAt(0).toUpperCase() + mod.slice(1) + ': ';
}

function blockLabel(bt?: BlockType | string): string | null {
    if (bt === 'warmup') return 'W/U';
    if (bt === 'cooldown') return 'C/D';
    if (bt === 'test') return 'TEST';
    return null;
}

function fmtRest(value: number): string {
    if (value <= 0 || !isFinite(value)) return '';
    return `/ ${fmtTime(value)} rest`;
}

const CIRCLE = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
function circleNum(n: number): string {
    return n <= CIRCLE.length ? CIRCLE[n - 1] : `${n}.`;
}

// ── Public API ──────────────────────────────────────────────

export function structureToWhiteboard(structure: WorkoutStructure): string[] {
    if (!structure) return [];

    if (structure.sessionExtension) {
        return renderOrchestration(structure);
    }

    switch (structure.type) {
        case 'steady_state':
            return renderSteadyState(structure);
        case 'interval':
            return renderInterval(structure);
        case 'variable':
            return renderVariable(structure);
        default:
            return [];
    }
}

// ── Renderers ───────────────────────────────────────────────

function renderSteadyState(s: SteadyStateStructure): string[] {
    const mod = fmtModality(s.modality);
    const val = fmtVal(s.value, s.unit);
    const guide = fmtGuidance(s);
    const label = blockLabel(s.blockType);

    // Sub-segment breakdown: tabular with parent header
    if (s.subSegments && s.subSegments.length > 0) {
        const lines: string[] = [];
        const header = label ? `${label}:  ${mod}${val}` : `${mod}${val}`;
        lines.push(header);

        const values = s.subSegments.map(seg => fmtVal(seg.value, seg.duration_type));
        const maxW = Math.max(...values.map(v => v.length));
        for (let i = 0; i < s.subSegments.length; i++) {
            const seg = s.subSegments[i];
            const segGuide = fmtGuidance(seg);
            lines.push(`  ${values[i].padStart(maxW)}${segGuide ? `   ${segGuide}` : ''}`);
        }
        return lines;
    }

    if (label) {
        return [`${label}:  ${mod}${val}${guide ? `  ${guide}` : ''}`];
    }
    return [`${mod}${val}${guide ? `  @ ${guide}` : ''}`];
}

function renderInterval(s: IntervalStructure): string[] {
    const mod = fmtModality(s.modality);
    const work = fmtVal(s.work.value, s.work.type);
    const rest = fmtRest(s.rest.value);
    const guide = fmtGuidance(s.work);
    const label = blockLabel(s.work.blockType);

    const lines: string[] = [];
    let main = `${mod}${s.repeats} × ${work}${rest ? ` ${rest}` : ''}`;
    if (label) main = `${label}:  ${main}`;
    lines.push(main);
    if (guide) lines.push(`  @ ${guide}`);
    return lines;
}

function renderVariable(s: VariableStructure): string[] {
    const steps = s.steps;

    // Tabular rate/pace ladder? (all work, no meaningful rest, varying guidance)
    if (isTabularLadder(steps)) {
        return renderTabular(steps);
    }

    // General case: group consecutive identical work+rest pairs into intervals
    const groups = groupSteps(steps);
    const lines: string[] = [];

    for (const g of groups) {
        const mod = fmtModality(g.modality);
        const val = fmtVal(g.value, g.unit);
        const rest = fmtRest(g.restValue);
        const guide = fmtGuidance(g);
        const label = blockLabel(g.blockType);

        if (g.count > 1) {
            // Collapsed interval
            let line = `${mod}${g.count} × ${val}${rest ? ` ${rest}` : ''}`;
            if (label) line = `${label}:  ${line}`;
            lines.push(line);
            if (guide) lines.push(`  @ ${guide}`);
        } else if (label) {
            lines.push(`${label}:  ${mod}${val}${guide ? `  ${guide}` : ''}`);
        } else {
            let line = `  ${mod}${val}${rest ? ` ${rest}` : ''}`;
            if (guide) line += `  @ ${guide}`;
            lines.push(line);
        }
    }

    return lines;
}

// ── Tabular ladder detection & rendering ────────────────────

function isTabularLadder(steps: WorkoutStep[]): boolean {
    const workSteps = steps.filter((s) => s.type === 'work');
    if (workSteps.length < 2) return false;

    // No meaningful rest between steps
    if (steps.some((s) => s.type === 'rest' && s.value > 0)) return false;

    // At least half the work steps have rate or pace guidance
    const withGuide = workSteps.filter((s) => s.target_rate || s.target_pace);
    return withGuide.length >= workSteps.length * 0.5;
}

function renderTabular(steps: WorkoutStep[]): string[] {
    const workSteps = steps.filter((s) => s.type === 'work');
    const values = workSteps.map((s) => fmtVal(s.value, s.duration_type));
    const maxW = Math.max(...values.map((v) => v.length));
    const lines: string[] = [];

    for (let i = 0; i < workSteps.length; i++) {
        const s = workSteps[i];
        const val = values[i].padStart(maxW);
        const guide = fmtGuidance(s);
        const label = blockLabel(s.blockType);

        if (label) {
            lines.push(`${label}:  ${val}${guide ? `   ${guide}` : ''}`);
        } else {
            lines.push(`  ${val}${guide ? `   ${guide}` : ''}`);
        }
    }
    return lines;
}

// ── Step grouping (collapse repeated intervals) ─────────────

interface StepGroup {
    count: number;
    value: number;
    unit: string;
    restValue: number;
    blockType?: string;
    modality?: string;
    target_rate?: number;
    target_rate_max?: number;
    target_pace?: string;
    target_pace_max?: string;
}

function groupSteps(steps: WorkoutStep[]): StepGroup[] {
    const groups: StepGroup[] = [];
    let i = 0;

    while (i < steps.length) {
        const step = steps[i];
        if (step.type !== 'work') {
            i++;
            continue;
        }

        const nextRest = i + 1 < steps.length && steps[i + 1].type === 'rest';
        const restVal = nextRest ? steps[i + 1].value : 0;

        // Count consecutive identical work+rest pairs
        let count = 1;
        if (nextRest) {
            let j = i + 2;
            while (
                j + 1 < steps.length &&
                steps[j].type === 'work' &&
                steps[j].value === step.value &&
                steps[j].duration_type === step.duration_type &&
                steps[j + 1].type === 'rest' &&
                steps[j + 1].value === restVal
            ) {
                count++;
                j += 2;
            }
        }

        groups.push({
            count,
            value: step.value,
            unit: step.duration_type,
            restValue: restVal,
            blockType: step.blockType,
            modality: step.modality,
            target_rate: step.target_rate,
            target_rate_max: step.target_rate_max,
            target_pace: step.target_pace,
            target_pace_max: step.target_pace_max,
        });

        i += count * (nextRest ? 2 : 1);
    }

    return groups;
}

// ── Orchestration rendering ─────────────────────────────────

function renderOrchestration(structure: WorkoutStructure): string[] {
    const ext = structure.sessionExtension!;
    const lines: string[] = [];

    // Render the core workout (without orchestration wrapper)
    const coreCopy = { ...structure } as Record<string, unknown>;
    delete coreCopy.sessionExtension;
    // Strip the 'orchestration' tag too so it renders cleanly
    if (Array.isArray(coreCopy.tags)) {
        coreCopy.tags = (coreCopy.tags as string[]).filter(
            (t) => t !== 'orchestration' && t !== ext.kind,
        );
    }
    const coreLines = structureToWhiteboard(coreCopy as unknown as WorkoutStructure);

    switch (ext.kind) {
        case 'partner':
            return renderPartner(ext, coreLines);
        case 'relay':
            return renderRelay(ext);
        case 'rotate':
            return renderRotate(ext);
        case 'circuit':
            return renderCircuit(ext);
        default:
            lines.push(...coreLines);
            return lines;
    }
}

function renderPartner(ext: SessionExtension, coreLines: string[]): string[] {
    // Header: "PARTNERS — 4 × 1000m each" (core workout as subtitle)
    const coreSummary = coreLines.map(l => l.trimStart()).join(', ');
    const lines: string[] = [`PARTNERS — ${coreSummary} each`];

    // Lane A / Lane B
    const offTask = ext.off && ext.off !== 'wait' ? ext.off : 'rest';
    lines.push('A: erg');
    lines.push(`B: ${offTask}`);

    const switchRule =
        ext.switch === 'piece_end' || !ext.switch
            ? 'Switch each piece'
            : `Switch every ${ext.switch}`;
    lines.push(switchRule);
    return lines;
}

function renderRelay(ext: SessionExtension): string[] {
    const lines: string[] = [];
    const team = ext.team_size ? ` (${ext.team_size} rowers)` : '';
    lines.push(`RELAY${team}`);

    if (ext.leg && ext.total) {
        const legs = Math.round(ext.total / ext.leg);
        lines.push(`${fmtVal(ext.leg, 'meters')} legs × ${legs} total`);
    } else if (ext.leg) {
        lines.push(`${fmtVal(ext.leg, 'meters')} per leg`);
    }
    return lines;
}

function renderRotate(ext: SessionExtension): string[] {
    const lines: string[] = [];
    const parts: string[] = [];
    if (ext.stations) parts.push(`${ext.stations} stations`);
    if (ext.switch) parts.push(`${ext.switch} each`);
    lines.push(`ROTATE — ${parts.join(', ')}`);

    if (ext.plan && ext.plan.length > 0) {
        ext.plan.forEach((p, i) => {
            lines.push(`  Stn ${i + 1}: ${p}`);
        });
    }
    return lines;
}

function renderCircuit(ext: SessionExtension): string[] {
    const lines: string[] = ['CIRCUIT'];
    if (ext.items) {
        ext.items.forEach((item, i) => {
            lines.push(`  ${circleNum(i + 1)} ${item}`);
        });
    }
    return lines;
}
