import { useState } from 'react';
import { X } from 'lucide-react';
import type { CoachingAthlete } from '../../services/coaching/coachingService';
import { cmToFtIn, ftInToCm, kgToLbs, lbsToKg } from '../../utils/unitConversion';

interface AthleteEditorModalProps {
  athlete: CoachingAthlete | null; // null = adding new
  squads: string[];
  onSave: (data: Partial<CoachingAthlete> & { squad?: string }) => void;
  onCancel: () => void;
}

export function AthleteEditorModal({ athlete, squads, onSave, onCancel }: AthleteEditorModalProps) {
  const isEditing = !!athlete;

  const [firstName, setFirstName] = useState(athlete?.first_name ?? '');
  const [lastName, setLastName] = useState(athlete?.last_name ?? '');
  const [grade, setGrade] = useState(athlete?.grade ?? '');
  const [experienceLevel, setExperienceLevel] = useState<CoachingAthlete['experience_level']>(
    athlete?.experience_level ?? 'beginner'
  );
  const [side, setSide] = useState<CoachingAthlete['side']>(athlete?.side ?? 'both');
  const [squad, setSquad] = useState(athlete?.squad ?? '');
  const [notes, setNotes] = useState(athlete?.notes ?? '');

  // Height: store internal as cm, allow ft/in input
  const initialCm = athlete?.height_cm ?? null;
  const initialFtIn = initialCm ? cmToFtIn(initialCm) : null;
  const [heightFeet, setHeightFeet] = useState(initialFtIn?.feet?.toString() ?? '');
  const [heightInches, setHeightInches] = useState(initialFtIn?.inches?.toString() ?? '');

  // Weight: store internal as kg, allow lbs input
  const initialLbs = athlete?.weight_kg ? kgToLbs(athlete.weight_kg) : null;
  const [weightLbs, setWeightLbs] = useState(initialLbs?.toString() ?? '');

  // Computed previews
  const heightCmComputed = heightFeet || heightInches
    ? ftInToCm(Number(heightFeet) || 0, Number(heightInches) || 0)
    : null;
  const weightKgComputed = weightLbs ? lbsToKg(Number(weightLbs)) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      first_name: firstName,
      last_name: lastName,
      grade: grade || undefined,
      experience_level: experienceLevel,
      side,
      squad: squad || undefined,
      height_cm: heightCmComputed,
      weight_kg: weightKgComputed,
      notes: notes || undefined,
    } as Partial<CoachingAthlete> & { squad?: string });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">{isEditing ? 'Edit' : 'Add'} Athlete</h2>
          <button onClick={onCancel} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors" title="Close">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="ae-first-name" className="block text-sm font-medium text-neutral-300 mb-1">First Name *</label>
              <input id="ae-first-name" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label htmlFor="ae-last-name" className="block text-sm font-medium text-neutral-300 mb-1">Last Name</label>
              <input id="ae-last-name" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            </div>
          </div>

          {/* Grade + Side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="ae-grade" className="block text-sm font-medium text-neutral-300 mb-1">Grade</label>
              <input id="ae-grade" type="text" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="8"
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label htmlFor="ae-side" className="block text-sm font-medium text-neutral-300 mb-1">Side</label>
              <select id="ae-side" value={side} onChange={(e) => setSide(e.target.value as CoachingAthlete['side'])}
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
                <option value="both">Both</option>
                <option value="port">Port</option>
                <option value="starboard">Starboard</option>
                <option value="coxswain">Coxswain</option>
              </select>
            </div>
          </div>

          {/* Experience */}
          <div>
            <label htmlFor="ae-experience" className="block text-sm font-medium text-neutral-300 mb-1">Experience Level</label>
            <select id="ae-experience" value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value as CoachingAthlete['experience_level'])}
              className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="experienced">Experienced</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          {/* Height (ft/in) */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">Height</label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="relative">
                  <input id="ae-height-ft" type="number" min="0" max="8" value={heightFeet} onChange={(e) => setHeightFeet(e.target.value)} placeholder="5"
                    className="w-full px-4 py-2 pr-8 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">ft</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="relative">
                  <input id="ae-height-in" type="number" min="0" max="11" value={heightInches} onChange={(e) => setHeightInches(e.target.value)} placeholder="11"
                    className="w-full px-4 py-2 pr-8 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">in</span>
                </div>
              </div>
            </div>
            {heightCmComputed != null && heightCmComputed > 0 && (
              <p className="text-xs text-neutral-500 mt-1">{heightCmComputed} cm</p>
            )}
          </div>

          {/* Weight (lbs) */}
          <div>
            <label htmlFor="ae-weight" className="block text-sm font-medium text-neutral-300 mb-1">Weight</label>
            <div className="relative">
              <input id="ae-weight" type="number" min="0" step="0.1" value={weightLbs} onChange={(e) => setWeightLbs(e.target.value)} placeholder="165"
                className="w-full px-4 py-2 pr-10 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">lbs</span>
            </div>
            {weightKgComputed != null && weightKgComputed > 0 && (
              <p className="text-xs text-neutral-500 mt-1">{weightKgComputed} kg</p>
            )}
          </div>

          {/* Squad */}
          <div>
            <label htmlFor="ae-squad" className="block text-sm font-medium text-neutral-300 mb-1">Squad</label>
            <input id="ae-squad" type="text" list="ae-squad-options" value={squad} onChange={(e) => setSquad(e.target.value)}
              placeholder="e.g. Boys A, Girls B, Development"
              className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            {squads.length > 0 && (
              <datalist id="ae-squad-options">
                {squads.map((s) => <option key={s} value={s} />)}
              </datalist>
            )}
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="ae-notes" className="block text-sm font-medium text-neutral-300 mb-1">Notes</label>
            <textarea id="ae-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
              placeholder="Any notes about this athlete..." />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button type="button" onClick={onCancel}
              className="flex-1 px-4 py-2 border border-neutral-700 rounded-lg text-neutral-300 hover:bg-neutral-800 transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
