import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  updateBoatingSortOrders,
  type CoachingBoating,
  type CoachingAthlete,
  type BoatPosition,
} from '../../services/coaching/coachingService';
import { format } from 'date-fns';
import { Plus, X, Copy, ChevronDown, ChevronUp, Edit2, Trash2, Loader2, Filter, ArrowRightLeft, ArrowUp, ArrowDown, Ship, Archive, RotateCcw, History, GripVertical, Search } from 'lucide-react';
import { EmptyState } from '../../components/ui';
import { CoachingNav } from '../../components/coaching/CoachingNav';
import { toast } from 'sonner';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type CollisionDetection,
  useDraggable,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';

export function CoachingBoatings() {
  const { userId, teamId, isLoadingTeam, orgId } = useCoachingContext();
  // Boatings page is always org-wide for maximum flexibility
  const hasOrg = !!orgId;
  const [athletes, setAthletes] = useState<CoachingAthlete[]>([]);
  const [boatings, setBoatings] = useState<CoachingBoating[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingBoating, setEditingBoating] = useState<CoachingBoating | null>(null);
  const [expandedBoating, setExpandedBoating] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSquad, setSelectedSquad] = useState<string | 'all'>('all');
  const [showHistory, setShowHistory] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');
  const [showUnboatedOnly, setShowUnboatedOnly] = useState(false);
  const [rosterTeamFilter, setRosterTeamFilter] = useState<string | 'all'>('all');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const preExpandRef = useRef<string | null>(null);
  const expandedBoatingRef = useRef<string | null>(null);
  expandedBoatingRef.current = expandedBoating;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (isLoadingTeam) return;
    if (!hasOrg && !teamId) return;

    const fetchAthletes = hasOrg
      ? () => getOrgAthletesWithTeam(orgId!)
      : () => getAthletes(teamId);
    const fetchBoatings = hasOrg
      ? () => getOrgBoatings(orgId!)
      : () => getBoatings(teamId);

    Promise.all([fetchAthletes(), fetchBoatings()])
      .then(([a, b]) => {
        setAthletes(a);
        setBoatings(b);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setIsLoading(false));
  }, [teamId, isLoadingTeam, hasOrg, orgId]);

  const refreshData = useCallback(async () => {
    if (!hasOrg && !teamId) return;
    try {
      const fetchAthletes = hasOrg
        ? () => getOrgAthletesWithTeam(orgId!)
        : () => getAthletes(teamId);
      const fetchBoatings = hasOrg
        ? () => getOrgBoatings(orgId!)
        : () => getBoatings(teamId);

      const [a, b] = await Promise.all([fetchAthletes(), fetchBoatings()]);
      setAthletes(a);
      setBoatings(b);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    }
  }, [teamId, hasOrg, orgId]);

  const handleSave = async (data: Pick<CoachingBoating, 'date' | 'boat_name' | 'boat_type' | 'positions' | 'notes'>) => {
    if (!teamId) return;
    try {
      await createBoating(teamId, userId, data);
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
    if (!teamId) return;
    try {
      await duplicateBoating(teamId, userId, boating);
      await refreshData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to duplicate boating');
    }
  };

  /** Inline update: save new positions for a boating (from diagram seat editing / swap) */
  const handleInlinePositionUpdate = useCallback(async (boatingId: string, newPositions: BoatPosition[]) => {
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
  }, [boatings, refreshData]);

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

  const moveBoating = useCallback((boatingId: string, direction: 'up' | 'down') => {
    setBoatings((prev) => {
      const activeIds = prev.filter((b) => b.is_active !== false).map((b) => b.id);
      const idx = activeIds.indexOf(boatingId);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= activeIds.length) return prev;
      const swapId = activeIds[swapIdx];
      const arr = [...prev];
      const posA = arr.findIndex((b) => b.id === boatingId);
      const posB = arr.findIndex((b) => b.id === swapId);
      [arr[posA], arr[posB]] = [arr[posB], arr[posA]];

      // Persist: assign sort_order based on new active order
      const newActive = arr.filter((b) => b.is_active !== false);
      const orders = newActive.map((b, i) => ({ id: b.id, sort_order: i }));
      updateBoatingSortOrders(orders).catch(() => toast.error('Failed to save order'));
      // Update sort_order in local state too
      return arr.map((b) => {
        const o = orders.find((o) => o.id === b.id);
        return o ? { ...b, sort_order: o.sort_order } : b;
      });
    });
  }, []);

  // Derived: squads and filtered athletes for form
  const squads = [...new Set(athletes.map((a) => a.squad).filter((s): s is string => !!s))].sort();
  const formAthletes = selectedSquad === 'all' ? athletes : athletes.filter((a) => a.squad === selectedSquad);

  // Split active vs archived
  const activeBoatings = useMemo(() => boatings.filter((b) => b.is_active !== false), [boatings]);
  const archivedBoatings = useMemo(() => boatings.filter((b) => b.is_active === false), [boatings]);

  // Map athlete ID → which active boat they're assigned to
  const athleteBoatMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of activeBoatings) {
      for (const p of b.positions) {
        map.set(p.athlete_id, b.boat_name);
      }
    }
    return map;
  }, [activeBoatings]);

  // Derive team list for roster filter
  const teams = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of athletes) {
      if (a.team_id && a.team_name) map.set(a.team_id, a.team_name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [athletes]);

  // Roster athletes filtered by team, search, and unboated toggle
  const rosterAthletes = useMemo(() => {
    let list = [...athletes];
    if (rosterTeamFilter !== 'all') {
      list = list.filter((a) => a.team_id === rosterTeamFilter);
    }
    if (showUnboatedOnly) {
      list = list.filter((a) => !athleteBoatMap.has(a.id));
    }
    if (rosterSearch.trim()) {
      const q = rosterSearch.trim().toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const aBoated = athleteBoatMap.has(a.id) ? 1 : 0;
      const bBoated = athleteBoatMap.has(b.id) ? 1 : 0;
      if (aBoated !== bBoated) return aBoated - bBoated;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [athletes, rosterTeamFilter, showUnboatedOnly, athleteBoatMap, rosterSearch]);

  // Custom collision: prioritize roster-panel when pointer intersects it, else closestCorners for seats
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const rosterHits = rectIntersection(args).filter((c) => c.id === 'roster-panel');
    if (rosterHits.length > 0) return rosterHits;
    return closestCorners(args);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const rawId = event.active.id as string;
    setActiveDragId(rawId.startsWith('seated-') ? rawId.slice(7) : rawId);
    preExpandRef.current = expandedBoatingRef.current;
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    // Restore previous expansion state
    setExpandedBoating(preExpandRef.current);

    if (!over) return;
    const overId = over.id as string;
    const rawActiveId = active.id as string;
    const athleteId = rawActiveId.startsWith('seated-') ? rawActiveId.slice(7) : rawActiveId;

    // Dropped back on roster panel — remove from any boat
    if (overId === 'roster-panel') {
      for (const b of activeBoatings) {
        const inBoat = b.positions.find((p) => p.athlete_id === athleteId);
        if (inBoat) {
          const cleaned = b.positions.filter((p) => p.athlete_id !== athleteId);
          handleInlinePositionUpdate(b.id, cleaned);
        }
      }
      return;
    }

    // Parse droppable seat id: `${boatingId}-seat-${seat}`
    const seatMatch = overId.match(/^(.+)-seat-(\d+)$/);
    if (!seatMatch) return;

    const boatingId = seatMatch[1];
    const seat = parseInt(seatMatch[2], 10);
    const athlete = athletes.find((a) => a.id === athleteId);
    if (!athlete) return;

    const targetBoating = activeBoatings.find((b) => b.id === boatingId);
    if (!targetBoating) return;

    // Build new positions: replace/add athlete at target seat
    const newPositions = [
      ...targetBoating.positions.filter((p) => p.seat !== seat && p.athlete_id !== athleteId),
      { seat, athlete_id: athleteId, athlete_name: athlete.name },
    ];
    handleInlinePositionUpdate(boatingId, newPositions);

    // Silently remove athlete from any OTHER active boat (no context switch)
    for (const b of activeBoatings) {
      if (b.id === boatingId) continue;
      const inOther = b.positions.find((p) => p.athlete_id === athleteId);
      if (inOther) {
        const cleaned = b.positions.filter((p) => p.athlete_id !== athleteId);
        handleInlinePositionUpdate(b.id, cleaned);
      }
    }
  }, [athletes, activeBoatings, handleInlinePositionUpdate]);

  // Show DnD roster panel only on desktop when there are active boats and not in form mode
  const showDndPanel = activeBoatings.length > 0 && !isAdding && !editingBoating && !isLoading && athletes.length > 0;

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
            {/* Squad filter: show inline on mobile, hidden on desktop when DnD panel is shown */}
            {squads.length > 0 && (
              <div className={`flex items-center gap-2 ${showDndPanel ? 'md:hidden' : ''}`}>
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
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
        <div className={`${showDndPanel ? 'md:flex md:gap-6' : ''}`}>
          {/* Desktop Roster Panel */}
          {showDndPanel && (
            <RosterPanel
              athletes={rosterAthletes}
              athleteBoatMap={athleteBoatMap}
              search={rosterSearch}
              onSearchChange={setRosterSearch}
              showUnboatedOnly={showUnboatedOnly}
              onToggleUnboated={() => setShowUnboatedOnly((v) => !v)}
              teams={teams}
              selectedTeam={rosterTeamFilter}
              onTeamChange={setRosterTeamFilter}
            />
          )}

          <div className={`space-y-6 ${showDndPanel ? 'md:flex-1 md:min-w-0' : ''}`}>
          {/* ── Current Lineups ── */}
          {activeBoatings.length > 0 ? (
            <div className="space-y-3">
              {activeBoatings.map((boating, idx) => (
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
                  isDragging={activeDragId !== null}
                  dndEnabled={showDndPanel}
                  onMoveUp={idx > 0 ? () => moveBoating(boating.id, 'up') : undefined}
                  onMoveDown={idx < activeBoatings.length - 1 ? () => moveBoating(boating.id, 'down') : undefined}
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
        </div>

        {/* DragOverlay */}
        <DragOverlay>
          {activeDragId ? (
            <DragOverlayCard athlete={athletes.find((a) => a.id === activeDragId)} />
          ) : null}
        </DragOverlay>
        </DndContext>
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
  isDragging,
  dndEnabled,
  onMoveUp,
  onMoveDown,
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
  isDragging?: boolean;
  dndEnabled?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <div className={`bg-neutral-900 border rounded-xl overflow-hidden ${archived ? 'border-neutral-800/60 opacity-75' : 'border-neutral-800'}`}>
      <div
        className="px-3 py-2 flex items-center gap-3 cursor-pointer hover:bg-neutral-800/50 transition-colors"
        onClick={onToggleExpand}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${archived ? 'bg-neutral-700' : 'bg-indigo-600'}`}>
          <span className="text-white font-bold text-xs">{boating.boat_type}</span>
        </div>
        <p className="font-medium text-white text-sm truncate flex-1">{boating.boat_name}</p>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {onMoveUp && (
            <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} className="p-1.5 hover:bg-neutral-700 rounded-md transition-colors" title="Move up">
              <ArrowUp className="w-3.5 h-3.5 text-neutral-500" />
            </button>
          )}
          {onMoveDown && (
            <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} className="p-1.5 hover:bg-neutral-700 rounded-md transition-colors" title="Move down">
              <ArrowDown className="w-3.5 h-3.5 text-neutral-500" />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1.5 hover:bg-neutral-700 rounded-md transition-colors" title="Edit">
            <Edit2 className="w-3.5 h-3.5 text-neutral-500" />
          </button>
          {!archived && onDuplicate && (
            <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="p-1.5 hover:bg-neutral-700 rounded-md transition-colors" title="Duplicate">
              <Copy className="w-3.5 h-3.5 text-neutral-500" />
            </button>
          )}
          {!archived && onArchive && (
            <button onClick={(e) => { e.stopPropagation(); onArchive(); }} className="p-1.5 hover:bg-neutral-700 rounded-md transition-colors" title="Archive">
              <Archive className="w-3.5 h-3.5 text-neutral-500" />
            </button>
          )}
          {archived && onReactivate && (
            <button onClick={(e) => { e.stopPropagation(); onReactivate(); }} className="p-1.5 hover:bg-neutral-700 rounded-md transition-colors" title="Reactivate">
              <RotateCcw className="w-3.5 h-3.5 text-neutral-500" />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 hover:bg-neutral-700 rounded-md transition-colors" title="Delete">
            <Trash2 className="w-3.5 h-3.5 text-neutral-500" />
          </button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-indigo-400 ml-1" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-500 ml-1" />
          )}
        </div>
      </div>

      {/* Compact seat strip — always visible as default view */}
      {!expanded && !archived && (
        <CompactSeatStrip boating={boating} getAthleteName={getAthleteName} dndEnabled={dndEnabled} />
      )}

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
            isDragging={isDragging}
            dndEnabled={dndEnabled}
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

/* ─── Compact Seat Strip (default collapsed view with initials) ───────────── */

function getInitials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 3);
}

function CompactSeatStrip({
  boating,
  getAthleteName,
  dndEnabled,
}: {
  boating: CoachingBoating;
  getAthleteName: (id: string) => string;
  dndEnabled?: boolean;
}) {
  const seatCount =
    boating.boat_type === '8+' ? 8 :
    ['4+', '4x', '4-'].includes(boating.boat_type) ? 4 :
    ['2x', '2-'].includes(boating.boat_type) ? 2 : 1;
  const hasCox = boating.boat_type.includes('+');

  const getSeatLabel = (seat: number) => {
    if (seat === 0) return 'Cox';
    return seat.toString();
  };

  // Order: Cox, Stroke, then descending to Bow
  const seats = [...(hasCox ? [0] : []), ...Array.from({ length: seatCount }, (_, i) => seatCount - i)];

  return (
    <div className="border-t border-neutral-800 px-4 py-2 bg-neutral-800/20 flex items-center gap-1.5 overflow-x-auto">
      {seats.map((seat) => {
        const pos = boating.positions.find((p) => p.seat === seat);
        const name = pos ? (pos.athlete_name || getAthleteName(pos.athlete_id)) : null;
        return (
          <CompactSeatBadge
            key={seat}
            boatingId={boating.id}
            seat={seat}
            label={getSeatLabel(seat)}
            athleteName={name}
            dndEnabled={dndEnabled}
          />
        );
      })}
    </div>
  );
}

function CompactSeatBadge({
  boatingId,
  seat,
  label,
  athleteName,
  dndEnabled,
}: {
  boatingId: string;
  seat: number;
  label: string;
  athleteName: string | null;
  dndEnabled?: boolean;
}) {
  const droppableId = `${boatingId}-seat-${seat}`;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId, disabled: !dndEnabled });

  return (
    <div
      ref={dndEnabled ? setNodeRef : undefined}
      className={`flex flex-col items-center px-2 py-1.5 rounded-lg border text-[10px] min-w-[48px] transition-colors ${
        isOver
          ? 'border-indigo-400 bg-indigo-500/20 ring-1 ring-indigo-400'
          : athleteName
            ? 'border-neutral-700 bg-neutral-800'
            : 'border-dashed border-neutral-700 bg-neutral-800/50'
      }`}
      title={athleteName ? `${label}: ${athleteName}` : `${label}: empty`}
    >
      <span className="font-semibold text-neutral-400">{label}</span>
      <span className={`truncate max-w-[56px] ${athleteName ? 'text-neutral-300' : 'text-neutral-600'}`}>
        {athleteName ? getInitials(athleteName) : '—'}
      </span>
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
  isDragging,
  dndEnabled,
}: {
  boatType: CoachingBoating['boat_type'];
  positions: BoatPosition[];
  getAthleteName: (id: string) => string;
  athletes?: CoachingAthlete[];
  boatingId?: string;
  onPositionsChange?: (positions: BoatPosition[]) => void;
  allBoatings?: CoachingBoating[];
  currentBoatingDate?: string;
  isDragging?: boolean;
  dndEnabled?: boolean;
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
    const droppableId = boatingId ? `${boatingId}-seat-${seat}` : undefined;

    return (
      <DroppableSeatRow
        key={seat}
        droppableId={droppableId}
        boatingId={boatingId}
        seat={seat}
        isDragging={isDragging}
        onPositionsChange={onPositionsChange}
      >
        <div
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
            <DraggableSeatedAthlete
              athleteId={athleteId}
              name={getAthleteNameForSeat(seat)}
              isSwapSource={isSwapSource}
              isDndActive={dndEnabled && !!athleteId}
            />
          )}
        </div>
      </DroppableSeatRow>
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

/* ─── Droppable Seat Row Wrapper ────────────────────────────────────────────── */

function DraggableSeatedAthlete({
  athleteId,
  name,
  isSwapSource,
  isDndActive,
}: {
  athleteId: string;
  name: string;
  isSwapSource: boolean;
  isDndActive?: boolean;
}) {
  // Prefix to avoid ID collision with roster DraggableAthleteCard
  const draggableId = `seated-${athleteId}`;
  const { attributes, listeners, setNodeRef, isDragging: selfDragging } = useDraggable({
    id: draggableId,
    data: { type: 'SeatedAthlete', athleteId },
    disabled: !isDndActive,
  });

  if (!isDndActive) {
    return (
      <span className={`text-sm font-medium flex-1 ${isSwapSource ? 'text-amber-300' : 'text-neutral-300'}`}>
        {name}
        {isSwapSource && <span className="ml-2 text-xs text-amber-500">(pick swap target)</span>}
      </span>
    );
  }

  return (
    <span
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`text-sm font-medium flex-1 cursor-grab active:cursor-grabbing ${
        isSwapSource ? 'text-amber-300' : 'text-neutral-300'
      } ${selfDragging ? 'opacity-30' : ''}`}
    >
      <GripVertical size={12} className="inline mr-1 text-neutral-600" />
      {name}
      {isSwapSource && <span className="ml-2 text-xs text-amber-500">(pick swap target)</span>}
    </span>
  );
}

function DroppableSeatRow({
  droppableId,
  boatingId,
  seat,
  isDragging,
  onPositionsChange,
  children,
}: {
  droppableId?: string;
  boatingId?: string;
  seat: number;
  isDragging?: boolean;
  onPositionsChange?: (positions: BoatPosition[]) => void;
  children: React.ReactNode;
}) {
  const isDropEnabled = !!droppableId && !!isDragging && !!onPositionsChange;
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId ?? `noop-${seat}`,
    data: { type: 'Seat', boatingId, seat },
    disabled: !isDropEnabled,
  });

  return (
    <div
      ref={isDropEnabled ? setNodeRef : undefined}
      className={isOver ? 'ring-2 ring-indigo-400 bg-indigo-500/10 rounded-xl' : ''}
    >
      {children}
    </div>
  );
}

/* ─── Roster Panel (desktop DnD) ───────────────────────────────────────────── */

function SideBadge({ side }: { side?: string | null }) {
  if (!side) return null;
  const config: Record<string, { label: string; cls: string }> = {
    port: { label: 'P', cls: 'bg-blue-500/20 text-blue-400' },
    starboard: { label: 'S', cls: 'bg-green-500/20 text-green-400' },
    both: { label: 'B', cls: 'bg-neutral-700 text-neutral-300' },
    coxswain: { label: 'Cox', cls: 'bg-amber-500/20 text-amber-400' },
  };
  const c = config[side];
  if (!c) return null;
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${c.cls}`}>{c.label}</span>;
}

function DraggableAthleteCard({
  athlete,
  boatName,
}: {
  athlete: CoachingAthlete;
  boatName?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({ id: athlete.id, data: { type: 'Athlete', athlete } });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 ${
        boatName ? 'opacity-50' : ''
      } ${isDragging ? 'opacity-30' : ''}`}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to assign"
        className="text-neutral-600 hover:text-white cursor-grab active:cursor-grabbing flex-shrink-0"
      >
        <GripVertical size={14} />
      </button>
      <span className="text-sm text-white truncate flex-1">{athlete.name}</span>
      <SideBadge side={athlete.side} />
      {boatName && (
        <span className="text-[10px] text-neutral-500 truncate max-w-[80px]">{boatName}</span>
      )}
    </div>
  );
}

function RosterPanel({
  athletes,
  athleteBoatMap,
  search,
  onSearchChange,
  showUnboatedOnly,
  onToggleUnboated,
  teams,
  selectedTeam,
  onTeamChange,
}: {
  athletes: CoachingAthlete[];
  athleteBoatMap: Map<string, string>;
  search: string;
  onSearchChange: (s: string) => void;
  showUnboatedOnly: boolean;
  onToggleUnboated: () => void;
  teams: [string, string][];
  selectedTeam: string | 'all';
  onTeamChange: (team: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'roster-panel' });

  const unboatedCount = athletes.filter((a) => !athleteBoatMap.has(a.id)).length;

  return (
    <div
      ref={setNodeRef}
      className={`hidden md:flex flex-col w-72 flex-shrink-0 bg-neutral-900/50 border rounded-xl p-4 gap-3 max-h-[calc(100vh-200px)] sticky top-4 transition-colors ${
        isOver ? 'border-indigo-400 bg-indigo-500/5' : 'border-neutral-800'
      }`}
    >
      <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">Boathouse</h3>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search athletes…"
          className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Team filter */}
      {teams.length > 1 && (
        <select
          value={selectedTeam}
          onChange={(e) => onTeamChange(e.target.value)}
          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          aria-label="Filter by team"
        >
          <option value="all">All Teams</option>
          {teams.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
      )}

      {/* Unboated filter */}
      <button
        onClick={onToggleUnboated}
        className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
          showUnboatedOnly
            ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300'
            : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-neutral-300'
        }`}
      >
        <span>{showUnboatedOnly ? 'Showing unboated' : 'Show unboated only'}</span>
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
          showUnboatedOnly ? 'bg-indigo-500/30 text-indigo-300' : 'bg-neutral-700 text-neutral-400'
        }`}>
          {unboatedCount}
        </span>
      </button>

      {/* Athlete list */}
      <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
          {athletes.map((athlete) => (
            <DraggableAthleteCard
              key={athlete.id}
              athlete={athlete}
              boatName={athleteBoatMap.get(athlete.id)}
            />
          ))}
        {athletes.length === 0 && (
          <p className="text-xs text-neutral-600 text-center py-4">No athletes match filter</p>
        )}
      </div>

      <p className="text-[10px] text-neutral-600 text-center">Drag to seats · Drop here to unseat</p>
    </div>
  );
}

function DragOverlayCard({ athlete }: { athlete?: CoachingAthlete }) {
  if (!athlete) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800 border border-indigo-500 shadow-xl shadow-black/40 w-56">
      <GripVertical size={14} className="text-neutral-500" />
      <span className="text-sm text-white truncate flex-1">{athlete.name}</span>
      <SideBadge side={athlete.side} />
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
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-2xl my-8 sm:max-h-[calc(100vh-4rem)] max-h-[calc(100vh-2rem)] overflow-y-auto">
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
