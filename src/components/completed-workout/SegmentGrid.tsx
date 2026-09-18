import { useState } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, Copy, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { newSegmentForm, type SegmentForm } from './segmentForm';

interface Props {
  segments: SegmentForm[];
  onChange: (segments: SegmentForm[], planChanged?: boolean) => void;
  distanceUnit: 'm' | 'km';
  errors: Record<string, string>;
  hasLinkedPlan: boolean;
}

const columns = 'grid grid-cols-2 items-center gap-x-2 gap-y-2 lg:grid-cols-[2rem_7rem_8rem_7rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem]';

function plannedText(segment: SegmentForm): string {
  if (segment.targetKind === 'none') return 'No planned target';
  const unit = segment.targetKind === 'distance' ? ' m' : segment.targetKind === 'calories' ? ' cal' : '';
  return `${segment.targetValue || 'Enter target'}${unit}`;
}

export function SegmentGrid({ segments, onChange, distanceUnit, errors, hasLinkedPlan }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const update = (index: number, patch: Partial<SegmentForm>, planChanged = false) =>
    onChange(segments.map((item, current) => current === index ? { ...item, ...patch } : item), planChanged);
  const changeRole = (index: number, role: SegmentForm['role']) => {
    const item = segments[index];
    if (role === 'rest' && (item.calories || item.watts) &&
        !window.confirm('Changing this row to Rest will clear its entered calories and watts. Continue?')) return;
    update(index, { role, intervalKind: role === 'rest' ? 'none' : item.intervalKind,
      calories: role === 'rest' ? '' : item.calories, watts: role === 'rest' ? '' : item.watts });
  };
  const move = (index: number, direction: -1 | 1) => {
    const other = index + direction;
    if (other < 0 || other >= segments.length) return;
    const next = [...segments];
    [next[index], next[other]] = [next[other], next[index]];
    onChange(next);
  };
  const remove = (index: number) => {
    const item = segments[index];
    if ((item.distance || item.duration || item.calories || item.watts) && !window.confirm(`Remove segment ${index + 1} and its entered results?`)) return;
    onChange(segments.filter((_, current) => current !== index));
  };
  const copy = (index: number) => {
    const item = segments[index];
    const blank = { ...newSegmentForm(item.role), intervalKind: item.intervalKind, label: item.label, targetKind: item.targetKind, targetValue: item.targetValue };
    onChange([...segments.slice(0, index + 1), blank, ...segments.slice(index + 1)]);
    setExpandedId(blank.id);
  };

  return <div className="space-y-3">
    <div className={clsx(columns, 'hidden border-b border-border px-3 pb-2 text-xs font-medium text-content-muted lg:grid')} aria-hidden="true">
      <span>#</span><span>Segment</span><span>Basis</span><span>Planned</span><span>Actual ({distanceUnit})</span><span>Actual time</span><span>More</span>
    </div>
    <div className="divide-y divide-border-subtle rounded-lg border border-border bg-surface-card">
      {segments.map((segment, index) => {
        const rowError = errors[`segments.${index}`];
        const basisError = errors[`segments.${index}.intervalKind`];
        const targetError = errors[`segments.${index}.target`];
        const expanded = expandedId === segment.id;
        return <div key={segment.id} data-segment-error={rowError || basisError || targetError ? true : undefined} className={clsx('px-3 py-3', (rowError || basisError || targetError) && 'bg-surface-secondary')}>
          <div className={columns}>
            <div className="col-span-2 row-start-1 flex min-w-0 items-center gap-2 lg:hidden">
              <p className="min-w-0 flex-1 text-sm text-content-primary">
                <span className="mr-2 font-semibold tabular-nums text-content-muted">{index + 1}</span>
                {segment.role === 'work' ? 'Work' : 'Rest'}
                {segment.role === 'work' && segment.intervalKind !== 'none' ? ' · ' + (segment.intervalKind === 'distance' ? 'Distance' : 'Time') : ''}
                <span className="text-content-muted"> · {plannedText(segment)}</span>
              </p>
              <Button type="button" variant="ghost" className="min-h-11 min-w-11 shrink-0 p-0" aria-label={(expanded ? 'Close' : 'Open') + ' details for segment ' + (index + 1)} aria-expanded={expanded} icon={<MoreHorizontal size={18} />} onClick={() => setExpandedId(expanded ? null : segment.id)} />
            </div>
            <span className="hidden text-xs font-semibold tabular-nums text-content-muted lg:col-start-1 lg:row-start-1 lg:block">{index + 1}</span>
            <div className="hidden min-w-0 lg:col-start-2 lg:row-start-1 lg:block">
              <Select aria-label={'Segment ' + (index + 1) + ' type'} value={segment.role} onChange={(event) => changeRole(index, event.target.value as SegmentForm['role'])} className="min-h-11 w-full">
                <option value="work">Work</option><option value="rest">Rest</option>
              </Select>
            </div>
            <div className="hidden min-w-0 lg:col-start-3 lg:row-start-1 lg:block">
              {segment.role === 'work' ? <Select aria-label={'Segment ' + (index + 1) + ' interval basis'} value={segment.intervalKind} aria-invalid={Boolean(basisError)} onChange={(event) => update(index, { intervalKind: event.target.value as SegmentForm['intervalKind'] })} error={basisError} className="min-h-11 w-full">
                <option value="none">Choose basis</option><option value="distance">Distance</option><option value="time">Time</option>
              </Select> : <span className="block text-sm text-content-secondary lg:py-3">Rest</span>}
            </div>
            <div className="hidden min-w-0 text-sm text-content-secondary lg:col-start-4 lg:row-start-1 lg:block">{plannedText(segment)}</div>
            <div className="col-start-1 row-start-2 min-w-0 lg:col-start-5 lg:row-start-1">
              <Input aria-label={'Segment ' + (index + 1) + ' actual distance (' + distanceUnit + ')'} inputMode="decimal" value={segment.distance} onChange={(event) => update(index, { distance: event.target.value })} placeholder={'Actual ' + distanceUnit} className="min-h-11" />
            </div>
            <div className="col-start-2 row-start-2 min-w-0 lg:col-start-6 lg:row-start-1">
              <Input aria-label={'Segment ' + (index + 1) + ' actual time'} inputMode="decimal" value={segment.duration} onChange={(event) => update(index, { duration: event.target.value })} placeholder="Actual time" className="min-h-11" />
            </div>
            <Button type="button" variant="ghost" className="hidden min-h-11 min-w-11 p-0 lg:col-start-7 lg:row-start-1 lg:inline-flex" aria-label={(expanded ? 'Close' : 'Open') + ' details for segment ' + (index + 1)} aria-expanded={expanded} icon={<MoreHorizontal size={18} />} onClick={() => setExpandedId(expanded ? null : segment.id)} />
          </div>
          {(rowError || basisError || targetError) && <p className="mt-2 text-sm text-accent-danger" role="alert">{basisError || targetError || rowError}{basisError && <span className="lg:hidden"> Open More to choose a basis.</span>}</p>}
          {expanded && <div className="mt-3 space-y-3 border-t border-border-subtle pt-3">
            <div className="grid grid-cols-2 gap-3 lg:hidden">
              <Select id={"segment-" + segment.id + "-mobile-role"} label="Segment" value={segment.role} onChange={(event) => changeRole(index, event.target.value as SegmentForm['role'])} className="min-h-11">
                <option value="work">Work</option><option value="rest">Rest</option>
              </Select>
              {segment.role === 'work' && <Select id={"segment-" + segment.id + "-mobile-basis"} label="Basis" value={segment.intervalKind} aria-invalid={Boolean(basisError)} onChange={(event) => update(index, { intervalKind: event.target.value as SegmentForm['intervalKind'] })} error={basisError} className="min-h-11">
                <option value="none">Choose basis</option><option value="distance">Distance</option><option value="time">Time</option>
              </Select>}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input id={"segment-" + segment.id + "-label"} label="Label (optional)" value={segment.label} onChange={(event) => update(index, { label: event.target.value })} placeholder="Warmup, rep 1…" className="min-h-11" />
              {segment.role === 'work' && <Input id={"segment-" + segment.id + "-calories"} label="Calories (optional)" inputMode="numeric" value={segment.calories} onChange={(event) => update(index, { calories: event.target.value })} className="min-h-11" />}
              {segment.role === 'work' && <Input id={"segment-" + segment.id + "-watts"} label="Average watts (optional)" inputMode="numeric" value={segment.watts} onChange={(event) => update(index, { watts: event.target.value })} className="min-h-11" />}
            </div>
            <div className="grid grid-cols-1 gap-3 border-t border-border-subtle pt-3 sm:grid-cols-2">
              <Select id={"segment-" + segment.id + "-target-kind"} label="Planned target type" value={segment.targetKind} onChange={(event) => update(index, { targetKind: event.target.value as SegmentForm['targetKind'], targetValue: '' }, true)} className="min-h-11">
                <option value="none">None</option><option value="distance">Distance</option><option value="time">Time</option><option value="calories">Calories</option>
              </Select>
              {segment.targetKind !== 'none' && <Input id={"segment-" + segment.id + "-target-value"} label={segment.targetKind === 'distance' ? 'Planned meters' : segment.targetKind === 'time' ? 'Planned time' : 'Planned calories'} inputMode="decimal" value={segment.targetValue} onChange={(event) => update(index, { targetValue: event.target.value }, true)} error={targetError} className="min-h-11" />}
            </div>
            {hasLinkedPlan && <p className="text-xs text-content-muted">Editing a planned target clears the linked RWN and template. Your actual results stay here.</p>}
            <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-3">
              <Button type="button" variant="ghost" className="min-h-11" icon={<ArrowUp size={16} />} disabled={index === 0} onClick={() => move(index, -1)}>Up</Button>
              <Button type="button" variant="ghost" className="min-h-11" icon={<ArrowDown size={16} />} disabled={index === segments.length - 1} onClick={() => move(index, 1)}>Down</Button>
              <Button type="button" variant="ghost" className="min-h-11" icon={<Copy size={16} />} onClick={() => copy(index)}>Copy blank</Button>
              <Button type="button" variant="danger" className="min-h-11" icon={<Trash2 size={16} />} onClick={() => remove(index)}>Remove</Button>
            </div>
          </div>}
        </div>;
      })}
    </div>
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" className="min-h-11" icon={<Plus size={16} />} onClick={() => onChange([...segments, newSegmentForm('work')])}>Add work</Button>
      <Button type="button" variant="secondary" className="min-h-11" icon={<Plus size={16} />} onClick={() => onChange([...segments, newSegmentForm('rest')])}>Add rest</Button>
    </div>
  </div>;
}
