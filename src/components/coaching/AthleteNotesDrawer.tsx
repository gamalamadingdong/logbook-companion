import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, MessageSquare, Loader2, ExternalLink, Send } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Badge, Button, EmptyState } from '../ui';
import {
  getCoachNotesForAthlete,
  createCoachNote,
  getNotesForAthlete,
  type CoachingAthlete,
  type CoachingAthleteCoachNote,
  type CoachingAthleteNote,
  type CoachingSession,
} from '../../services/coaching/coachingService';

interface AthleteNotesDrawerProps {
  athlete: CoachingAthlete | null;
  teamId: string;
  userId: string;
  onClose: () => void;
  onNoteAdded?: () => void;
}

export function AthleteNotesDrawer({
  athlete,
  teamId,
  userId,
  onClose,
  onNoteAdded,
}: AthleteNotesDrawerProps) {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [coachNotes, setCoachNotes] = useState<CoachingAthleteCoachNote[]>([]);
  const [sessionNotes, setSessionNotes] = useState<(CoachingAthleteNote & { session?: CoachingSession })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [newNoteVisible, setNewNoteVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isOpen = !!athlete;
  const athleteTeamId = athlete?.team_id ?? teamId;

  // Fetch notes when athlete changes
  useEffect(() => {
    if (!athlete) return;
    setIsLoading(true);
    Promise.all([
      getCoachNotesForAthlete(athlete.id, 50),
      getNotesForAthlete(athlete.id, 30),
    ])
      .then(([coach, session]) => {
        setCoachNotes(coach);
        setSessionNotes(session);
      })
      .catch(() => {
        toast.error('Failed to load notes');
      })
      .finally(() => setIsLoading(false));
  }, [athlete?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
      requestAnimationFrame(() => {
        panelRef.current?.focus();
      });
    } else if (previousFocusRef.current instanceof HTMLElement) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Focus trapping
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [],
  );

  const handleAddNote = async () => {
    if (!athlete || !newNote.trim()) return;
    setIsSaving(true);
    try {
      const created = await createCoachNote(athleteTeamId, userId, {
        athlete_id: athlete.id,
        note: newNote.trim(),
        visible_to_athlete: newNoteVisible,
      });
      setCoachNotes((prev) => [created, ...prev]);
      setNewNote('');
      setNewNoteVisible(false);
      toast.success('Note added');
      onNoteAdded?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNoteKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && newNote.trim()) {
      e.preventDefault();
      handleAddNote();
    }
  };

  // Reset form when switching athletes
  useEffect(() => {
    setNewNote('');
    setNewNoteVisible(false);
  }, [athlete?.id]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 animate-in fade-in duration-150"
      aria-hidden="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — right-side drawer on desktop, bottom sheet on mobile */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Notes for ${athlete.name}`}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="
          absolute z-10 bg-surface-card border-l border-border shadow-xl
          flex flex-col focus:outline-none
          inset-y-0 right-0 w-full sm:w-[28rem] md:w-[30rem]
          animate-in slide-in-from-right duration-200
          max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:h-[85vh]
          max-md:rounded-t-2xl max-md:border-t max-md:border-l-0
          max-md:animate-in max-md:slide-in-from-bottom max-md:duration-200
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {athlete.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-content-primary truncate">
                {athlete.name}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {athlete.squad && (
                  <Badge variant="coaching" size="sm">{athlete.squad}</Badge>
                )}
                {athlete.grade && (
                  <Badge variant="default" size="sm">Grade {athlete.grade}</Badge>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close notes panel"
            className="shrink-0 p-1.5 -m-1.5 rounded-lg text-content-muted hover:text-content-primary hover:bg-surface-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Quick-add note form */}
          <div className="p-4 border-b border-border">
            <textarea
              ref={textareaRef}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={handleNoteKeyDown}
              rows={2}
              placeholder="Add a coaching note…"
              className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-lg text-content-primary text-sm placeholder:text-content-faint focus:ring-2 focus:ring-focus focus:border-transparent outline-none resize-none"
            />
            <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
              <label className="flex items-center gap-2 text-xs text-content-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newNoteVisible}
                  onChange={(e) => setNewNoteVisible(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border bg-surface-secondary text-accent-coaching focus:ring-accent-coaching"
                />
                Visible to athlete
              </label>
              <Button
                variant="coaching"
                size="sm"
                icon={<Send className="w-3.5 h-3.5" />}
                onClick={handleAddNote}
                loading={isSaving}
                disabled={!newNote.trim()}
              >
                Add Note
              </Button>
            </div>
            <p className="text-[10px] text-content-faint mt-1.5">
              {navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to save
            </p>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-accent-coaching animate-spin" />
            </div>
          )}

          {/* Coach Notes */}
          {!isLoading && (
            <div className="p-4">
              <h3 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Coach Notes
                {coachNotes.length > 0 && (
                  <span className="text-content-faint font-normal">({coachNotes.length})</span>
                )}
              </h3>

              {coachNotes.length === 0 ? (
                <EmptyState
                  icon={<MessageSquare className="w-6 h-6" />}
                  title="No coach notes yet"
                  description="Add a note above to start tracking observations."
                  className="py-6"
                />
              ) : (
                <div className="space-y-2">
                  {coachNotes.map((note) => (
                    <div key={note.id} className="p-3 bg-surface-secondary rounded-lg border border-border">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-medium text-content-secondary">
                          {note.author_display_name ?? 'Coach'}
                        </span>
                        <span className="text-xs text-content-faint">
                          {format(new Date(note.created_at), 'MMM d, yyyy')}
                        </span>
                        <Badge
                          variant={note.visible_to_athlete ? 'success' : 'muted'}
                          size="sm"
                        >
                          {note.visible_to_athlete ? 'Visible' : 'Coach only'}
                        </Badge>
                      </div>
                      <p className="text-sm text-content-primary whitespace-pre-wrap">{note.note}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Session Notes */}
          {!isLoading && sessionNotes.length > 0 && (
            <div className="p-4 border-t border-border">
              <h3 className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-3">
                Session Notes
                <span className="text-content-faint font-normal ml-1.5">({sessionNotes.length})</span>
              </h3>
              <div className="space-y-2">
                {sessionNotes.map((note) => (
                  <div key={note.id} className="p-3 bg-surface-secondary rounded-lg border border-border">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {note.session && (
                        <Badge
                          variant={
                            note.session.type === 'water' ? 'info' :
                            note.session.type === 'erg' ? 'warning' :
                            note.session.type === 'land' ? 'success' :
                            'default'
                          }
                          size="sm"
                        >
                          {note.session.type.toUpperCase()}
                        </Badge>
                      )}
                      <span className="text-xs text-content-faint">
                        {format(new Date(note.created_at), 'MMM d, yyyy')}
                      </span>
                      {note.session?.focus && (
                        <span className="text-xs text-accent-coaching">· {note.session.focus}</span>
                      )}
                    </div>
                    <p className="text-sm text-content-secondary">{note.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer — link to full detail page */}
        <div className="p-4 border-t border-border shrink-0">
          <button
            onClick={() => {
              onClose();
              navigate(`/team-management/roster/${athlete.id}`);
            }}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-accent-coaching-text hover:bg-accent-coaching-surface rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View Full Profile
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
