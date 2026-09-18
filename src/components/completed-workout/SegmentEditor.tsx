import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { Input, Select } from '../ui/Input';

export interface SegmentForm {
  id: string;
  role: 'work' | 'rest';
  label: string;
  targetKind: 'none' | 'distance' | 'time' | 'calories';
  targetValue: string;
  distance: string;
  duration: string;
  calories: string;
  watts: string;
}

export function newSegmentForm(role: 'work' | 'rest' = 'work'): SegmentForm {
  return {
    id: crypto.randomUUID(), role, label: '', targetKind: 'none', targetValue: '',
    distance: '', duration: '', calories: '', watts: '',
  };
}

interface SegmentEditorProps {
  segments: SegmentForm[];
  onChange: (segments: SegmentForm[]) => void;
  distanceUnit: 'm' | 'km';
  errors: Record<string, string>;
}

export function SegmentEditor({ segments, onChange, distanceUnit, errors }: SegmentEditorProps) {
  const update = (index: number, patch: Partial<SegmentForm>) => onChange(
    segments.map((segment, current) => current === index ? { ...segment, ...patch } : segment),
  );
  const move = (index: number, direction: -1 | 1) => {
    const next = [...segments];
    const other = index + direction;
    if (other < 0 || other >= next.length) return;
    [next[index], next[other]] = [next[other], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {segments.map((segment, index) => (
        <Card key={segment.id} variant="outlined" padding="md">
          <CardHeader
            title={`${index + 1}. ${segment.role === 'work' ? 'Work' : 'Rest'}`}
            subtitle={segment.targetKind === 'none'
              ? 'Enter what actually happened. A planned target is optional.'
              : `Planned: ${segment.targetValue || 'enter target'} ${segment.targetKind === 'distance' ? 'm' : segment.targetKind === 'time' ? 'time' : 'cal'}. Enter actual values below.`}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              id={`segment-${segment.id}-role`}
              label="Segment"
              value={segment.role}
              onChange={(event) => update(index, { role: event.target.value as SegmentForm['role'], calories: '', watts: '' })}
              className="min-h-11"
            >
              <option value="work">Work</option>
              <option value="rest">Rest</option>
            </Select>
            <Input
              id={`segment-${segment.id}-label`}
              label="Label (optional)"
              value={segment.label}
              onChange={(event) => update(index, { label: event.target.value })}
              placeholder="Warmup, rep 1…"
              className="min-h-11"
            />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              id={`segment-${segment.id}-distance`}
              label={`Actual distance (${distanceUnit})`}
              inputMode="decimal"
              value={segment.distance}
              onChange={(event) => update(index, { distance: event.target.value })}
              error={errors[`segments.${index}.distance`]}
              className="min-h-11"
            />
            <Input
              id={`segment-${segment.id}-duration`}
              label="Actual time"
              inputMode="decimal"
              value={segment.duration}
              onChange={(event) => update(index, { duration: event.target.value })}
              placeholder="1:30 or 90"
              error={errors[`segments.${index}.duration`]}
              className="min-h-11"
            />
            {segment.role === 'work' && (
              <>
                <Input
                  id={`segment-${segment.id}-calories`}
                  label="Calories (optional)"
                  inputMode="numeric"
                  value={segment.calories}
                  onChange={(event) => update(index, { calories: event.target.value })}
                  className="min-h-11"
                />
                <Input
                  id={`segment-${segment.id}-watts`}
                  label="Average watts (optional)"
                  inputMode="numeric"
                  value={segment.watts}
                  onChange={(event) => update(index, { watts: event.target.value })}
                  className="min-h-11"
                />
              </>
            )}
          </div>
          {errors[`segments.${index}`] && <p className="mt-2 text-sm text-accent-danger" role="alert">{errors[`segments.${index}`]}</p>}

          <details className="mt-3 rounded-lg border border-border-subtle p-3" open={Boolean(errors[`segments.${index}.target`]) || undefined}>
            <summary className="cursor-pointer text-sm text-content-secondary">Planned target (optional)</summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Select
                id={`segment-${segment.id}-target-kind`}
                label="Target type"
                value={segment.targetKind}
                onChange={(event) => update(index, { targetKind: event.target.value as SegmentForm['targetKind'], targetValue: '' })}
                className="min-h-11"
              >
                <option value="none">None</option>
                <option value="distance">Distance</option>
                <option value="time">Time</option>
                <option value="calories">Calories</option>
              </Select>
              {segment.targetKind !== 'none' && (
                <Input
                  id={`segment-${segment.id}-target-value`}
                  label={segment.targetKind === 'distance' ? 'Target (m)' : segment.targetKind === 'time' ? 'Target time' : 'Target calories'}
                  inputMode="decimal"
                  value={segment.targetValue}
                  onChange={(event) => update(index, { targetValue: event.target.value })}
                  error={errors[`segments.${index}.target`]}
                  className="min-h-11"
                />
              )}
            </div>
          </details>

          <div className="mt-3 flex flex-wrap gap-2 border-t border-border-subtle pt-3">
            <Button type="button" variant="ghost" className="min-h-11" icon={<ArrowUp size={16} />} aria-label={`Move segment ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>Up</Button>
            <Button type="button" variant="ghost" className="min-h-11" icon={<ArrowDown size={16} />} aria-label={`Move segment ${index + 1} down`} disabled={index === segments.length - 1} onClick={() => move(index, 1)}>Down</Button>
            <Button type="button" variant="ghost" className="min-h-11" icon={<Copy size={16} />} onClick={() => onChange([...segments.slice(0, index + 1), { ...segment, id: crypto.randomUUID() }, ...segments.slice(index + 1)])}>Copy</Button>
            <Button type="button" variant="ghost" className="min-h-11 text-accent-danger" icon={<Trash2 size={16} />} aria-label={`Remove segment ${index + 1}`} onClick={() => onChange(segments.filter((_, current) => current !== index))}>Remove</Button>
          </div>
        </Card>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" className="min-h-11" icon={<Plus size={16} />} onClick={() => onChange([...segments, newSegmentForm('work')])}>Add work</Button>
        <Button type="button" variant="secondary" className="min-h-11" icon={<Plus size={16} />} onClick={() => onChange([...segments, newSegmentForm('rest')])}>Add rest</Button>
      </div>
    </div>
  );
}
