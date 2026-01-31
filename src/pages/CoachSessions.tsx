import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Plus, Trash2, Activity, UserMinus, LayoutGrid, List as ListIcon, GripVertical, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragStartEvent,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Session {
    id: string;
    join_code: string;
    status: 'active' | 'finished';
    created_at: string;
    active_workout?: {
        type: 'just_row' | 'fixed_distance' | 'fixed_time';
        value: number;
        split_value?: number;
    };
}

interface Participant {
    id: string;
    session_id: string;
    display_name: string;
    status: 'ready' | 'active' | 'disconnected';
    data: any; // JSONB from PM5
    last_heartbeat: string;
    group_name?: string | null;
}

// --- Draggable Components ---
const SortableParticipantCard = ({ participant, onRemove }: { participant: Participant, onRemove: (id: string) => void }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: participant.id, data: { type: 'Participant', participant } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    if (isDragging) {
        return (
            <div ref={setNodeRef} style={style} className="bg-neutral-800/50 p-3 rounded-lg border border-emerald-500/30 opacity-50 h-[80px]">
            </div>
        );
    }

    return (
        <div ref={setNodeRef} style={style} className="bg-neutral-800 p-3 rounded-lg border border-neutral-700 hover:border-neutral-600 group relative">
            <div className="flex items-center gap-3">
                <button {...attributes} {...listeners} className="text-neutral-600 hover:text-white cursor-grab active:cursor-grabbing">
                    <GripVertical size={16} />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate">{participant.display_name}</div>
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <span>{participant.status === 'active' ? 'Rowing' : 'Ready'}</span>
                        {participant.data?.watts > 0 && (
                            <span className="text-emerald-400">{Math.round(participant.data.watts)}W</span>
                        )}
                    </div>
                </div>
                <button onClick={() => onRemove(participant.id)} className="text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <UserMinus size={16} />
                </button>
            </div>
        </div>
    );
};

const DroppableGroup = ({ id, title, participants, onRemoveParticipant, onDeleteGroup }: { id: string, title: string, participants: Participant[], onRemoveParticipant: (id: string) => void, onDeleteGroup?: (id: string) => void }) => {
    const { setNodeRef } = useSortable({ id, data: { type: 'Group', id } }); // Use sortable even for columns to allow them to accept drops? No, just use droppable or SortableContext

    return (
        <div ref={setNodeRef} className="bg-neutral-900/50 border border-neutral-800 rounded-xl flex flex-col h-full min-h-[200px]">
            <div className="p-3 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/80 rounded-t-xl">
                <h3 className="font-bold text-neutral-300 text-sm">{title} <span className="text-neutral-600 ml-2">({participants.length})</span></h3>
                {onDeleteGroup && (
                    <button onClick={() => onDeleteGroup(id)} className="text-neutral-600 hover:text-red-400">
                        <X size={14} />
                    </button>
                )}
            </div>
            <div className="p-3 flex-1 space-y-2">
                <SortableContext items={participants.map(p => p.id)} strategy={verticalListSortingStrategy}>
                    {participants.map(p => (
                        <SortableParticipantCard key={p.id} participant={p} onRemove={onRemoveParticipant} />
                    ))}
                </SortableContext>
                {participants.length === 0 && (
                    <div className="h-full flex items-center justify-center text-xs text-neutral-700 italic border-2 border-dashed border-neutral-800/50 rounded-lg">
                        Drop here
                    </div>
                )}
            </div>
        </div>
    );
};

export const CoachSessions: React.FC = () => {
    const { user } = useAuth();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
    const [groups, setGroups] = useState<string[]>([]); // Dynamic groups
    const [activeDragId, setActiveDragId] = useState<string | null>(null);

    // Hardcoded admin check (same as Layout.tsx)
    const isAdmin = user?.id === '93c46300-57eb-48c8-b35c-cc49c76cfa66';

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        if (isAdmin) {
            fetchSessions();
        }
    }, [isAdmin]);

    useEffect(() => {
        if (!selectedSessionId) return;
        fetchParticipants(selectedSessionId);

        // Reset groups when session changes
        setGroups([]);

        const channel = supabase
            .channel(`session_${selectedSessionId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'erg_session_participants', filter: `session_id=eq.${selectedSessionId}` },
                (payload) => handleRealtimeUpdate(payload)
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [selectedSessionId]);

    // Sync groups from participants
    useEffect(() => {
        const uniqueGroups = Array.from(new Set(participants.map(p => p.group_name).filter(Boolean))) as string[];
        // Merge with existing groups to keep empty ones, but ensure all used ones are present
        setGroups(prev => Array.from(new Set([...prev, ...uniqueGroups])));
    }, [participants]);

    const fetchSessions = async () => {
        const { data, error } = await supabase.from('erg_sessions').select('*').eq('status', 'active').order('created_at', { ascending: false });
        if (!error && data) setSessions(data as any);
    };

    const fetchParticipants = async (sessionId: string) => {
        const { data, error } = await supabase.from('erg_session_participants').select('*').eq('session_id', sessionId);
        if (!error && data) setParticipants(data as any);
    };

    const handleRealtimeUpdate = (payload: any) => {
        if (payload.eventType === 'INSERT') {
            setParticipants(prev => [...prev, payload.new]);
        } else if (payload.eventType === 'UPDATE') {
            setParticipants(prev => prev.map(p => p.id === payload.new.id ? payload.new : p));
        } else if (payload.eventType === 'DELETE') {
            setParticipants(prev => prev.filter(p => p.id !== payload.old.id));
        }
    };

    const createSession = async () => {
        if (!user) return;
        setLoading(true);
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const { data } = await supabase.from('erg_sessions').insert({ join_code: code, status: 'active', created_by: user.id } as any).select().single();
        if (data) {
            setSessions(prev => [data as any, ...prev]);
            setSelectedSessionId(data.id);
            setParticipants([]);
        }
        setLoading(false);
    };

    const endSession = async (sessionId: string) => {
        if (!window.confirm('End session?')) return;
        await supabase.from('erg_sessions').update({ status: 'finished', ended_at: new Date().toISOString() } as any).eq('id', sessionId);
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        if (selectedSessionId === sessionId) { setSelectedSessionId(null); setParticipants([]); }
    };

    const removeParticipant = async (participantId: string) => {
        if (!window.confirm('Remove participant?')) return;
        const { error } = await supabase.from('erg_session_participants').delete().eq('id', participantId);
        if (!error) setParticipants(prev => prev.filter(p => p.id !== participantId));
    };

    const createGroup = () => {
        const name = `Boat ${groups.length + 1}`;
        setGroups(prev => [...prev, name]);
    };

    const deleteGroup = (groupName: string) => {
        if (!window.confirm(`Delete group "${groupName}"? Participants will be unassigned.`)) return;
        setGroups(prev => prev.filter(g => g !== groupName));
        // Move participants to unassigned in DB
        const groupParticipants = participants.filter(p => p.group_name === groupName);
        groupParticipants.forEach(p => updateParticipantGroup(p.id, null));
    };

    const updateParticipantGroup = async (participantId: string, groupName: string | null) => {
        // Optimistic
        setParticipants(prev => prev.map(p => p.id === participantId ? { ...p, group_name: groupName } : p));

        await supabase.from('erg_session_participants').update({ group_name: groupName }).eq('id', participantId);
    };

    // DnD Handlers
    const handleDragStart = (event: DragStartEvent) => {
        setActiveDragId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDragId(null);

        if (!over) return;

        const participantId = active.id as string;
        const targetId = over.id as string;

        // Find the target group
        // If dropped on a container (Group)
        let targetGroup: string | null = null;

        if (targetId === 'unassigned') targetGroup = null;
        else if (groups.includes(targetId)) targetGroup = targetId;
        else {
            // Dropped on another participant?
            const targetParticipant = participants.find(p => p.id === targetId);
            if (targetParticipant) {
                targetGroup = targetParticipant.group_name || null;
            }
        }

        // Only update if changed
        const currentGroup = participants.find(p => p.id === participantId)?.group_name || null;
        if (currentGroup !== targetGroup) {
            updateParticipantGroup(participantId, targetGroup);
        }
    };

    const sections = useMemo(() => {
        const unassigned = participants.filter(p => !p.group_name);
        // Ensure all groups exist in the map even if empty
        const grouped: Record<string, Participant[]> = {};
        groups.forEach(g => grouped[g] = []);
        participants.filter(p => p.group_name).forEach(p => {
            if (p.group_name && grouped[p.group_name] === undefined) {
                // Group exists in data but not in state (synced from other coach?), add it
                grouped[p.group_name] = [];
            }
            if (p.group_name) grouped[p.group_name].push(p);
        });
        return { unassigned, grouped };
    }, [participants, groups]);

    // ... existing workout modal logic ...
    const [workoutModalOpen, setWorkoutModalOpen] = useState(false);
    const [workoutType, setWorkoutType] = useState<'just_row' | 'fixed_distance' | 'fixed_time'>('fixed_distance');
    const [workoutValue, setWorkoutValue] = useState(2000);
    const [startType, setStartType] = useState<'immediate' | 'synchronized'>('immediate');

    const setSessionWorkout = async () => {
        if (!selectedSessionId) return;
        const workoutConfig = {
            type: workoutType,
            value: workoutValue,
            split_value: workoutType === 'fixed_distance' ? 500 : 300,
            start_type: startType
        };
        await supabase.from('erg_sessions').update({ active_workout: workoutConfig as any, race_state: 0 }).eq('id', selectedSessionId);
        setWorkoutModalOpen(false);
        setSessions(prev => prev.map(s => s.id === selectedSessionId ? { ...s, active_workout: workoutConfig } : s));
    };

    const selectedSession = sessions.find(s => s.id === selectedSessionId);

    if (!isAdmin) return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-500">Access Restricted</div>;

    return (
        <div className="min-h-screen bg-neutral-950 p-6 md:p-12">
            {/* Modal ... */}
            {workoutModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md space-y-6">
                        <h3 className="text-xl font-bold text-white">Set Session Workout</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-2">
                                {[{ id: 'just_row', label: 'Just Row' }, { id: 'fixed_distance', label: 'Distance' }, { id: 'fixed_time', label: 'Time' }].map(type => (
                                    <button key={type.id} onClick={() => setWorkoutType(type.id as any)} className={`p-3 rounded-lg text-sm font-medium transition-colors ${workoutType === type.id ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}>{type.label}</button>
                                ))}
                            </div>
                            {workoutType !== 'just_row' && (
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">{workoutType === 'fixed_distance' ? 'Meters' : 'Seconds'}</label>
                                    <input type="number" value={workoutValue} onChange={(e) => setWorkoutValue(Number(e.target.value))} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500" />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Start Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setStartType('immediate')} className={`p-3 rounded-lg text-sm font-medium transition-colors ${startType === 'immediate' ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}>
                                        Self-Paced
                                    </button>
                                    <button onClick={() => setStartType('synchronized')} className={`p-3 rounded-lg text-sm font-medium transition-colors ${startType === 'synchronized' ? 'bg-purple-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}>
                                        Group Start
                                    </button>
                                </div>
                                <p className="text-xs text-neutral-500 mt-2">
                                    {startType === 'immediate' ? 'Rowers start whenever they are ready.' : 'Coach controls the "Set" and "Go" signal.'}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setWorkoutModalOpen(false)} className="flex-1 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-medium">Cancel</button>
                            <button onClick={setSessionWorkout} className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold">Set Workout</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Coach Dashboard</h1>
                        <p className="text-neutral-400">Manage live sessions & groups</p>
                    </div>
                    <button onClick={createSession} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors">
                        <Plus size={20} /> New Session
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Session List */}
                    <div className="lg:col-span-1 space-y-4">
                        <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-4">Active Sessions</h2>
                        {sessions.map(session => (
                            <div key={session.id} onClick={() => setSelectedSessionId(session.id)} className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedSessionId === session.id ? 'bg-neutral-800 border-emerald-500/50 shadow-lg' : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-700'}`}>
                                <div className="flex justify-between items-start mb-2"><div className="text-xs text-neutral-500">Join Code</div>{selectedSessionId === session.id && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}</div>
                                <div className="text-3xl font-mono font-bold text-white tracking-wider mb-3">{session.join_code}</div>
                                <div className="flex justify-between items-center"><div className="text-xs text-neutral-500">{new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div><button onClick={(e) => { e.stopPropagation(); endSession(session.id); }} className="p-1.5 text-neutral-600 hover:text-red-400"><Trash2 size={14} /></button></div>
                            </div>
                        ))}
                    </div>

                    {/* Main Content */}
                    <div className="lg:col-span-3">
                        {selectedSession ? (
                            <div className="space-y-6">
                                {/* Header / Controls */}
                                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-wrap gap-4 justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="font-mono text-xl text-white font-bold tracking-widest mr-4">{selectedSession.join_code}</div>
                                        <button onClick={() => setWorkoutModalOpen(true)} className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 rounded-lg transition-colors border border-emerald-500/20">
                                            <Activity size={14} /> {selectedSession.active_workout ? `${selectedSession.active_workout.type === 'fixed_distance' ? selectedSession.active_workout.value + 'm' : 'Workout Set'}` : 'Set Workout'}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 bg-neutral-800/50 p-1 rounded-lg border border-neutral-800">
                                        <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-neutral-700 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}><ListIcon size={18} /></button>
                                        <button onClick={() => setViewMode('board')} className={`p-2 rounded-md transition-colors ${viewMode === 'board' ? 'bg-neutral-700 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}><LayoutGrid size={18} /></button>
                                    </div>
                                </div>

                                {selectedSession?.active_workout && (selectedSession.active_workout as any).start_type === 'synchronized' && (
                                    <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-purple-500/20 p-2 rounded-lg text-purple-400">
                                                <Activity size={20} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white text-sm">Race Control</h3>
                                                <p className="text-xs text-purple-300/60">Synchronized Start Active</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={async () => {
                                                    const { error } = await supabase.from('erg_sessions').update({ race_state: 8 } as any).eq('id', selectedSessionId);
                                                    if (error) { console.error('SET failed:', error); alert('Failed to set race state'); }
                                                }}
                                                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm font-bold border border-neutral-700 transition-colors"
                                            >
                                                SET
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    const { error } = await supabase.from('erg_sessions').update({ race_state: 9 } as any).eq('id', selectedSessionId);
                                                    if (error) { console.error('GO failed:', error); alert('Failed to set race state'); }
                                                }}
                                                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-emerald-900/20 transition-colors"
                                            >
                                                GO!
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    const { error } = await supabase.from('erg_sessions').update({ race_state: 10 } as any).eq('id', selectedSessionId);
                                                    if (error) { console.error('False Start failed:', error); alert('Failed to set race state'); }
                                                }}
                                                className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-xs font-medium border border-red-900/50 transition-colors"
                                            >
                                                False Start
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {viewMode === 'list' ? (
                                    // List View (Leaderboard) with Grouping
                                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="border-b border-neutral-800 text-xs font-semibold text-neutral-500 uppercase tracking-wider bg-neutral-900/30">
                                                        <th className="px-6 py-4">Rower</th>
                                                        <th className="px-6 py-4">Group</th>
                                                        <th className="px-6 py-4 text-right">Pace</th>
                                                        <th className="px-6 py-4 text-right">Watts</th>
                                                        <th className="px-6 py-4 text-right">Dist</th>
                                                        <th className="px-6 py-4 text-right">Rate</th>
                                                        <th className="px-6 py-4 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-neutral-800">
                                                    {participants.length === 0 ? (
                                                        <tr><td colSpan={7} className="px-6 py-12 text-center text-neutral-500">Waiting for rowers...</td></tr>
                                                    ) : (
                                                        participants.sort((a, b) => (b.data?.distance || 0) - (a.data?.distance || 0)).map(p => (
                                                            <tr key={p.id} className="hover:bg-neutral-800/30">
                                                                <td className="px-6 py-4 font-medium text-white">{p.display_name} <span className="text-xs text-neutral-600 block">PM5</span></td>
                                                                <td className="px-6 py-4 text-sm text-neutral-400">{p.group_name || '-'}</td>
                                                                <td className="px-6 py-4 text-right font-mono text-white text-lg">{p.data?.pace_per_500m ? `${Math.floor(p.data.pace_per_500m / 60)}:${Math.floor(p.data.pace_per_500m % 60).toString().padStart(2, '0')}` : '--:--'}</td>
                                                                <td className="px-6 py-4 text-right text-yellow-400 font-mono text-lg">{Math.round(p.data?.watts || 0)}</td>
                                                                <td className="px-6 py-4 text-right font-mono text-white">{Math.round(p.data?.distance || 0)}m</td>
                                                                <td className="px-6 py-4 text-right font-mono text-emerald-400">{p.data?.stroke_rate || '--'}</td>
                                                                <td className="px-6 py-4 text-right"><button onClick={() => removeParticipant(p.id)} className="text-neutral-600 hover:text-red-400"><UserMinus size={16} /></button></td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    // Board View (Drag and Drop)
                                    <div className="h-[calc(100vh-300px)] flex flex-col">
                                        <div className="flex justify-between items-center mb-4">
                                            <h2 className="text-lg font-bold text-white">Groups</h2>
                                            <button onClick={createGroup} className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm border border-neutral-700">
                                                <Plus size={16} /> Add Group
                                            </button>
                                        </div>

                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCorners}
                                            onDragStart={handleDragStart}
                                            onDragEnd={handleDragEnd}
                                        >
                                            <div className="flex-1 overflow-x-auto pb-4">
                                                <div className="flex gap-4 h-full min-w-max">
                                                    {/* Unassigned Column */}
                                                    <div className="w-80 flex flex-col">
                                                        <DroppableGroup
                                                            id="unassigned"
                                                            title="Unassigned"
                                                            participants={sections.unassigned}
                                                            onRemoveParticipant={removeParticipant}
                                                        />
                                                    </div>

                                                    {/* Groups Columns */}
                                                    {Object.entries(sections.grouped).map(([groupName, groupParticipants]) => (
                                                        <div key={groupName} className="w-80 flex flex-col">
                                                            <DroppableGroup
                                                                id={groupName}
                                                                title={groupName}
                                                                participants={groupParticipants}
                                                                onRemoveParticipant={removeParticipant}
                                                                onDeleteGroup={deleteGroup}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <DragOverlay>
                                                {activeDragId ? (
                                                    <div className="bg-neutral-800 p-3 rounded-lg border border-emerald-500 shadow-xl opacity-90 w-80">
                                                        <div className="font-bold text-white">
                                                            {participants.find(p => p.id === activeDragId)?.display_name}
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </DragOverlay>
                                        </DndContext>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-neutral-900/30 rounded-2xl border border-neutral-800 border-dashed">
                                <Activity size={48} className="text-neutral-700 mb-4" />
                                <h3 className="text-lg font-medium text-neutral-400">Select or create a session</h3>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

