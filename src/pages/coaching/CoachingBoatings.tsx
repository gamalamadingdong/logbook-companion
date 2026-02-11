import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { parseLocalDate } from '../../utils/dateUtils';
import {
  getBoatings,
  getAthletes,
  createBoating,
  updateBoating,
  deleteBoating,
  duplicateBoating,
  type CoachingBoating,
  type CoachingAthlete,
  type BoatPosition,
} from '../../services/coaching/coachingService';
import { format } from 'date-fns';
import { Plus, X, Copy, ChevronDown, ChevronUp, Edit2, Trash2, Loader2 } from 'lucide-react';
import { CoachingNav } from '../../components/coaching/CoachingNav';

export function CoachingBoatings() {
  const { user } = useAuth();
  const coachId = user?.id ?? '';
  const [athletes, setAthletes] = useState<CoachingAthlete[]>([]);
  const [boatings, setBoatings] = useState<CoachingBoating[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingBoating, setEditingBoating] = useState<CoachingBoating | null>(null);
  const [expandedBoating, setExpandedBoating] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!coachId) return;
    Promise.all([getAthletes(coachId), getBoatings(coachId)])
      .then(([a, b]) => {
        setAthletes(a);
        setBoatings(b);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setIsLoading(false));
  }, [coachId]);

  const refreshData = async () => {
    if (!coachId) return;
    try {
      const [a, b] = await Promise.all([getAthletes(coachId), getBoatings(coachId)]);
      setAthletes(a);
      setBoatings(b);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    }
  };

  const handleSave = async (data: Pick<CoachingBoating, 'date' | 'boat_name' | 'boat_type' | 'positions' | 'notes'>) => {
    await createBoating(coachId, data);
    setIsAdding(false);
    await refreshData();
  };

  const handleEdit = async (data: Pick<CoachingBoating, 'date' | 'boat_name' | 'boat_type' | 'positions' | 'notes'>) => {
    if (!editingBoating) return;
    await updateBoating(editingBoating.id, data);
    setEditingBoating(null);
    await refreshData();
  };

  const handleDelete = async (id: string) => {
    await deleteBoating(id);
    await refreshData();
  };

  const handleDuplicate = async (boating: CoachingBoating) => {
    await duplicateBoating(coachId, boating);
    await refreshData();
  };

  const getAthleteName = (athleteId: string) =>
    athletes.find((a) => a.id === athleteId)?.name ?? 'Unknown';

  // Group by date
  const boatingsByDate = boatings.reduce((acc, boating) => {
    const dateKey = boating.date.slice(0, 10);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(boating);
    return acc;
  }, {} as Record<string, CoachingBoating[]>);

  return (
    <>
    <CoachingNav />
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Boatings</h1>
            <p className="text-neutral-400 mt-1">
              {boatings.length} lineup{boatings.length !== 1 ? 's' : ''} saved
            </p>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            disabled={athletes.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-5 h-5" />
            New Lineup
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
          <button onClick={() => { setError(null); refreshData(); }} className="ml-3 underline hover:text-red-300">Retry</button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      ) : athletes.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-500/10 flex items-center justify-center">
            <Plus className="w-8 h-8 text-indigo-400" />
          </div>
          <p className="text-neutral-400 mb-4">Add athletes first to create lineups</p>
          <a href="/coaching/roster" className="text-indigo-400 hover:underline font-medium">Go to Roster</a>
        </div>
      ) : Object.keys(boatingsByDate).length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-teal-900/20 flex items-center justify-center">
            <Plus className="w-8 h-8 text-teal-500" />
          </div>
          <p className="text-neutral-400 mb-4">No lineups recorded yet</p>
          <button onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors">
            Create your first lineup
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(boatingsByDate).map(([dateKey, dayBoatings]) => (
            <div key={dateKey}>
              <h3 className="font-semibold text-neutral-500 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                {format(parseLocalDate(dateKey), 'EEEE, MMMM d, yyyy')}
              </h3>
              <div className="space-y-3">
                {dayBoatings.map((boating) => (
                  <div key={boating.id} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                    <div
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-neutral-800/50 transition-colors"
                      onClick={() => setExpandedBoating(expandedBoating === boating.id ? null : boating.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                          <span className="text-white font-bold text-sm">{boating.boat_type}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-white">{boating.boat_name}</p>
                          <p className="text-sm text-neutral-500">
                            {boating.positions.length} seat{boating.positions.length !== 1 ? 's' : ''} filled
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingBoating(boating); }}
                          className="p-2 hover:bg-neutral-700 rounded-lg transition-colors"
                          title="Edit lineup"
                        >
                          <Edit2 className="w-4 h-4 text-neutral-500" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(boating.id); }}
                          className="p-2 hover:bg-neutral-700 rounded-lg transition-colors"
                          title="Delete lineup"
                        >
                          <Trash2 className="w-4 h-4 text-neutral-500" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDuplicate(boating); }}
                          className="p-2 hover:bg-neutral-700 rounded-lg transition-colors"
                          title="Duplicate for today"
                        >
                          <Copy className="w-4 h-4 text-neutral-500" />
                        </button>
                        {expandedBoating === boating.id ? (
                          <ChevronUp className="w-5 h-5 text-indigo-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-neutral-500" />
                        )}
                      </div>
                    </div>

                    {expandedBoating === boating.id && (
                      <div className="border-t border-neutral-800 p-4 bg-neutral-800/30">
                        <BoatDiagram
                          boatType={boating.boat_type}
                          positions={boating.positions}
                          getAthleteName={getAthleteName}
                        />
                        {boating.notes && (
                          <p className="mt-4 text-sm text-neutral-400 bg-neutral-800 p-3 rounded-xl">
                            {boating.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {isAdding && (
        <BoatingForm athletes={athletes} allBoatings={boatings} onSave={handleSave} onCancel={() => setIsAdding(false)} />
      )}

      {editingBoating && (
        <BoatingForm
          athletes={athletes}
          allBoatings={boatings}
          boating={editingBoating}
          onSave={handleEdit}
          onCancel={() => setEditingBoating(null)}
        />
      )}
    </div>
    </>
  );
}

/* ─── Boat Diagram ─────────────────────────────────────────────────────────── */

function BoatDiagram({
  boatType,
  positions,
  getAthleteName,
}: {
  boatType: CoachingBoating['boat_type'];
  positions: BoatPosition[];
  getAthleteName: (id: string) => string;
}) {
  const seatCount =
    boatType === '8+' ? 8 :
    ['4+', '4x', '4-'].includes(boatType) ? 4 :
    ['2x', '2-'].includes(boatType) ? 2 : 1;
  const hasCox = boatType.includes('+');

  const getSeatLabel = (seat: number) => {
    if (seat === 0) return 'Cox';
    if (seat === seatCount) return 'Stroke';
    if (seat === 1) return 'Bow';
    return seat.toString();
  };

  const getAthleteForSeat = (seat: number) => {
    const pos = positions.find((p) => p.seat === seat);
    return pos ? getAthleteName(pos.athlete_id) : '—';
  };

  return (
    <div className="space-y-2">
      {hasCox && (
        <div className="flex items-center gap-3 p-3 bg-amber-900/20 border border-amber-800/30 rounded-xl">
          <span className="w-20 text-sm font-semibold text-amber-400">Cox</span>
          <span className="text-sm font-medium text-neutral-300">{getAthleteForSeat(0)}</span>
        </div>
      )}
      {Array.from({ length: seatCount }, (_, i) => seatCount - i).map((seat) => (
        <div
          key={seat}
          className={`flex items-center gap-3 p-3 rounded-xl ${
            seat === seatCount
              ? 'bg-indigo-500/10 border border-indigo-500/20'
              : seat === 1
              ? 'bg-teal-900/20 border border-teal-800/30'
              : 'bg-neutral-800'
          }`}
        >
          <span className={`w-20 text-sm font-semibold ${
            seat === seatCount ? 'text-indigo-400' : seat === 1 ? 'text-teal-400' : 'text-neutral-400'
          }`}>
            {getSeatLabel(seat)}
          </span>
          <span className="text-sm font-medium text-neutral-300">{getAthleteForSeat(seat)}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Boating Form ─────────────────────────────────────────────────────────── */

function BoatingForm({
  athletes,
  allBoatings,
  boating,
  onSave,
  onCancel,
}: {
  athletes: CoachingAthlete[];
  allBoatings: CoachingBoating[];
  boating?: CoachingBoating;
  onSave: (data: Pick<CoachingBoating, 'date' | 'boat_name' | 'boat_type' | 'positions' | 'notes'>) => void;
  onCancel: () => void;
}) {
  const [boatName, setBoatName] = useState(boating?.boat_name ?? '');
  const [boatType, setBoatType] = useState<CoachingBoating['boat_type']>(boating?.boat_type ?? '8+');
  const [date, setDate] = useState(boating?.date?.slice(0, 10) ?? format(new Date(), 'yyyy-MM-dd'));
  const [positions, setPositions] = useState<BoatPosition[]>(boating?.positions ?? []);
  const [notes, setNotes] = useState(boating?.notes ?? '');

  // Athlete IDs already seated in OTHER boats on this date
  const takenAthleteIds = new Set(
    allBoatings
      .filter((b) => b.date.slice(0, 10) === date && b.id !== boating?.id)
      .flatMap((b) => b.positions.map((p) => p.athlete_id))
  );

  /** Returns available athletes for a given seat, excluding those in other boats or other seats of this boat */
  const getAvailableAthletes = (seat: number) => {
    const currentId = getAthleteForSeat(seat);
    const otherSeatIds = new Set(
      positions.filter((p) => p.seat !== seat).map((p) => p.athlete_id)
    );
    return athletes.filter(
      (a) => a.id === currentId || (!takenAthleteIds.has(a.id) && !otherSeatIds.has(a.id))
    );
  };

  const seatCount =
    boatType === '8+' ? 8 :
    ['4+', '4x', '4-'].includes(boatType) ? 4 :
    ['2x', '2-'].includes(boatType) ? 2 : 1;
  const hasCox = boatType.includes('+');

  const getSeatLabel = (seat: number) => {
    if (seat === 0) return 'Coxswain';
    if (seat === seatCount) return `${seat} (Stroke)`;
    if (seat === 1) return '1 (Bow)';
    return seat.toString();
  };

  const setPosition = (seat: number, athleteId: string) => {
    if (!athleteId) {
      setPositions(positions.filter((p) => p.seat !== seat));
    } else {
      const existing = positions.find((p) => p.seat === seat);
      if (existing) {
        setPositions(positions.map((p) => (p.seat === seat ? { ...p, athlete_id: athleteId } : p)));
      } else {
        setPositions([...positions, { seat, athlete_id: athleteId }]);
      }
    }
  };

  const getAthleteForSeat = (seat: number) =>
    positions.find((p) => p.seat === seat)?.athlete_id ?? '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      boat_name: boatName,
      boat_type: boatType,
      date,
      positions,
      notes: notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-md my-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">{boating ? 'Edit Lineup' : 'New Lineup'}</h2>
          <button onClick={onCancel} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors" title="Close">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="boat-name" className="block text-sm font-medium text-neutral-300 mb-2">Boat Name</label>
              <input id="boat-name" type="text" value={boatName} onChange={(e) => setBoatName(e.target.value)}
                placeholder="e.g. Varsity 8+"
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label htmlFor="boat-type" className="block text-sm font-medium text-neutral-300 mb-2">Boat Type</label>
              <select id="boat-type" value={boatType}
                onChange={(e) => { setBoatType(e.target.value as CoachingBoating['boat_type']); setPositions([]); }}
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
                <option value="8+">8+ (Eight with Cox)</option>
                <option value="4+">4+ (Four with Cox)</option>
                <option value="4-">4- (Coxless Four)</option>
                <option value="4x">4x (Quad)</option>
                <option value="2x">2x (Double)</option>
                <option value="2-">2- (Pair)</option>
                <option value="1x">1x (Single)</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="boating-date" className="block text-sm font-medium text-neutral-300 mb-2">Date</label>
            <input id="boating-date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
          </div>

          {/* Seat assignments */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-300 mb-2">Seats</label>

            {hasCox && (
              <div className="flex items-center gap-3 p-2 bg-amber-900/20 rounded-xl">
                <label htmlFor="seat-cox" className="w-24 text-sm font-medium text-amber-400">Coxswain</label>
                <select id="seat-cox" value={getAthleteForSeat(0)} onChange={(e) => setPosition(0, e.target.value)}
                  className="flex-1 px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
                  <option value="">— Select —</option>
                  {getAvailableAthletes(0).map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.side === 'coxswain' ? ' ⚓' : ''}</option>
                  ))}
                </select>
              </div>
            )}

            {Array.from({ length: seatCount }, (_, i) => seatCount - i).map((seat) => (
              <div key={seat} className={`flex items-center gap-3 p-2 rounded-xl ${
                seat === seatCount ? 'bg-indigo-500/5' : seat === 1 ? 'bg-teal-900/20' : ''
              }`}>
                <label htmlFor={`seat-${seat}`} className={`w-24 text-sm font-medium ${
                  seat === seatCount ? 'text-indigo-400' : seat === 1 ? 'text-teal-400' : 'text-neutral-400'
                }`}>{getSeatLabel(seat)}</label>
                <select id={`seat-${seat}`} value={getAthleteForSeat(seat)} onChange={(e) => setPosition(seat, e.target.value)}
                  className="flex-1 px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
                  <option value="">— Select —</option>
                  {getAvailableAthletes(seat).map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div>
            <label htmlFor="boating-notes" className="block text-sm font-medium text-neutral-300 mb-2">Notes (optional)</label>
            <textarea id="boating-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
              placeholder="Racing lineup, training notes..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel}
              className="flex-1 px-4 py-3 border border-neutral-700 rounded-xl text-neutral-300 hover:bg-neutral-800 transition-colors font-medium">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors font-medium">
              {boating ? 'Save Changes' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
