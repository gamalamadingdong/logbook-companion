import { useState, useEffect, useMemo } from 'react';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { parseLocalDate } from '../../utils/dateUtils';
import {
  getBoatings,
  getOrgBoatings,
  getAthletes,
  getOrgAthletesWithTeam,
  createBoating,
  updateBoating,
  deleteBoating,
  duplicateBoating,
  setBoatingActive,
  type CoachingBoating,
  type CoachingAthlete,
  type BoatPosition,
} from '../../services/coaching/coachingService';
import { format } from 'date-fns';
import { Plus, X, Copy, ChevronDown, ChevronUp, Edit2, Trash2, Loader2, Filter, ArrowRightLeft, Ship, Archive, RotateCcw, History } from 'lucide-react';
import { EmptyState } from '../../components/ui';
import { CoachingNav } from '../../components/coaching/CoachingNav';
import { toast } from 'sonner';

export function CoachingBoatings() {
  const { userId, teamId, isLoadingTeam, filterTeamId, orgId } = useCoachingContext();
  const isOrgWide = filterTeamId === null && !!orgId;
  const effectiveTeamId = filterTeamId ?? teamId;
  const [athletes, setAthletes] = useState<CoachingAthlete[]>([]);
  const [boatings, setBoatings] = useState<CoachingBoating[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingBoating, setEditingBoating] = useState<CoachingBoating | null>(null);
  const [expandedBoating, setExpandedBoating] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSquad, setSelectedSquad] = useState<string | 'all'>('all');
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (isLoadingTeam) return;
    if (!isOrgWide && !effectiveTeamId) return;

    const fetchAthletes = isOrgWide && orgId
      ? () => getOrgAthletesWithTeam(orgId)
      : () => getAthletes(effectiveTeamId);
    const fetchBoatings = isOrgWide && orgId
      ? () => getOrgBoatings(orgId)
      : () => getBoatings(effectiveTeamId);

    Promise.all([fetchAthletes(), fetchBoatings()])
      .then(([a, b]) => {
        setAthletes(a);
        setBoatings(b);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setIsLoading(false));
  }, [effectiveTeamId, isLoadingTeam, isOrgWide, orgId]);

  const refreshData = async () => {
    if (!isOrgWide && !effectiveTeamId) return;
    try {
      const fetchAthletes = isOrgWide && orgId
        ? () => getOrgAthletesWithTeam(orgId)
        : () => getAthletes(effectiveTeamId);
      const fetchBoatings = isOrgWide && orgId
        ? () => getOrgBoatings(orgId)
        : () => getBoatings(effectiveTeamId);

      const [a, b] = await Promise.all([fetchAthletes(), fetchBoatings()]);
      setAthletes(a);
      setBoatings(b);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    }
  };

  const handleSave = async (data: Pick<CoachingBoating, 'date' | 'boat_name' | 'boat_type' | 'positions' | 'notes'>) => {
    const writeTeamId = effectiveTeamId || teamId;
    if (!writeTeamId) return;
    try {
      await createBoating(writeTeamId, userId, data);
      setIsAdding(false);
      await refreshData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save boating');
    }
  };

  const handleEdit = async (data: Pick<CoachingBoating, 'date' | 'boat_name' | 'boat_type' | 'positions' | 'notes'>) => {
    if (!editingBoating) return;
    try {
      await updateBoating(editingBoating.id, data);
      setEditingBoating(null);
      await refreshData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update boating');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBoating(id);
      await refreshData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete boating');
    }
  };

  const handleDuplicate = async (boating: CoachingBoating) => {
    const writeTeamId = effectiveTeamId || teamId;
    if (!writeTeamId) return;
    try {
      await duplicateBoating(writeTeamId, userId, boating);
      await refreshData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to duplicate boating');
    }
  };

  /** Inline update: save new positions for a boating (from diagram seat editing / swap) */
  const handleInlinePositionUpdate = async (boatingId: string, newPositions: BoatPosition[]) => {
    const boating = boatings.find((b) => b.id === boatingId);
    if (!boating) return;
    // Optimistic update
    setBoatings((prev) =>
      prev.map((b) => (b.id === boatingId ? { ...b, positions: newPositions } : b))
    );
    try {
      await updateBoating(boatingId, { positions: newPositions });
    } catch {
      // Revert on error
      await refreshData();
    }
  };

  const handleToggleActive = async (boatingId: string, isActive: boolean) => {
    // Optimistic update
    setBoatings((prev) =>
      prev.map((b) => (b.id === boatingId ? { ...b, is_active: isActive } : b))
    );
    try {
      await setBoatingActive(boatingId, isActive);
    } catch {
      await refreshData();
      toast.error(`Failed to ${isActive ? 'reactivate' : 'archive'} lineup`);
    }
  };

  const getAthleteName = (athleteId: string) =>
    athletes.find((a) => a.id === athleteId)?.name ?? '';

  // Derived: squads and filtered athletes for form
  const squads = [...new Set(athletes.map((a) => a.squad).filter((s): s is string => !!s))].sort();
  const formAthletes = selectedSquad === 'all' ? athletes : athletes.filter((a) => a.squad === selectedSquad);

  // Split active vs archived
  const activeBoatings = useMemo(() => boatings.filter((b) => b.is_active !== false), [boatings]);
  const archivedBoatings = useMemo(() => boatings.filter((b) => b.is_active === false), [boatings]);

  // Group archived by date for history view
  const archivedByDate = useMemo(() => archivedBoatings.reduce((acc, boating) => {
    const dateKey = boating.date.slice(0, 10);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(boating);
    return acc;
  }, {} as Record<string, CoachingBoating[]>), [archivedBoatings]);

  return (
    <>
    <CoachingNav />
    <div className="px-4 sm:px-6 py-6 max-w-6xl mx-auto space-y-6">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Boatings</h1>
            <p className="text-neutral-400 mt-1">
              {activeBoatings.length} current lineup{activeBoatings.length !== 1 ? 's' : ''}
              {archivedBoatings.length > 0 && (
                <span className="text-neutral-600"> · {archivedBoatings.length} archived</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {squads.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-neutral-500" />
                <select
                  value={selectedSquad}
                  onChange={(e) => setSelectedSquad(e.target.value)}
                  className="px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  aria-label="Filter athletes by squad"
                >
                  <option value="all">All Squads</option>
                  {squads.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={() => setIsAdding(true)}
              disabled={athletes.length === 0}
              title={athletes.length === 0 ? 'Add athletes to the roster first' : 'Create a new boat lineup'}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
              New Lineup
            </button>
          </div>
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
        <EmptyState
          icon={<Ship className="w-8 h-8" />}
          title="No athletes on roster"
          description="Add athletes to the roster before creating lineups."
          action={
            <a href="/team-management/roster" className="text-indigo-400 hover:underline font-medium">Go to Roster</a>
          }
        />
      ) : activeBoatings.length === 0 && archivedBoatings.length === 0 ? (
        <EmptyState
          icon={<Ship className="w-8 h-8" />}
          title="No lineups yet"
          description="Create your first boat lineup."
          action={
            <button onClick={() => setIsAdding(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors">
              Create your first lineup
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* ── Current Lineups ── */}
          {activeBoatings.length > 0 ? (
            <div className="space-y-3">
              {activeBoatings.map((boating) => (
                <BoatingCard
                  key={boating.id}
                  boating={boating}
                  athletes={athletes}
                  allBoatings={activeBoatings}
                  expanded={expandedBoating === boating.id}
                  onToggleExpand={() => setExpandedBoating(expandedBoating === boating.id ? null : boating.id)}
                  onEdit={() => setEditingBoating(boating)}
                  onDelete={() => handleDelete(boating.id)}
                  onDuplicate={() => handleDuplicate(boating)}
                  onArchive={() => handleToggleActive(boating.id, false)}
                  onPositionsChange={(newPos) => handleInlinePositionUpdate(boating.id, newPos)}
                  getAthleteName={getAthleteName}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-neutral-500 text-sm">
              No current lineups. Create a new one or reactivate from history.
            </div>
          )}

          {/* ── History ── */}
          {archivedBoatings.length > 0 && (
            <div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-3"
              >
                <History className="w-4 h-4" />
                Past Lineups ({archivedBoatings.length})
                {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showHistory && (
                <div className="space-y-4">
                  {Object.entries(archivedByDate)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([dateKey, dayBoatings]) => (
                    <div key={dateKey}>
                      <h3 className="font-semibold text-neutral-600 mb-2 flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                        {format(parseLocalDate(dateKey), 'EEEE, MMMM d, yyyy')}
                      </h3>
                      <div className="space-y-2">
                        {dayBoatings.map((boating) => (
                          <BoatingCard
                            key={boating.id}
                            boating={boating}
                            athletes={athletes}
                            allBoatings={boatings}
                            expanded={expandedBoating === boating.id}
                            onToggleExpand={() => setExpandedBoating(expandedBoating === boating.id ? null : boating.id)}
                            onEdit={() => setEditingBoating(boating)}
                            onDelete={() => handleDelete(boating.id)}
                            onReactivate={() => handleToggleActive(boating.id, true)}
                            onPositionsChange={(newPos) => handleInlinePositionUpdate(boating.id, newPos)}
                            getAthleteName={getAthleteName}
                            archived
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isAdding && (
        <BoatingForm athletes={formAthletes} allBoatings={activeBoatings} onSave={handleSave} onCancel={() => setIsAdding(false)} />
      )}

      {editingBoating && (
        <BoatingForm
          athletes={formAthletes}
          allBoatings={activeBoatings}
          boating={editingBoating}
          onSave={handleEdit}
          onCancel={() => setEditingBoating(null)}
        />
      )}
    </div>
    </>
  );
}

/* ─── Boating Card ─────────────────────────────────────────────────────────── */

function BoatingCard({
  boating,
  athletes,
  allBoatings,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onDuplicate,
  onArchive,
  onReactivate,
  onPositionsChange,
  getAthleteName,
  archived,
}: {
  boating: CoachingBoating;
  athletes: CoachingAthlete[];
  allBoatings: CoachingBoating[];
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onArchive?: () => void;
  onReactivate?: () => void;
  onPositionsChange: (positions: BoatPosition[]) => void;
  getAthleteName: (id: string) => string;
  archived?: boolean;
}) {
  return (
    <div className={`bg-neutral-900 border rounded-xl overflow-hidden ${archived ? 'border-neutral-800/60 opacity-75' : 'border-neutral-800'}`}>
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-neutral-800/50 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-md ${archived ? 'bg-neutral-700' : 'bg-indigo-600'}`}>
            <span className="text-white font-bold text-sm">{boating.boat_type}</span>
          </div>
          <div>
            <p className="font-semibold text-white">{boating.boat_name}</p>
            <p className="text-sm text-neutral-500">
              {boating.positions.length} seat{boating.positions.length !== 1 ? 's' : ''}
              <span className="mx-1.5">·</span>
              since {format(parseLocalDate(boating.date.slice(0, 10)), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-2 hover:bg-neutral-700 rounded-lg transition-colors"
            title="Edit lineup"
          >
            <Edit2 className="w-4 h-4 text-neutral-500" />
          </button>
          {!archived && onDuplicate && (
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
              className="p-2 hover:bg-neutral-700 rounded-lg transition-colors"
              title="Duplicate lineup"
            >
              <Copy className="w-4 h-4 text-neutral-500" />
            </button>
          )}
          {!archived && onArchive && (
            <button
              onClick={(e) => { e.stopPropagation(); onArchive(); }}
              className="p-2 hover:bg-neutral-700 rounded-lg transition-colors"
              title="Archive lineup"
            >
              <Archive className="w-4 h-4 text-neutral-500" />
            </button>
          )}
          {archived && onReactivate && (
            <button
              onClick={(e) => { e.stopPropagation(); onReactivate(); }}
              className="p-2 hover:bg-neutral-700 rounded-lg transition-colors"
              title="Reactivate lineup"
            >
              <RotateCcw className="w-4 h-4 text-neutral-500" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-2 hover:bg-neutral-700 rounded-lg transition-colors"
            title="Delete lineup"
          >
            <Trash2 className="w-4 h-4 text-neutral-500" />
          </button>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-indigo-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-neutral-500" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-neutral-800 p-4 bg-neutral-800/30">
          <BoatDiagram
            boatType={boating.boat_type}
            positions={boating.positions}
            getAthleteName={getAthleteName}
            athletes={athletes}
            boatingId={boating.id}
            onPositionsChange={archived ? undefined : onPositionsChange}
            allBoatings={allBoatings}
            currentBoatingDate={boating.date}
          />
          {boating.notes && (
            <p className="mt-4 text-sm text-neutral-400 bg-neutral-800 p-3 rounded-xl">
              {boating.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Boat Diagram (inline editing + seat swap) ───────────────────────────── */

function BoatDiagram({
  boatType,
  positions,
  getAthleteName,
  athletes,
  boatingId,
  onPositionsChange,
  allBoatings,
  currentBoatingDate,
}: {
  boatType: CoachingBoating['boat_type'];
  positions: BoatPosition[];
  getAthleteName: (id: string) => string;
  athletes?: CoachingAthlete[];
  boatingId?: string;
  onPositionsChange?: (positions: BoatPosition[]) => void;
  allBoatings?: CoachingBoating[];
  currentBoatingDate?: string;
}) {
  const [editingSeat, setEditingSeat] = useState<number | null>(null);
  const [swapSeat, setSwapSeat] = useState<number | null>(null);

  const seatCount =
    boatType === '8+' ? 8 :
    ['4+', '4x', '4-'].includes(boatType) ? 4 :
    ['2x', '2-'].includes(boatType) ? 2 : 1;
  const hasCox = boatType.includes('+');
  const isSweep = !boatType.includes('x') && boatType !== '1x';

  const getSeatLabel = (seat: number) => {
    if (seat === 0) return 'Cox';
    if (seat === seatCount) return 'Stroke';
    if (seat === 1) return 'Bow';
    return seat.toString();
  };

  const getAthleteForSeat = (seat: number) => {
    const pos = positions.find((p) => p.seat === seat);
    return pos ? pos.athlete_id : '';
  };

  const getAthleteNameForSeat = (seat: number) => {
    const pos = positions.find((p) => p.seat === seat);
    if (!pos) return '—';
    // Prefer snapshot name (historical accuracy), fall back to live roster
    return pos.athlete_name || getAthleteName(pos.athlete_id);
  };

  /** Get athletes available for a seat (exclude those already in this boat or other boats on same date) */
  const getAvailableForSeat = (seat: number) => {
    if (!athletes) return [];
    const currentId = getAthleteForSeat(seat);
    const otherSeatIds = new Set(
      positions.filter((p) => p.seat !== seat).map((p) => p.athlete_id)
    );
    const takenByOtherBoats = new Set(
      (allBoatings ?? [])
        .filter((b) => b.date.slice(0, 10) === currentBoatingDate?.slice(0, 10) && b.id !== boatingId)
        .flatMap((b) => b.positions.map((p) => p.athlete_id))
    );
    return athletes.filter(
      (a) => a.id === currentId || (!otherSeatIds.has(a.id) && !takenByOtherBoats.has(a.id))
    );
  };

  /** Sort athletes by side preference for sweep boats */
  const sortBySide = (list: CoachingAthlete[], seat: number): CoachingAthlete[] => {
    if (!isSweep || seat === 0) return list; // cox or scull — no side preference
    // Convention: even seats = port, odd seats = starboard (common US convention)
    const preferredSide = seat % 2 === 0 ? 'port' : 'starboard';
    return [...list].sort((a, b) => {
      const aMatch = a.side === preferredSide || a.side === 'both' ? 0 : 1;
      const bMatch = b.side === preferredSide || b.side === 'both' ? 0 : 1;
      return aMatch - bMatch;
    });
  };

  const handleSeatClick = (seat: number) => {
    if (!onPositionsChange) return; // read-only mode

    // If we're in swap mode
    if (swapSeat !== null) {
      if (swapSeat === seat) {
        // Cancel swap
        setSwapSeat(null);
        return;
      }
      // Perform swap (preserve snapshot names)
      const posA = positions.find((p) => p.seat === swapSeat);
      const posB = positions.find((p) => p.seat === seat);
      const newPositions = positions
        .filter((p) => p.seat !== swapSeat && p.seat !== seat)
        .concat(
          ...(posA ? [{ seat, athlete_id: posA.athlete_id, athlete_name: posA.athlete_name }] : []),
          ...(posB ? [{ seat: swapSeat, athlete_id: posB.athlete_id, athlete_name: posB.athlete_name }] : []),
        );
      onPositionsChange(newPositions);
      setSwapSeat(null);
      return;
    }

    // Toggle inline edit dropdown
    setEditingSeat(editingSeat === seat ? null : seat);
  };

  const handleSeatChange = (seat: number, athleteId: string) => {
    if (!onPositionsChange) return;
    const athleteName = athletes?.find((a) => a.id === athleteId)?.name ?? '';
    const newPositions = athleteId
      ? [...positions.filter((p) => p.seat !== seat), { seat, athlete_id: athleteId, athlete_name: athleteName }]
      : positions.filter((p) => p.seat !== seat);
    onPositionsChange(newPositions);
    setEditingSeat(null);
  };

  const startSwapMode = (seat: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSeat(null);
    setSwapSeat(seat);
  };

  const renderSeatRow = (seat: number, colorClass: string, labelClass: string) => {
    const isEditing = editingSeat === seat;
    const isSwapSource = swapSeat === seat;
    const isSwapTarget = swapSeat !== null && swapSeat !== seat;
    const athleteId = getAthleteForSeat(seat);

    return (
      <div
        key={seat}
        className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${colorClass} ${
          onPositionsChange ? 'cursor-pointer hover:ring-1 hover:ring-indigo-500/50' : ''
        } ${isSwapSource ? 'ring-2 ring-amber-400' : ''} ${isSwapTarget ? 'ring-1 ring-amber-400/40' : ''}`}
        onClick={() => handleSeatClick(seat)}
      >
        <span className={`w-20 text-sm font-semibold ${labelClass}`}>
          {getSeatLabel(seat)}
        </span>

        {isEditing && athletes ? (
          <div className="flex-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <select
              autoFocus
              value={athleteId}
              onChange={(e) => handleSeatChange(seat, e.target.value)}
              onBlur={() => setEditingSeat(null)}
              aria-label={`Athlete for ${getSeatLabel(seat)}`}
              className="flex-1 px-3 py-1.5 bg-neutral-800 border border-indigo-500 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">— Empty —</option>
              {sortBySide(getAvailableForSeat(seat), seat).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}{isSweep && a.side ? ` (${a.side === 'both' ? 'B' : a.side[0].toUpperCase()})` : ''}
                </option>
              ))}
            </select>
            {athleteId && (
              <button
                onClick={(e) => startSwapMode(seat, e)}
                className="p-1 hover:bg-neutral-700 rounded transition-colors"
                title="Swap with another seat"
              >
                <ArrowRightLeft className="w-4 h-4 text-amber-400" />
              </button>
            )}
          </div>
        ) : (
          <span className={`text-sm font-medium ${isSwapSource ? 'text-amber-300' : 'text-neutral-300'}`}>
            {getAthleteNameForSeat(seat)}
            {isSwapSource && <span className="ml-2 text-xs text-amber-500">(pick swap target)</span>}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {swapSeat !== null && (
        <div className="flex items-center gap-2 p-2 bg-amber-900/20 border border-amber-800/30 rounded-lg text-sm text-amber-400">
          <ArrowRightLeft className="w-4 h-4" />
          Click another seat to swap, or click the highlighted seat to cancel
        </div>
      )}
      {hasCox && renderSeatRow(0, 'bg-amber-900/20 border border-amber-800/30', 'text-amber-400')}
      {Array.from({ length: seatCount }, (_, i) => seatCount - i).map((seat) =>
        renderSeatRow(
          seat,
          seat === seatCount
            ? 'bg-indigo-500/10 border border-indigo-500/20'
            : seat === 1
            ? 'bg-teal-900/20 border border-teal-800/30'
            : 'bg-neutral-800',
          seat === seatCount ? 'text-indigo-400' : seat === 1 ? 'text-teal-400' : 'text-neutral-400'
        )
      )}
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
  const isSweep = !boatType.includes('x') && boatType !== '1x';

  /** Sort athletes with preferred side first for sweep boats */
  const sortedAvailable = (seat: number) => {
    const available = getAvailableAthletes(seat);
    if (!isSweep || seat === 0) return available;
    const preferredSide = seat % 2 === 0 ? 'port' : 'starboard';
    return [...available].sort((a, b) => {
      const aMatch = a.side === preferredSide || a.side === 'both' ? 0 : 1;
      const bMatch = b.side === preferredSide || b.side === 'both' ? 0 : 1;
      return aMatch - bMatch;
    });
  };

  /** Side indicator for athlete name in dropdown */
  const sideTag = (a: CoachingAthlete, seat: number) => {
    if (!isSweep || !a.side || seat === 0) return '';
    if (a.side === 'coxswain') return ' ⚓';
    if (a.side === 'both') return ' (B)';
    return ` (${a.side[0].toUpperCase()})`;
  };

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
      const athleteName = athletes.find((a) => a.id === athleteId)?.name ?? '';
      const existing = positions.find((p) => p.seat === seat);
      if (existing) {
        setPositions(positions.map((p) => (p.seat === seat ? { ...p, athlete_id: athleteId, athlete_name: athleteName } : p)));
      } else {
        setPositions([...positions, { seat, athlete_id: athleteId, athlete_name: athleteName }]);
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-2xl my-8 max-h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">{boating ? 'Edit Lineup' : 'New Lineup'}</h2>
          <button onClick={onCancel} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors" title="Close">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <div>
              <label htmlFor="boating-date" className="block text-sm font-medium text-neutral-300 mb-2">Effective Date</label>
              <input id="boating-date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            </div>
          </div>

          {/* Seat assignments */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-300 mb-2">Seats</label>

            {hasCox && (
              <div className="flex items-center gap-3 p-2 bg-amber-900/20 rounded-xl">
                <label htmlFor="seat-cox" className="w-20 text-sm font-medium text-amber-400 shrink-0">Coxswain</label>
                <select id="seat-cox" value={getAthleteForSeat(0)} onChange={(e) => setPosition(0, e.target.value)}
                  className="flex-1 px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
                  <option value="">— Select —</option>
                  {sortedAvailable(0).map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.side === 'coxswain' ? ' ⚓' : ''}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Array.from({ length: seatCount }, (_, i) => seatCount - i).map((seat) => (
              <div key={seat} className={`flex items-center gap-3 p-2 rounded-xl ${
                seat === seatCount ? 'bg-indigo-500/5' : seat === 1 ? 'bg-teal-900/20' : ''
              }`}>
                <label htmlFor={`seat-${seat}`} className={`w-20 text-sm font-medium shrink-0 ${
                  seat === seatCount ? 'text-indigo-400' : seat === 1 ? 'text-teal-400' : 'text-neutral-400'
                }`}>{getSeatLabel(seat)}</label>
                <select id={`seat-${seat}`} value={getAthleteForSeat(seat)} onChange={(e) => setPosition(seat, e.target.value)}
                  className="flex-1 px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
                  <option value="">— Select —</option>
                  {sortedAvailable(seat).map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{sideTag(a, seat)}</option>
                  ))}
                </select>
              </div>
            ))}
            </div>
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
