import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from 'react';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { parseLocalDate } from '../../utils/dateUtils';
import {
  getBoats,
  getBoatings,
  getAthletes,
  getOrgBoats,
  getOrgBoatings,
  getOrgAthletesWithTeam,
  getTeamErgComparison,
  getOrgErgComparison,
  createBoating,
  createBoat,
  updateBoating,
  deleteBoating,
  duplicateBoating,
  setBoatingActive,
  getCoachNotesForAthlete,
  getNotesForSession,
  getScheduleEvents,
  getBoatingRaceResults,
  createBoatingRaceResult,
  updateBoatingRaceResult,
  deleteBoatingRaceResult,
  type CoachingBoating,
  type CoachingBoatingRaceResult,
  type CoachingBoat,
  type CoachingAthlete,
  type CoachingAthleteCoachNote,
  type CoachingAthleteNote,
  type BoatPosition,
  type TeamErgComparison,
  type CoachingScheduleEvent,
  type ScheduleEventType,
} from '../../services/coaching/coachingService';
import { format, addDays, subDays } from 'date-fns';
import { Plus, X, Copy, ChevronDown, ChevronUp, Edit2, Trash2, Loader2, Filter, ArrowRightLeft, Ship, Archive, RotateCcw, History, GripVertical, Search, MessageSquare, Gauge, CalendarDays, Info, Trophy, Pencil, Save, Undo2 } from 'lucide-react';
import { Button, Card, EmptyState } from '../../components/ui';
import { CoachingNav } from '../../components/coaching/CoachingNav';
import { toast } from 'sonner';
import { Link, Navigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  pointerWithin,
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
import {
  buildLineupPredictions,
  type LineupScorePrediction,
  type SyncMatch,
  getSPILabel,
} from '../../services/coaching/lineupPredictor';
import { parsePaceToSeconds } from '../../utils/paceCalculator';
import { formatTime } from '../../utils/prCalculator';

type PendingBoatingAction = {
  kind: 'delete' | 'archive';
  boating: CoachingBoating;
} | null;

type BoatingFormData = Pick<CoachingBoating, 'date' | 'boat_name' | 'boat_type' | 'positions'> & {
  notes?: string;
  boat_id?: string | null;
};

type SeatNoteSummary = {
  totalCount: number;
  sessionNotes: CoachingAthleteNote[];
  coachNotes: CoachingAthleteCoachNote[];
};

type BoatingRaceResultFormData = {
  schedule_event_id?: string | null;
  race_date: string;
  event_name: string;
  distance_meters: number;
  time_seconds: number;
  notes?: string;
};

export type LineupsFocusContext = {
  rangeStart: string;
  rangeEnd: string;
  rangeLabel: string;
  rangeContextLabel: string;
  rangeKey: string;
};

const RACE_EVENT_TYPES: ScheduleEventType[] = ['regatta', 'scrimmage', 'head_race'];

function normalizeLineupPositions(positions: BoatPosition[]): BoatPosition[] {
  return [...positions]
    .map((position) => ({
      seat: position.seat,
      athlete_id: position.athlete_id,
      athlete_name: position.athlete_name,
    }))
    .sort((left, right) => left.seat - right.seat);
}

function buildLineupSignature(positions: BoatPosition[]): string {
  return normalizeLineupPositions(positions)
    .map((position) => `${position.seat}:${position.athlete_id}`)
    .join('|');
}

export function LineupsWorkspace({
  embedded = false,
  embeddedContext,
}: {
  embedded?: boolean;
  embeddedContext?: LineupsFocusContext;
}) {
  const { userId, teamId, filterTeamId, orgId, isLoadingTeam } = useCoachingContext();
  const effectiveTeamId = filterTeamId ?? teamId;
  const hasOrg = !!orgId;
  const [athletes, setAthletes] = useState<CoachingAthlete[]>([]);
  const [boats, setBoats] = useState<CoachingBoat[]>([]);
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
  const [pendingAction, setPendingAction] = useState<PendingBoatingAction>(null);
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);
  const [ergComparisons, setErgComparisons] = useState<TeamErgComparison[]>([]);
  const [dateScope, setDateScope] = useState<'focus' | 'all'>('all');
  const [draftEditId, setDraftEditId] = useState<string | null>(null);
  const [draftPositions, setDraftPositions] = useState<BoatPosition[]>([]);
  const preExpandRef = useRef<string | null>(null);
  const expandedBoatingRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    expandedBoatingRef.current = expandedBoating;
  }, [expandedBoating]);

  useEffect(() => {
    if (isLoadingTeam) return;
    if (!hasOrg && !effectiveTeamId) return;

    const fetchAthletes = hasOrg
      ? () => getOrgAthletesWithTeam(orgId!)
      : () => getAthletes(effectiveTeamId);
    const fetchBoats = hasOrg
      ? () => getOrgBoats(orgId!)
      : () => getBoats(effectiveTeamId);
    const fetchBoatings = hasOrg
      ? () => getOrgBoatings(orgId!)
      : () => getBoatings(effectiveTeamId);
    const fetchErgComparisons = hasOrg
      ? () => getOrgErgComparison(orgId!)
      : () => getTeamErgComparison(effectiveTeamId);

    Promise.all([fetchAthletes(), fetchBoats(), fetchBoatings(), fetchErgComparisons()])
      .then(([a, allBoats, b, ergData]) => {
        setAthletes(a);
        setBoats(allBoats);
        setBoatings(b);
        setErgComparisons(ergData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setIsLoading(false));
  }, [effectiveTeamId, hasOrg, isLoadingTeam, orgId]);

  const refreshData = useCallback(async () => {
    if (!hasOrg && !effectiveTeamId) return;
    try {
      const fetchAthletes = hasOrg
        ? () => getOrgAthletesWithTeam(orgId!)
        : () => getAthletes(effectiveTeamId);
      const fetchBoats = hasOrg
        ? () => getOrgBoats(orgId!)
        : () => getBoats(effectiveTeamId);
      const fetchBoatings = hasOrg
        ? () => getOrgBoatings(orgId!)
        : () => getBoatings(effectiveTeamId);
      const fetchErgComparisons = hasOrg
        ? () => getOrgErgComparison(orgId!)
        : () => getTeamErgComparison(effectiveTeamId);

      const [a, allBoats, b, ergData] = await Promise.all([fetchAthletes(), fetchBoats(), fetchBoatings(), fetchErgComparisons()]);
      setAthletes(a);
      setBoats(allBoats);
      setBoatings(b);
      setErgComparisons(ergData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    }
  }, [effectiveTeamId, hasOrg, orgId]);

  const resolveBoatId = useCallback(async (
    targetTeamId: string,
    data: BoatingFormData,
    existingBoatId?: string | null,
  ): Promise<string | null> => {
    if (data.boat_id) return data.boat_id;
    if (existingBoatId) return existingBoatId;

    const normalizedName = data.boat_name.trim().toLowerCase();
    const existing = boats.find((boat) =>
      boat.team_id === targetTeamId &&
      boat.boat_type === data.boat_type &&
      boat.boat_name.trim().toLowerCase() === normalizedName
    );
    if (existing) return existing.id;

    const created = await createBoat(targetTeamId, userId, {
      boat_name: data.boat_name.trim(),
      boat_type: data.boat_type,
      sort_order: boats.filter((boat) => boat.team_id === targetTeamId).length,
    });
    return created.id;
  }, [boats, userId]);

  const handleSave = async (data: BoatingFormData) => {
    const targetTeamId = effectiveTeamId;
    if (!targetTeamId) return;
    try {
      const boatId = await resolveBoatId(targetTeamId, data);
      await createBoating(targetTeamId, userId, { ...data, boat_id: boatId });
      setIsAdding(false);
      toast.success('Crew record saved.');
      await refreshData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save crew record');
    }
  };

  const handleEdit = async (data: BoatingFormData) => {
    if (!editingBoating) return;
    try {
      const targetTeamId = editingBoating.team_id ?? teamId;
      if (!targetTeamId) return;
      const boatId = await resolveBoatId(targetTeamId, data, editingBoating.boat_id);
      await updateBoating(editingBoating.id, { ...data, boat_id: boatId });
      setEditingBoating(null);
      await refreshData();
      toast.success('Crew record updated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update crew record');
    }
  };

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteBoating(id);
      await refreshData();
      toast.success('Crew record deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete crew record');
      throw err;
    }
  }, [refreshData]);

  const handleDuplicate = async (boating: CoachingBoating) => {
    if (!effectiveTeamId) return;
    try {
      await duplicateBoating(effectiveTeamId, userId, boating);
      await refreshData();
      toast.success(`Copied ${boating.boat_name} into a new crew record.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to duplicate crew record');
    }
  };

  /** Inline update: save new positions for a boating (from diagram seat editing / swap) */
  const handleInlinePositionUpdate = useCallback(async (boatingId: string, newPositions: BoatPosition[]) => {
    // If this boating is in draft edit mode, update draft instead of writing to DB
    if (boatingId === draftEditId) {
      setDraftPositions(newPositions);
      return;
    }
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
  }, [boatings, refreshData, draftEditId]);

  const handleToggleActive = useCallback(async (boatingId: string, isActive: boolean) => {
    // Optimistic update
    setBoatings((prev) =>
      prev.map((b) => (b.id === boatingId ? { ...b, is_active: isActive } : b))
    );
    try {
      await setBoatingActive(boatingId, isActive);
      toast.success(isActive ? 'Crew record restored.' : 'Crew record moved to history.');
    } catch {
      await refreshData();
      toast.error(`Failed to ${isActive ? 'restore' : 'move'} crew record`);
      throw new Error(`Failed to ${isActive ? 'restore' : 'move'} crew record`);
    }
  }, [refreshData]);

  /* ─── Draft edit mode: sandbox lineup changes without writing to DB ─────── */
  const handleEnterEditMode = useCallback((boatingId: string) => {
    const boating = boatings.find((b) => b.id === boatingId);
    if (!boating) return;
    setDraftEditId(boatingId);
    setDraftPositions([...boating.positions]);
    // Auto-expand the card being edited
    setExpandedBoating(boatingId);
  }, [boatings]);

  const handleSaveDraft = useCallback(async () => {
    if (!draftEditId) return;
    await handleInlinePositionUpdate(draftEditId, draftPositions);
    setDraftEditId(null);
    setDraftPositions([]);
    toast.success('Lineup saved.');
  }, [draftEditId, draftPositions, handleInlinePositionUpdate]);

  const handleDiscardDraft = useCallback(() => {
    setDraftEditId(null);
    setDraftPositions([]);
  }, []);

  const handleConfirmPendingAction = useCallback(async () => {
    if (!pendingAction) return;
    setIsConfirmingAction(true);
    try {
      if (pendingAction.kind === 'delete') {
        await handleDelete(pendingAction.boating.id);
      } else {
        await handleToggleActive(pendingAction.boating.id, false);
      }
      setPendingAction(null);
    } catch {
      // keep dialog open so the user can retry or cancel
    } finally {
      setIsConfirmingAction(false);
    }
  }, [handleDelete, handleToggleActive, pendingAction]);

  const getAthleteName = useCallback((athleteId: string) =>
    athletes.find((a) => a.id === athleteId)?.name ?? ''
  , [athletes]);

  // Derived: squads and filtered athletes for form
  const squads = [...new Set(athletes.map((a) => a.squad).filter((s): s is string => !!s))].sort();
  const formAthletes = selectedSquad === 'all' ? athletes : athletes.filter((a) => a.squad === selectedSquad);

  // Split active vs archived
  const activeBoatings = useMemo(() => boatings.filter((b) => b.is_active !== false), [boatings]);
  const archivedBoatings = useMemo(() => boatings.filter((b) => b.is_active === false), [boatings]);
  const isBoatingInFocusRange = useCallback((boating: CoachingBoating) => {
    if (!embeddedContext) return true;
    return boating.date >= embeddedContext.rangeStart && boating.date <= embeddedContext.rangeEnd;
  }, [embeddedContext]);
  const lineupPredictions = useMemo(
    () => {
      // When a boating is in edit mode, compute predictions with draft positions
      const effectiveBoatings = draftEditId
        ? boatings.map((b) => b.id === draftEditId ? { ...b, positions: draftPositions } : b)
        : boatings;
      return buildLineupPredictions({
        boatings: effectiveBoatings,
        athletes,
        ergComparisons,
      });
    },
    [athletes, boatings, ergComparisons, draftEditId, draftPositions]
  );
  const focusedActiveBoatings = useMemo(
    () => activeBoatings.filter(isBoatingInFocusRange),
    [activeBoatings, isBoatingInFocusRange]
  );
  const focusedArchivedBoatings = useMemo(
    () => archivedBoatings.filter(isBoatingInFocusRange),
    [archivedBoatings, isBoatingInFocusRange]
  );
  const showingFocusedRange = embedded && !!embeddedContext && dateScope === 'focus';
  const visibleActiveBoatings = useMemo(() => {
    const candidates = showingFocusedRange ? focusedActiveBoatings : activeBoatings;

    return [...candidates].sort((left, right) => {
      const leftPrediction = lineupPredictions.get(left.id);
      const rightPrediction = lineupPredictions.get(right.id);

      const leftAdjusted = leftPrediction?.lineupScoreSeconds ?? Number.POSITIVE_INFINITY;
      const rightAdjusted = rightPrediction?.lineupScoreSeconds ?? Number.POSITIVE_INFINITY;
      if (leftAdjusted !== rightAdjusted) return leftAdjusted - rightAdjusted;

      const leftRaw = leftPrediction?.averageRaw2kSeconds ?? Number.POSITIVE_INFINITY;
      const rightRaw = rightPrediction?.averageRaw2kSeconds ?? Number.POSITIVE_INFINITY;
      if (leftRaw !== rightRaw) return leftRaw - rightRaw;

      if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
      return left.boat_name.localeCompare(right.boat_name);
    });
  }, [activeBoatings, focusedActiveBoatings, lineupPredictions, showingFocusedRange]);
  const visibleArchivedBoatings = showingFocusedRange ? focusedArchivedBoatings : archivedBoatings;

  useEffect(() => {
    if (!embedded || !embeddedContext) {
      setDateScope('all');
      return;
    }

    setDateScope(focusedActiveBoatings.length > 0 ? 'focus' : 'all');
  }, [embedded, embeddedContext, focusedActiveBoatings.length, embeddedContext?.rangeKey]);

  // Map athlete ID → which active boat they're assigned to
  const athleteBoatMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of visibleActiveBoatings) {
      for (const p of b.positions) {
        map.set(p.athlete_id, b.boat_name);
      }
    }
    return map;
  }, [visibleActiveBoatings]);

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

  // Prioritize the explicit zone under the pointer before falling back to proximity.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const rosterContainers = args.droppableContainers.filter((container) => container.id === 'roster-panel');
    const seatContainers = args.droppableContainers.filter((container) =>
      typeof container.id === 'string' && /-seat-\d+$/.test(container.id)
    );
    const expandedSeatContainers = seatContainers.filter(
      (container) => container.data.current?.layout === 'expanded'
    );
    const compactSeatContainers = seatContainers.filter(
      (container) => container.data.current?.layout === 'compact'
    );

    const rosterHits = rectIntersection({
      ...args,
      droppableContainers: rosterContainers,
    }).filter((collision) => collision.id === 'roster-panel');
    if (rosterHits.length > 0) return rosterHits;

    const expandedPointerHits = pointerWithin({
      ...args,
      droppableContainers: expandedSeatContainers,
    });
    if (expandedPointerHits.length > 0) return expandedPointerHits;

    const compactPointerHits = pointerWithin({
      ...args,
      droppableContainers: compactSeatContainers,
    });
    if (compactPointerHits.length > 0) return compactPointerHits;

    const anyPointerHits = pointerWithin({
      ...args,
      droppableContainers: seatContainers,
    });
    if (anyPointerHits.length > 0) return anyPointerHits;

    const expandedRectHits = rectIntersection({
      ...args,
      droppableContainers: expandedSeatContainers,
    });
    if (expandedRectHits.length > 0) return expandedRectHits;

    const seatRectHits = rectIntersection({
      ...args,
      droppableContainers: seatContainers,
    });
    if (seatRectHits.length > 0) return seatRectHits;

    return closestCorners({
      ...args,
      droppableContainers: seatContainers,
    });
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
    const activeData = active.data.current as {
      type?: 'Athlete' | 'SeatedAthlete';
      athleteId?: string;
      boatingId?: string;
      seat?: number;
    } | undefined;
    const sourceBoatingId = activeData?.type === 'SeatedAthlete' ? activeData.boatingId : undefined;
    const sourceSeat = activeData?.type === 'SeatedAthlete' ? activeData.seat : undefined;

    // Dropped back on roster panel — remove from any boat
    if (overId === 'roster-panel') {
      if (sourceBoatingId) {
        const sourceBoating = activeBoatings.find((b) => b.id === sourceBoatingId);
        if (sourceBoating) {
          const cleaned = sourceBoating.positions.filter((p) => p.athlete_id !== athleteId);
          handleInlinePositionUpdate(sourceBoating.id, cleaned);
        }
        return;
      }

      for (const boating of activeBoatings) {
        const inBoat = boating.positions.find((p) => p.athlete_id === athleteId);
        if (inBoat) {
          const cleaned = boating.positions.filter((p) => p.athlete_id !== athleteId);
          handleInlinePositionUpdate(boating.id, cleaned);
          break;
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
    const targetOccupant = targetBoating.positions.find((p) => p.seat === seat);
    const sourceBoating = sourceBoatingId
      ? activeBoatings.find((b) => b.id === sourceBoatingId)
      : activeBoatings.find((b) => b.positions.some((p) => p.athlete_id === athleteId));

    if (sourceBoating?.id === boatingId && sourceSeat === seat) return;

    const athleteName = athlete.name;

    if (
      sourceBoating &&
      typeof sourceSeat === 'number' &&
      targetOccupant &&
      targetOccupant.athlete_id !== athleteId
    ) {
      const nextTargetPositions = [
        ...targetBoating.positions.filter((p) => p.seat !== seat && p.athlete_id !== athleteId),
        { seat, athlete_id: athleteId, athlete_name: athleteName },
      ];

      if (sourceBoating.id === targetBoating.id) {
        const swappedPositions = [
          ...nextTargetPositions.filter((p) => p.seat !== sourceSeat && p.athlete_id !== targetOccupant.athlete_id),
          {
            seat: sourceSeat,
            athlete_id: targetOccupant.athlete_id,
            athlete_name: targetOccupant.athlete_name || getAthleteName(targetOccupant.athlete_id),
          },
        ];
        handleInlinePositionUpdate(targetBoating.id, swappedPositions);
        return;
      }

      const nextSourcePositions = [
        ...sourceBoating.positions.filter((p) => p.seat !== sourceSeat && p.athlete_id !== athleteId),
        {
          seat: sourceSeat,
          athlete_id: targetOccupant.athlete_id,
          athlete_name: targetOccupant.athlete_name || getAthleteName(targetOccupant.athlete_id),
        },
      ];

      handleInlinePositionUpdate(targetBoating.id, nextTargetPositions);
      handleInlinePositionUpdate(sourceBoating.id, nextSourcePositions);
      return;
    }

    // Build new positions: place the dragged athlete in the target seat.
    const newPositions = [
      ...targetBoating.positions.filter((p) => p.seat !== seat && p.athlete_id !== athleteId),
      { seat, athlete_id: athleteId, athlete_name: athleteName },
    ];
    handleInlinePositionUpdate(boatingId, newPositions);

    if (sourceBoating && sourceBoating.id !== boatingId) {
      const cleaned = sourceBoating.positions.filter((p) => p.athlete_id !== athleteId);
      handleInlinePositionUpdate(sourceBoating.id, cleaned);
      return;
    }

    for (const boating of activeBoatings) {
      if (boating.id === boatingId) continue;
      const inOther = boating.positions.find((p) => p.athlete_id === athleteId);
      if (inOther) {
        const cleaned = boating.positions.filter((p) => p.athlete_id !== athleteId);
        handleInlinePositionUpdate(boating.id, cleaned);
        break;
      }
    }
  }, [athletes, activeBoatings, getAthleteName, handleInlinePositionUpdate]);

  // Show DnD roster panel only on desktop when there are active boats and not in form mode
  const showDndPanel = activeBoatings.length > 0 && !isAdding && !editingBoating && !isLoading && athletes.length > 0;

  // Group archived by date for history view
  const archivedByDate = useMemo(() => visibleArchivedBoatings.reduce((acc, boating) => {
    const dateKey = boating.date.slice(0, 10);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(boating);
    return acc;
  }, {} as Record<string, CoachingBoating[]>), [visibleArchivedBoatings]);
  return (
    <>
    {!embedded && <CoachingNav />}
    <div className={embedded ? 'space-y-6' : 'px-4 sm:px-6 py-6 max-w-6xl mx-auto space-y-6'}>
      <Card padding={embedded ? 'md' : 'lg'}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className={`${embedded ? 'text-lg' : 'text-2xl'} font-bold text-content-primary`}>
              {embedded ? 'Standing lineups' : 'Lineups'}
            </h1>
            <p className="mt-1 text-content-secondary">
              {embedded
                ? 'Edit reusable crew records here, then switch back to Schedule when you need the day or week plan.'
                : 'Use this page for reusable org-wide lineups, crew records, and shell history across the program.'}
            </p>
            <p className="mt-1 text-sm text-content-muted">
              {activeBoatings.length} saved crew record{activeBoatings.length !== 1 ? 's' : ''}
              {archivedBoatings.length > 0 && (
                <span className="text-content-faint"> · {archivedBoatings.length} in history</span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {squads.length > 0 && (
              <div className={`flex items-center gap-2 ${showDndPanel ? 'md:hidden' : ''}`}>
                <Filter className="w-4 h-4 text-content-muted" />
                <select
                  value={selectedSquad}
                  onChange={(e) => setSelectedSquad(e.target.value)}
                  className="rounded-xl border border-border bg-surface-card px-4 py-2.5 text-content-primary outline-none transition-colors focus:ring-2 focus:ring-focus"
                  aria-label="Filter athletes by squad"
                >
                  <option value="all">All Squads</option>
                  {squads.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}

            <Button
              type="button"
              variant="coaching"
              size="lg"
              onClick={() => setIsAdding(true)}
              disabled={athletes.length === 0}
              title={athletes.length === 0 ? 'Add athletes to the roster first' : 'Save a new crew record'}
            >
              <Plus className="w-4 h-4" />
              New Crew Record
            </Button>

            {!embedded && (
              <Link to="/team-management/schedule">
                <Button type="button" variant="secondary" size="lg">
                  Open Schedule
                </Button>
              </Link>
            )}
          </div>
        </div>
      </Card>

      {embedded && embeddedContext && (
        <Card padding="md">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-content-muted">
                {embeddedContext.rangeContextLabel}
              </p>
              <p className="text-sm font-semibold text-content-primary">
                {embeddedContext.rangeLabel}
              </p>
              <p className="text-sm text-content-secondary">
                {focusedActiveBoatings.length > 0
                  ? `${focusedActiveBoatings.length} saved crew record${focusedActiveBoatings.length === 1 ? '' : 's'} from this range ready to reuse in the current schedule view.`
                  : `No saved crew records fall inside this ${embeddedContext.rangeContextLabel.toLowerCase()}. You can still browse the full lineup archive.`}
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Lineup date scope"
              className="inline-flex w-full items-center gap-1 rounded-2xl border border-border bg-surface-well p-1 lg:w-auto"
            >
              <Button
                type="button"
                variant={showingFocusedRange ? 'coaching' : 'ghost'}
                size="md"
                onClick={() => setDateScope('focus')}
                className="flex-1 rounded-xl lg:flex-initial"
                aria-pressed={showingFocusedRange}
              >
                In Focus
              </Button>
              <Button
                type="button"
                variant={!showingFocusedRange ? 'secondary' : 'ghost'}
                size="md"
                onClick={() => setDateScope('all')}
                className="flex-1 rounded-xl lg:flex-initial"
                aria-pressed={!showingFocusedRange}
              >
                All Saved
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
          <button onClick={() => { setError(null); refreshData(); }} className="ml-3 underline hover:text-red-300">Retry</button>
        </div>
      )}

      {showDndPanel && (
        <div className="hidden md:flex items-start gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 text-sm">
          <ArrowRightLeft className="w-4 h-4 mt-0.5 text-indigo-400 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium text-white">Drag-and-drop tips</p>
            <p className="text-neutral-300">
              Drag athletes from the roster pool onto a seat. Drop a seated athlete onto an occupied seat to swap.
              Drop them back into the roster pool to unseat. Expanded crew records now use the most precise seat targets.
            </p>
          </div>
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
          description="Add athletes to the roster before saving lineups or history records."
          action={
            <a href="/team-management/roster" className="text-indigo-400 hover:underline font-medium">Go to Roster</a>
          }
        />
      ) : activeBoatings.length === 0 && archivedBoatings.length === 0 ? (
        <EmptyState
          icon={<Ship className="w-8 h-8" />}
              title="No lineups or history yet"
              description="Save your first crew record here, then use Schedule for the day-by-day session report."
              action={
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button onClick={() => setIsAdding(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors">
                    Save your first crew record
                  </button>
                  <Link to="/team-management/schedule" className="text-indigo-400 hover:underline font-medium">
                    Go to Schedule
                  </Link>
                </div>
              }
            />
      ) : visibleActiveBoatings.length === 0 && visibleArchivedBoatings.length === 0 && showingFocusedRange ? (
        <EmptyState
          icon={<CalendarDays className="w-8 h-8" />}
          title="No lineups in this schedule range"
          description={`There are no saved crew records dated within ${embeddedContext?.rangeLabel}. Switch to All Saved to reuse a lineup from another day.`}
          action={(
            <Button type="button" variant="secondary" size="lg" onClick={() => setDateScope('all')}>
              Show all saved lineups
            </Button>
          )}
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
          {/* ── Saved Crew Records ── */}
          {visibleActiveBoatings.length > 0 ? (
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Saved crew records</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {showingFocusedRange
                    ? 'Saved crew records from the current schedule range, sorted fastest first by adjusted lineup 2k.'
                    : 'Reusable org-wide lineups and recent shell records, sorted fastest first by adjusted lineup 2k.'}
                </p>
              </div>
              {visibleActiveBoatings.map((boating) => (
                <BoatingCard
                  key={boating.id}
                  boating={boating}
                  athletes={athletes}
                  allBoatings={visibleActiveBoatings}
                  expanded={expandedBoating === boating.id}
                  onToggleExpand={() => {
                    if (draftEditId === boating.id) return; // prevent collapse while editing
                    setExpandedBoating(expandedBoating === boating.id ? null : boating.id);
                  }}
                  onEdit={() => setEditingBoating(boating)}
                  onDelete={() => setPendingAction({ kind: 'delete', boating })}
                  onDuplicate={() => handleDuplicate(boating)}
                  onArchive={() => setPendingAction({ kind: 'archive', boating })}
                  onPositionsChange={(newPos) => handleInlinePositionUpdate(boating.id, newPos)}
                  getAthleteName={getAthleteName}
                  isDragging={activeDragId !== null}
                  dndEnabled={showDndPanel}
                  userId={userId}
                  orgId={orgId}
                  fallbackTeamId={effectiveTeamId}
                  prediction={lineupPredictions.get(boating.id) ?? null}
                  isEditingLineup={draftEditId === boating.id}
                  draftPositions={draftEditId === boating.id ? draftPositions : undefined}
                  onEnterEditMode={() => handleEnterEditMode(boating.id)}
                  onSaveDraft={handleSaveDraft}
                  onDiscardDraft={handleDiscardDraft}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-neutral-500 text-sm">
              No saved crew records yet. Save a new one or restore one from history.
            </div>
          )}

          {/* ── History ── */}
          {visibleArchivedBoatings.length > 0 && (
            <div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-3"
              >
                <History className="w-4 h-4" />
                {showingFocusedRange ? 'Crew history in focus' : 'Crew history archive'} ({visibleArchivedBoatings.length})
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
                             onDelete={() => setPendingAction({ kind: 'delete', boating })}
                              onReactivate={() => handleToggleActive(boating.id, true)}
                              onPositionsChange={(newPos) => handleInlinePositionUpdate(boating.id, newPos)}
                              getAthleteName={getAthleteName}
                              archived
                              userId={userId}
                              orgId={orgId}
                              fallbackTeamId={effectiveTeamId}
                              prediction={lineupPredictions.get(boating.id) ?? null}
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
        <BoatingForm
          athletes={formAthletes}
          boats={boats}
          allBoatings={activeBoatings}
          templateBoatings={boatings}
          onSave={handleSave}
          onCancel={() => setIsAdding(false)}
        />
      )}

      {editingBoating && (
        <BoatingForm
          athletes={formAthletes}
          boats={boats}
          allBoatings={activeBoatings}
          templateBoatings={boatings}
          boating={editingBoating}
          onSave={handleEdit}
          onCancel={() => setEditingBoating(null)}
        />
      )}

      {pendingAction && (
        <BoatingActionDialog
          action={pendingAction}
          loading={isConfirmingAction}
          onCancel={() => {
            if (!isConfirmingAction) setPendingAction(null);
          }}
          onConfirm={handleConfirmPendingAction}
        />
      )}
    </div>
    </>
  );
}

export function CoachingBoatings() {
  return <Navigate to="/team-management/schedule?tab=lineups&from=boatings" replace />;
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
  userId,
  orgId,
  fallbackTeamId,
  prediction,
  isEditingLineup,
  draftPositions,
  onEnterEditMode,
  onSaveDraft,
  onDiscardDraft,
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
  userId: string;
  orgId?: string | null;
  fallbackTeamId?: string | null;
  prediction?: LineupScorePrediction | null;
  isEditingLineup?: boolean;
  draftPositions?: BoatPosition[];
  onEnterEditMode?: () => void;
  onSaveDraft?: () => void;
  onDiscardDraft?: () => void;
}) {
  const sessionId = boating.session_id ?? null;
  const [sessionNotes, setSessionNotes] = useState<CoachingAthleteNote[]>([]);
  const [coachNotesByAthlete, setCoachNotesByAthlete] = useState<Record<string, CoachingAthleteCoachNote[]>>({});
  const [raceResults, setRaceResults] = useState<CoachingBoatingRaceResult[]>([]);
  const [isRaceResultFormOpen, setIsRaceResultFormOpen] = useState(false);
  const [editingRaceResult, setEditingRaceResult] = useState<CoachingBoatingRaceResult | null>(null);
  const [isSavingRaceResult, setIsSavingRaceResult] = useState(false);
  const [deletingRaceResultId, setDeletingRaceResultId] = useState<string | null>(null);
  const [scheduleRaceEvents, setScheduleRaceEvents] = useState<CoachingScheduleEvent[]>([]);
  const [isLoadingRaceEvents, setIsLoadingRaceEvents] = useState(false);

  useEffect(() => {
    if (!expanded) return;

    const athleteIds = [...new Set(boating.positions.map((position) => position.athlete_id))];
    if (athleteIds.length === 0) return;

    Promise.all([
      sessionId ? getNotesForSession(sessionId) : Promise.resolve([]),
      Promise.all(
        athleteIds.map(async (athleteId) => [athleteId, await getCoachNotesForAthlete(athleteId, 3)] as const)
      ),
    ])
      .then(([sessionRows, coachNoteRows]) => {
        setSessionNotes(sessionRows);
        setCoachNotesByAthlete(Object.fromEntries(coachNoteRows));
      })
      .catch((err) => {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Failed to load rower notes');
      });
  }, [boating.positions, expanded, sessionId]);

  useEffect(() => {
    if (!expanded) return;

    getBoatingRaceResults(boating.id)
      .then((rows) => setRaceResults(rows))
      .catch((err) => {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Failed to load race results');
      });
  }, [boating.id, expanded]);

  useEffect(() => {
    if (!isRaceResultFormOpen || !orgId) return;

    const teamScope = boating.team_id ?? fallbackTeamId ?? undefined;
    if (!teamScope) return;

    setIsLoadingRaceEvents(true);
    getScheduleEvents(
      orgId,
      format(subDays(parseLocalDate(boating.date), 365), 'yyyy-MM-dd'),
      format(addDays(parseLocalDate(boating.date), 365), 'yyyy-MM-dd'),
      teamScope
    )
      .then((rows) => setScheduleRaceEvents(rows.filter((event) => RACE_EVENT_TYPES.includes(event.event_type))))
      .catch((err) => {
        console.error(err);
        toast.error(err instanceof Error ? err.message : 'Failed to load race events');
      })
      .finally(() => setIsLoadingRaceEvents(false));
  }, [boating.date, boating.team_id, fallbackTeamId, isRaceResultFormOpen, orgId]);

  const seatNotesByAthlete = useMemo<Record<string, SeatNoteSummary>>(() => {
    const map: Record<string, SeatNoteSummary> = {};

    for (const position of boating.positions) {
      const athleteId = position.athlete_id;
      const athleteSessionNotes = sessionNotes.filter((note) => note.athlete_id === athleteId);
      const athleteCoachNotes = coachNotesByAthlete[athleteId] ?? [];
      const totalCount = athleteSessionNotes.length + athleteCoachNotes.length;

      if (totalCount > 0) {
        map[athleteId] = {
          totalCount,
          sessionNotes: athleteSessionNotes,
          coachNotes: athleteCoachNotes,
        };
      }
    }

    return map;
  }, [boating.positions, coachNotesByAthlete, sessionNotes]);

  const currentLineupSignature = useMemo(
    () => buildLineupSignature(boating.positions),
    [boating.positions]
  );
  const currentLineupSnapshot = useMemo(
    () => normalizeLineupPositions(boating.positions),
    [boating.positions]
  );
  const currentVersionRaceResults = useMemo(
    () => raceResults.filter((result) => result.lineup_signature === currentLineupSignature),
    [currentLineupSignature, raceResults]
  );
  const olderVersionRaceResults = useMemo(
    () => raceResults.filter((result) => result.lineup_signature !== currentLineupSignature),
    [currentLineupSignature, raceResults]
  );
  const canSaveRaceResult = Boolean((boating.team_id ?? fallbackTeamId) && userId);

  const handleSaveRaceResult = useCallback(async (data: BoatingRaceResultFormData) => {
    const targetTeamId = boating.team_id ?? fallbackTeamId;
    if (!targetTeamId) {
      toast.error('This crew record is missing a team, so race results cannot be saved yet.');
      return;
    }

    const payload = {
      ...data,
      boating_id: boating.id,
      lineup_signature: editingRaceResult?.lineup_signature ?? currentLineupSignature,
      lineup_positions: editingRaceResult?.lineup_positions ?? currentLineupSnapshot,
    };

    setIsSavingRaceResult(true);
    try {
      const saved = editingRaceResult
        ? await updateBoatingRaceResult(editingRaceResult.id, payload)
        : await createBoatingRaceResult(targetTeamId, userId, payload);
      setRaceResults((prev) => {
        const next = editingRaceResult
          ? prev.map((entry) => (entry.id === saved.id ? saved : entry))
          : [saved, ...prev];
        return next.sort((left, right) => right.race_date.localeCompare(left.race_date) || right.created_at.localeCompare(left.created_at));
      });
      setEditingRaceResult(null);
      setIsRaceResultFormOpen(false);
      toast.success(editingRaceResult ? 'Race result updated.' : 'Race result saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save race result');
    } finally {
      setIsSavingRaceResult(false);
    }
  }, [boating.id, boating.team_id, currentLineupSignature, currentLineupSnapshot, editingRaceResult, fallbackTeamId, userId]);

  const handleDeleteRaceResult = useCallback(async (result: CoachingBoatingRaceResult) => {
    setDeletingRaceResultId(result.id);
    try {
      await deleteBoatingRaceResult(result.id);
      setRaceResults((prev) => prev.filter((entry) => entry.id !== result.id));
      toast.success('Race result deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete race result');
    } finally {
      setDeletingRaceResultId(null);
    }
  }, []);

  // Effective positions: draft when editing, boating.positions otherwise
  const effectivePositions = isEditingLineup && draftPositions ? draftPositions : boating.positions;

  return (
    <div className={`bg-neutral-900 border rounded-xl overflow-hidden ${isEditingLineup ? 'border-amber-500/60 ring-1 ring-amber-500/20' : archived ? 'border-neutral-800/60 opacity-75' : 'border-neutral-800'}`}>
      {/* ── Edit mode toolbar ── */}
      {isEditingLineup && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-900/20 border-b border-amber-800/40">
          <div className="flex items-center gap-2 text-xs text-amber-300">
            <Pencil className="w-3.5 h-3.5" />
            <span className="font-medium">Editing lineup</span>
            <span className="text-amber-400/60">— changes are unsaved</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onDiscardDraft}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-600 text-neutral-300 hover:bg-neutral-700 text-xs font-medium transition-colors"
            >
              <Undo2 className="w-3 h-3" />
              Discard
            </button>
            <button
              onClick={onSaveDraft}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 text-xs font-medium transition-colors"
            >
              <Save className="w-3 h-3" />
              Save Lineup
            </button>
          </div>
        </div>
      )}
      <div
        className="px-3 py-2 flex items-center gap-3 cursor-pointer hover:bg-neutral-800/50 transition-colors"
        onClick={onToggleExpand}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${archived ? 'bg-neutral-700' : 'bg-indigo-600'}`}>
          <span className="text-white font-bold text-xs">{boating.boat_type}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white text-sm truncate">{boating.boat_name}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {boating.notes && (
              <InlinePopover
                triggerLabel="Crew note"
                triggerIcon={<MessageSquare className="h-3.5 w-3.5" />}
              >
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Crew note</div>
                  <p className="text-sm text-neutral-800">{boating.notes}</p>
                </div>
              </InlinePopover>
            )}
            {!expanded && prediction && !archived && (
              <>
                <span className="inline-flex items-center rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-200">
                  Adj {prediction.lineupScoreFormatted ?? '—'}
                </span>
                <span className="inline-flex items-center rounded-full border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-[11px] font-medium text-neutral-300">
                  Raw {prediction.averageRaw2kFormatted ?? '—'}
                </span>
                {prediction.averageSPI != null && (
                  <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
                    SPI {prediction.averageSPI.toFixed(2)}
                  </span>
                )}
                {prediction.negativeMatchCount > 0 && (
                  <span className="inline-flex items-center rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-300">
                    {prediction.negativeMatchCount} brake{prediction.negativeMatchCount === 1 ? '' : 's'}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1.5 hover:bg-neutral-700 rounded-md transition-colors" title="Edit crew record" aria-label={`Edit ${boating.boat_name}`}>
            <Edit2 className="w-3.5 h-3.5 text-neutral-500" />
          </button>
          {!archived && onDuplicate && (
            <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="p-1.5 hover:bg-neutral-700 rounded-md transition-colors" title="Copy crew record" aria-label={`Copy ${boating.boat_name}`}>
              <Copy className="w-3.5 h-3.5 text-neutral-500" />
            </button>
          )}
          {!archived && onArchive && (
            <button onClick={(e) => { e.stopPropagation(); onArchive(); }} className="p-1.5 hover:bg-neutral-700 rounded-md transition-colors" title="Move to history" aria-label={`Move ${boating.boat_name} to history`}>
              <Archive className="w-3.5 h-3.5 text-neutral-500" />
            </button>
          )}
          {archived && onReactivate && (
            <button onClick={(e) => { e.stopPropagation(); onReactivate(); }} className="p-1.5 hover:bg-neutral-700 rounded-md transition-colors" title="Restore from history" aria-label={`Restore ${boating.boat_name} from history`}>
              <RotateCcw className="w-3.5 h-3.5 text-neutral-500" />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 hover:bg-neutral-700 rounded-md transition-colors" title="Delete crew record" aria-label={`Delete ${boating.boat_name}`}>
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
        <CompactSeatStrip boating={boating} positions={effectivePositions} getAthleteName={getAthleteName} dndEnabled={dndEnabled} />
      )}

      {expanded && (
        <div className={`border-t p-4 ${isEditingLineup ? 'border-amber-800/40 bg-amber-900/5' : 'border-neutral-800 bg-neutral-800/30'}`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-400">
            <span>{format(parseLocalDate(boating.date), 'EEEE, MMM d, yyyy')}</span>
            {!archived && !isEditingLineup && onEnterEditMode && (
              <button
                onClick={onEnterEditMode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-700 text-xs font-medium transition-colors"
              >
                <Pencil className="w-3 h-3" />
                Edit Lineup
              </button>
            )}
          </div>
          {prediction && !archived && (
            <LineupPredictorPanel prediction={prediction} />
          )}
          {!isEditingLineup && (
            <BoatingRaceResultsPanel
              results={raceResults}
              currentVersionResults={currentVersionRaceResults}
              olderVersionResults={olderVersionRaceResults}
              onAdd={() => {
                setEditingRaceResult(null);
                setIsRaceResultFormOpen(true);
              }}
              onEdit={(result) => {
                setEditingRaceResult(result);
                setIsRaceResultFormOpen(true);
              }}
              onDelete={handleDeleteRaceResult}
              canSave={canSaveRaceResult}
              deletingResultId={deletingRaceResultId}
            />
          )}
          <BoatDiagram
            boatType={boating.boat_type}
            positions={effectivePositions}
            getAthleteName={getAthleteName}
            athletes={athletes}
            seatNotesByAthlete={seatNotesByAthlete}
            boatingId={boating.id}
            onPositionsChange={archived ? undefined : onPositionsChange}
            allBoatings={allBoatings}
            currentBoatingDate={boating.date}
            isDragging={isDragging}
            dndEnabled={dndEnabled}
          />
        </div>
      )}
      {isRaceResultFormOpen && (
        <RaceResultForm
          boating={boating}
          existing={editingRaceResult ?? undefined}
          scheduleEvents={scheduleRaceEvents}
          isLoadingEvents={isLoadingRaceEvents}
          onSave={handleSaveRaceResult}
          onCancel={() => {
            if (isSavingRaceResult) return;
            setIsRaceResultFormOpen(false);
            setEditingRaceResult(null);
          }}
          saving={isSavingRaceResult}
        />
      )}
    </div>
  );
}

function LineupPredictorPanel({ prediction }: { prediction: LineupScorePrediction }) {
  const format2k = (value: string | null) => value ?? 'Not enough evidence';

  const syncMatchColor = (match: SyncMatch): string => {
    if (match === 'optimal') return 'text-emerald-600 dark:text-emerald-400';
    if (match === 'stress') return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const syncMatchLabel = (match: SyncMatch, gapSeconds: number | null): string => {
    if (match === 'optimal') return 'Optimal';
    if (match === 'stress') return gapSeconds != null && gapSeconds < 0 ? 'Mismatch' : 'Stress';
    return gapSeconds != null && gapSeconds < 0 ? 'Mismatch' : 'Brake';
  };

  return (
    <div className="mb-4 rounded-xl border border-indigo-200 bg-white/95 p-4 shadow-sm dark:border-indigo-500/20 dark:bg-indigo-500/5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-200">
              <Gauge className="h-3.5 w-3.5" />
              Crew 2k profile
            </span>
            <InlinePopover
              triggerLabel="Model details"
              triggerIcon={<Info className="h-3.5 w-3.5" />}
            >
              <div className="space-y-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Evidence</div>
                  <div className="mt-1 text-sm text-neutral-800">
                    {prediction.totalEvidenceCount} point{prediction.totalEvidenceCount === 1 ? '' : 's'} across {prediction.modeledRowerSeats} modeled seat{prediction.modeledRowerSeats === 1 ? '' : 's'}.
                  </div>
                  <div className="mt-1 text-xs text-neutral-600">
                    Latest: {prediction.latestEvidenceDate ? format(parseLocalDate(prediction.latestEvidenceDate), 'MMM d, yyyy') : 'No erg evidence yet'}
                  </div>
                  <div className="mt-1 text-xs text-neutral-600">
                    Coverage: {prediction.modeledRowerSeats} of {prediction.expectedRowerSeats} rower seats modeled
                  </div>
                </div>

                {prediction.athletes.some((a) => a.spiValue != null || a.syncMatch != null) && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Per-seat breakdown</div>
                    <div className="mt-2 space-y-1.5">
                      {prediction.athletes.map((athlete) => (
                        <div key={athlete.athleteId} className="flex items-center justify-between text-xs">
                          <span className="text-neutral-800 truncate max-w-[140px]">{athlete.athleteName}</span>
                          <div className="flex items-center gap-2">
                            {athlete.spiValue != null && (
                              <span className="text-neutral-600">SPI {athlete.spiValue.toFixed(2)}</span>
                            )}
                            {athlete.syncMatch != null && (
                              <span className={syncMatchColor(athlete.syncMatch)}>
                                {athlete.syncGapSeconds != null ? `${athlete.syncGapSeconds > 0 ? '+' : ''}${athlete.syncGapSeconds.toFixed(1)}s` : '—'}
                                {' '}({syncMatchLabel(athlete.syncMatch, athlete.syncGapSeconds ?? null)})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Assumptions</div>
                  <ul className="mt-1 space-y-1 text-xs text-neutral-700">
                    {prediction.assumptions.map((assumption) => (
                      <li key={assumption}>{assumption}</li>
                    ))}
                  </ul>
                </div>

                {prediction.warnings.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Warnings</div>
                    <ul className="mt-1 space-y-1 text-xs text-amber-800">
                      {prediction.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </InlinePopover>
          </div>
          <p className="text-sm text-neutral-900 dark:text-white">
            Weight-adjusted lineup 2k profile for this {prediction.boatType}, built for lineup comparison rather than literal race-time prediction.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/70">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-500">
            Adjusted 2k score
          </div>
          <div className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">{format2k(prediction.lineupScoreFormatted)}</div>
          <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            Average weight-adjusted 2k across modeled rower seats
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/70">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-500">
            Raw 2k average
          </div>
          <div className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">{format2k(prediction.averageRaw2kFormatted)}</div>
          <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            Before the body-weight correction lens
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
            Crew SPI
          </div>
          <div className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
            {prediction.averageSPI != null ? prediction.averageSPI.toFixed(2) : 'N/A'}
          </div>
          <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            {prediction.averageSPI != null
              ? `${getSPILabel(prediction.averageSPI)} · Range ${prediction.spiRange ? `${prediction.spiRange.min.toFixed(2)}–${prediction.spiRange.max.toFixed(2)}` : '—'}`
              : 'Needs athlete weight + erg evidence'}
          </div>
        </div>
        <div className={`rounded-xl border p-3 ${
          prediction.negativeMatchCount > 0
            ? 'border-red-200 bg-red-50/50 dark:border-red-500/20 dark:bg-red-500/5'
            : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/70'
        }`}>
          <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
            prediction.negativeMatchCount > 0
              ? 'text-red-700 dark:text-red-400'
              : 'text-neutral-500 dark:text-neutral-500'
          }`}>
            Sync gap
          </div>
          <div className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
            {prediction.boatAverageSplitSeconds != null
              ? prediction.negativeMatchCount > 0
                ? `${prediction.negativeMatchCount} brake${prediction.negativeMatchCount === 1 ? '' : 's'}`
                : 'All clear'
              : 'N/A'}
          </div>
          <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            {prediction.boatAverageSplitSeconds != null
              ? `Athletes >7s off crew avg flagged as mechanical brakes`
              : 'Needs erg evidence to evaluate'}
          </div>
        </div>
      </div>
    </div>
  );
}

function BoatingRaceResultsPanel({
  results,
  currentVersionResults,
  olderVersionResults,
  onAdd,
  onEdit,
  onDelete,
  canSave,
  deletingResultId,
}: {
  results: CoachingBoatingRaceResult[];
  currentVersionResults: CoachingBoatingRaceResult[];
  olderVersionResults: CoachingBoatingRaceResult[];
  onAdd: () => void;
  onEdit: (result: CoachingBoatingRaceResult) => void;
  onDelete: (result: CoachingBoatingRaceResult) => void;
  canSave: boolean;
  deletingResultId: string | null;
}) {
  return (
    <div className="mb-4 rounded-xl border border-neutral-200 bg-white/95 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/70">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
              <Trophy className="h-3.5 w-3.5" />
              Race results
            </span>
            {currentVersionResults.length > 0 && (
              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                {currentVersionResults.length} exact-lineup result{currentVersionResults.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            Record actual water times against this saved lineup. If the seats change later, old results stay historical and no longer count as direct lineup matches.
          </p>
          {olderVersionResults.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {olderVersionResults.length} older result{olderVersionResults.length === 1 ? '' : 's'} belong to earlier versions of this crew record.
            </p>
          )}
        </div>
        <Button type="button" onClick={onAdd} disabled={!canSave}>
          Add race result
        </Button>
      </div>

      {results.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-neutral-300 px-4 py-3 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
          No race results yet. Add one manually, or pick a real event from the calendar and fill in the boat time.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {results.map((result) => {
            const isCurrentVersion = currentVersionResults.some((entry) => entry.id === result.id);
            return (
              <div key={result.id} className="rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950/60">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-neutral-900 dark:text-white">{result.event_name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        isCurrentVersion
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200'
                      }`}>
                        {isCurrentVersion ? 'Current lineup' : 'Earlier lineup version'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                      <span>{format(parseLocalDate(result.race_date), 'MMM d, yyyy')}</span>
                      <span>{result.distance_meters}m</span>
                      <span className="font-mono text-neutral-900 dark:text-white">{formatTime(result.time_seconds)}</span>
                    </div>
                    {result.notes && (
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">{result.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 self-end sm:self-start">
                    <button
                      type="button"
                      onClick={() => onEdit(result)}
                      className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
                      aria-label={`Edit ${result.event_name} race result`}
                      title="Edit race result"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(result)}
                      disabled={deletingResultId === result.id}
                      className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-rose-700 disabled:opacity-50 dark:hover:bg-neutral-800 dark:hover:text-rose-300"
                      aria-label={`Delete ${result.event_name} race result`}
                      title="Delete race result"
                    >
                      {deletingResultId === result.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RaceResultForm({
  boating,
  existing,
  scheduleEvents,
  isLoadingEvents,
  onSave,
  onCancel,
  saving,
}: {
  boating: CoachingBoating;
  existing?: CoachingBoatingRaceResult;
  scheduleEvents: CoachingScheduleEvent[];
  isLoadingEvents: boolean;
  onSave: (data: BoatingRaceResultFormData) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [selectedEventId, setSelectedEventId] = useState(existing?.schedule_event_id ?? '');
  const [raceDate, setRaceDate] = useState(existing?.race_date ?? boating.date);
  const [eventName, setEventName] = useState(existing?.event_name ?? '');
  const [distanceMeters, setDistanceMeters] = useState(existing?.distance_meters ? String(existing.distance_meters) : '2000');
  const [timeInput, setTimeInput] = useState(existing ? formatTime(existing.time_seconds) : '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const raceEventOptions = useMemo(
    () => [...scheduleEvents].sort((left, right) => right.date.localeCompare(left.date)),
    [scheduleEvents]
  );

  const handleEventSelection = (eventId: string) => {
    setSelectedEventId(eventId);
    if (!eventId) return;
    const selected = raceEventOptions.find((event) => event.id === eventId);
    if (!selected) return;
    setRaceDate(selected.date);
    setEventName(selected.title);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const parsedTime = parsePaceToSeconds(timeInput);
    const parsedDistance = Number.parseInt(distanceMeters, 10);

    if (!eventName.trim()) {
      toast.error('Enter an event name.');
      return;
    }
    if (!raceDate) {
      toast.error('Choose a race date.');
      return;
    }
    if (!Number.isFinite(parsedDistance) || parsedDistance < 250) {
      toast.error('Enter a valid race distance.');
      return;
    }
    if (parsedTime == null || parsedTime <= 0) {
      toast.error('Enter the actual boat time in MM:SS.t format.');
      return;
    }

    onSave({
      schedule_event_id: selectedEventId || null,
      race_date: raceDate,
      event_name: eventName.trim(),
      distance_meters: parsedDistance,
      time_seconds: parsedTime,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{existing ? 'Edit Race Result' : 'Add Race Result'}</h2>
            <p className="mt-1 text-sm text-neutral-400">{boating.boat_name}</p>
          </div>
          <button onClick={onCancel} className="rounded-lg p-2 transition-colors hover:bg-neutral-800" title="Close">
            <X className="h-5 w-5 text-neutral-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="race-event-link" className="mb-2 block text-sm font-medium text-neutral-300">Calendar event (optional)</label>
            <select
              id="race-event-link"
              value={selectedEventId}
              onChange={(event) => handleEventSelection(event.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-white outline-none focus:border-transparent focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">{isLoadingEvents ? 'Loading race events…' : 'Enter manually'}</option>
              {raceEventOptions.map((raceEvent) => (
                <option key={raceEvent.id} value={raceEvent.id}>
                  {format(parseLocalDate(raceEvent.date), 'MMM d')} · {raceEvent.title}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              Pull from your real calendar event when possible, or leave it manual.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="race-event-name" className="mb-2 block text-sm font-medium text-neutral-300">Event name</label>
              <input
                id="race-event-name"
                type="text"
                value={eventName}
                onChange={(event) => setEventName(event.target.value)}
                placeholder="e.g. State Finals"
                className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-white outline-none focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="race-date" className="mb-2 block text-sm font-medium text-neutral-300">Race date</label>
              <input
                id="race-date"
                type="date"
                value={raceDate}
                onChange={(event) => setRaceDate(event.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-white outline-none focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="race-distance" className="mb-2 block text-sm font-medium text-neutral-300">Distance (m)</label>
              <input
                id="race-distance"
                type="number"
                min={250}
                step={1}
                value={distanceMeters}
                onChange={(event) => setDistanceMeters(event.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-white outline-none focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="race-time" className="mb-2 block text-sm font-medium text-neutral-300">Actual boat time</label>
              <input
                id="race-time"
                type="text"
                value={timeInput}
                onChange={(event) => setTimeInput(event.target.value)}
                placeholder="e.g. 5:58.4"
                className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 font-mono text-white outline-none focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="race-notes" className="mb-2 block text-sm font-medium text-neutral-300">Notes (optional)</label>
            <textarea
              id="race-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-white outline-none focus:border-transparent focus:ring-2 focus:ring-indigo-500"
              placeholder="Lane, conditions, margin, or anything worth remembering."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} className="flex-1">
              {existing ? 'Save race result' : 'Add race result'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InlinePopover({
  triggerLabel,
  triggerIcon,
  children,
}: {
  triggerLabel: string;
  triggerIcon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="relative" onClick={(event) => event.stopPropagation()}>
      <summary className="flex list-none cursor-pointer items-center gap-1 rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800">
        {triggerIcon}
        {triggerLabel}
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-neutral-200 bg-white p-3 shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
        {children}
      </div>
    </details>
  );
}

function SeatNotesPopover({
  athleteName,
  summary,
}: {
  athleteName: string;
  summary: SeatNoteSummary;
}) {
  return (
    <InlinePopover
      triggerLabel={`${summary.totalCount}`}
      triggerIcon={<MessageSquare className="h-3.5 w-3.5" />}
    >
      <div className="space-y-3">
        <div>
          <div className="text-sm font-semibold text-neutral-900">{athleteName}</div>
          <div className="text-xs text-neutral-600">
            {summary.totalCount} note{summary.totalCount === 1 ? '' : 's'} on this seat
          </div>
        </div>

        {summary.sessionNotes.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-700">Session notes</div>
            <div className="mt-1 space-y-2">
              {summary.sessionNotes.map((note) => (
                <div key={note.id} className="rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-2 text-xs text-neutral-800">
                  {note.note}
                </div>
              ))}
            </div>
          </div>
        )}

        {summary.coachNotes.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Coach notes</div>
            <div className="mt-1 space-y-2">
              {summary.coachNotes.map((note) => (
                <div key={note.id} className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-xs text-neutral-800">
                  <div className="mb-1 text-[10px] text-neutral-500">
                    {note.author_display_name ?? 'Coach'} · {format(new Date(note.created_at), 'MMM d')}
                  </div>
                  {note.note}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </InlinePopover>
  );
}

/* ─── Compact Seat Strip (default collapsed view with initials) ───────────── */

function getInitials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 3);
}

function CompactSeatStrip({
  boating,
  positions,
  getAthleteName,
  dndEnabled,
}: {
  boating: CoachingBoating;
  positions: CoachingBoating['positions'];
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
        const pos = positions.find((p) => p.seat === seat);
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
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { type: 'Seat', boatingId, seat, layout: 'compact' },
    disabled: !dndEnabled,
  });

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
  seatNotesByAthlete,
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
  seatNotesByAthlete?: Record<string, SeatNoteSummary>;
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
                  aria-label={`Swap ${getSeatLabel(seat)} seat`}
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
              boatingId={boatingId}
              seat={seat}
              noteSummary={athleteId ? seatNotesByAthlete?.[athleteId] : undefined}
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
  boatingId,
  seat,
  noteSummary,
}: {
  athleteId: string;
  name: string;
  isSwapSource: boolean;
  isDndActive?: boolean;
  boatingId?: string;
  seat?: number;
  noteSummary?: SeatNoteSummary;
}) {
  // Prefix to avoid ID collision with roster DraggableAthleteCard
  const draggableId = `seated-${athleteId}`;
  const { attributes, listeners, setNodeRef, isDragging: selfDragging } = useDraggable({
    id: draggableId,
    data: { type: 'SeatedAthlete', athleteId, boatingId, seat },
    disabled: !isDndActive,
  });

  if (!isDndActive) {
    return (
      <div className="flex flex-1 items-center justify-between gap-2">
        <span className={`text-sm font-medium ${isSwapSource ? 'text-amber-300' : 'text-neutral-300'}`}>
          {name}
          {isSwapSource && <span className="ml-2 text-xs text-amber-500">(pick swap target)</span>}
        </span>
        {noteSummary && noteSummary.totalCount > 0 && (
          <SeatNotesPopover athleteName={name} summary={noteSummary} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-between gap-2">
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
      {noteSummary && noteSummary.totalCount > 0 && (
        <SeatNotesPopover athleteName={name} summary={noteSummary} />
      )}
    </div>
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
    data: { type: 'Seat', boatingId, seat, layout: 'expanded' },
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
      <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">Roster pool</h3>

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
          <span>{showUnboatedOnly ? 'Showing unassigned' : 'Show unassigned only'}</span>
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

      <p className="text-[10px] text-neutral-600 text-center">Drag to seats · Drop here to remove from a crew</p>
    </div>
  );
}

function BoatingActionDialog({
  action,
  loading,
  onCancel,
  onConfirm,
}: {
  action: Exclude<PendingBoatingAction, null>;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isDelete = action.kind === 'delete';
  const title = isDelete ? 'Delete crew record?' : 'Move crew record to history?';
  const description = isDelete
    ? 'This will permanently remove the crew record and all of its current seat assignments.'
    : 'This will move the crew record into the history archive. You can restore it later from Crew history archive.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-800 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm text-neutral-400">{action.boating.boat_name}</p>
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-md p-2 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-white disabled:opacity-50"
            aria-label="Close confirmation dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm text-neutral-300">
          <p>{description}</p>
          <p className="text-neutral-500">
            {isDelete ? 'This action cannot be undone.' : 'Use reactivation if you need it back in the active list.'}
          </p>
        </div>

        <div className="flex justify-end gap-3 border-t border-neutral-800 px-5 py-4">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant={isDelete ? 'danger' : 'secondary'} loading={loading} onClick={onConfirm}>
            {isDelete ? 'Delete crew record' : 'Move to history'}
          </Button>
        </div>
      </div>
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
  boats,
  allBoatings,
  templateBoatings,
  boating,
  onSave,
  onCancel,
}: {
  athletes: CoachingAthlete[];
  boats: CoachingBoat[];
  allBoatings: CoachingBoating[];
  templateBoatings: CoachingBoating[];
  boating?: CoachingBoating;
  onSave: (data: BoatingFormData) => void;
  onCancel: () => void;
}) {
  const [selectedBoatId, setSelectedBoatId] = useState(boating?.boat_id ?? '');
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

  const findLatestBoatTemplate = (boatId: string) => {
    return [...templateBoatings]
      .filter((entry) => entry.boat_id === boatId && entry.id !== boating?.id && entry.positions.length > 0)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  };

  const handleBoatSelection = (boatId: string) => {
    setSelectedBoatId(boatId);
    if (!boatId) return;

    const selectedBoat = boats.find((boat) => boat.id === boatId);
    if (!selectedBoat) return;

    setBoatName(selectedBoat.boat_name);
    const latestTemplate = findLatestBoatTemplate(boatId);
    if (!boating) {
      setBoatType(selectedBoat.boat_type);
      setPositions(latestTemplate ? latestTemplate.positions : []);
      return;
    }

    if (selectedBoat.boat_type !== boatType && positions.length === 0) {
      setBoatType(selectedBoat.boat_type);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      boat_id: selectedBoatId || null,
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
          <h2 className="text-xl font-bold text-white">{boating ? 'Edit Crew Record' : 'New Crew Record'}</h2>
          <button onClick={onCancel} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors" title="Close">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="existing-boat" className="block text-sm font-medium text-neutral-300 mb-2">Persistent Boat</label>
              <select
                id="existing-boat"
                value={selectedBoatId}
                onChange={(e) => handleBoatSelection(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              >
                  <option value="">Create a new boat record from this crew record</option>
                {boats.map((boat) => (
                  <option key={boat.id} value={boat.id}>
                    {boat.boat_name} · {boat.boat_type}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-neutral-500">
                Choose an existing shell, or leave blank to create a new persistent boat from this crew record.
              </p>
            </div>
            <div>
              <label htmlFor="boat-name" className="block text-sm font-medium text-neutral-300 mb-2">Boat Name</label>
              <input id="boat-name" type="text" value={boatName} onChange={(e) => setBoatName(e.target.value)}
                disabled={!!selectedBoatId}
                placeholder="e.g. Varsity 8+"
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none disabled:opacity-60" />
            </div>
            <div>
              <label htmlFor="boat-type" className="block text-sm font-medium text-neutral-300 mb-2">Boat Type</label>
              <select id="boat-type" value={boatType}
                disabled={!!selectedBoatId}
                onChange={(e) => { setBoatType(e.target.value as CoachingBoating['boat_type']); setPositions([]); }}
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none disabled:opacity-60">
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
              <label htmlFor="boating-notes" className="block text-sm font-medium text-neutral-300 mb-2">Crew notes (optional)</label>
            <textarea id="boating-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
              placeholder="Crew-level narrative: how the row went, what changed, seat moves, feel, or shell-specific observations..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel}
              className="flex-1 px-4 py-3 border border-neutral-700 rounded-xl text-neutral-300 hover:bg-neutral-800 transition-colors font-medium">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors font-medium">
              {boating ? 'Save Changes' : 'Save Crew Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
