import { useState, useCallback } from 'react';
import { X, UserPlus, Loader2, CheckCircle2, AlertCircle, Mail, Plus, Trash2 } from 'lucide-react';
import { inviteCoaches, type InviteCoachResult } from '../../services/coaching/coachingService';
import { toast } from 'sonner';

interface BulkCoachInviteModalProps {
  teamId: string;
  teamName: string;
  orgId?: string | null;
  orgName?: string | null;
  onClose: () => void;
  onInvited: () => void;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InviteEntry {
  firstName: string;
  lastName: string;
  email: string;
}

const emptyEntry = (): InviteEntry => ({ firstName: '', lastName: '', email: '' });

export function BulkCoachInviteModal({
  teamId,
  teamName,
  orgId,
  orgName,
  onClose,
  onInvited,
}: BulkCoachInviteModalProps) {
  const [entries, setEntries] = useState<InviteEntry[]>([emptyEntry(), emptyEntry(), emptyEntry()]);
  const [role, setRole] = useState<'coach' | 'coxswain'>('coach');
  const [step, setStep] = useState<'input' | 'sending' | 'results'>('input');
  const [results, setResults] = useState<InviteCoachResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const updateEntry = (idx: number, field: keyof InviteEntry, value: string) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  };

  const addRow = () => setEntries((prev) => [...prev, emptyEntry()]);

  const removeRow = (idx: number) => {
    if (entries.length <= 1) return;
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const validEntries = entries.filter((e) => emailPattern.test(e.email.trim()));
  const filledCount = entries.filter((e) => e.email.trim().length > 0).length;
  const invalidCount = filledCount - validEntries.length;

  const handleSend = useCallback(async () => {
    if (validEntries.length === 0) return;

    setError(null);
    setStep('sending');

    try {
      const response = await inviteCoaches({
        teamId,
        entries: validEntries.map((e) => ({
          email: e.email.trim().toLowerCase(),
          firstName: e.firstName.trim(),
          lastName: e.lastName.trim(),
        })),
        role,
        orgId: orgId ?? undefined,
      });

      setResults(response.results);
      setStep('results');

      const { created, added, errors } = response.summary;
      if (errors === 0) {
        toast.success(`${created + added} coach${created + added !== 1 ? 'es' : ''} processed successfully`);
      } else {
        toast.warning(`${created + added} succeeded, ${errors} failed`);
      }

      if (created + added > 0) {
        onInvited();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invites');
      setStep('input');
    }
  }, [validEntries, teamId, role, orgId, onInvited]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-card border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-coaching/10 rounded-lg">
              <UserPlus className="w-5 h-5 text-accent-coaching" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-content-primary">Invite Coaches</h2>
              <p className="text-xs text-content-muted">{teamName}{orgName ? ` · ${orgName}` : ''}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-content-muted hover:text-content-primary rounded-lg hover:bg-surface-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {step === 'input' && (
            <>
              {/* Info banner */}
              <div className="flex gap-2 p-3 bg-accent-coaching/5 border border-accent-coaching/20 rounded-lg text-sm text-content-secondary">
                <Mail className="w-4 h-4 mt-0.5 shrink-0 text-accent-coaching" />
                <p>
                  Each coach will receive an <strong>invite email</strong> with a link to set their password and join the team.
                </p>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[1fr_1fr_1.5fr_2rem] gap-2 px-1">
                <label className="text-xs font-medium text-content-muted uppercase tracking-wider">First Name</label>
                <label className="text-xs font-medium text-content-muted uppercase tracking-wider">Last Name</label>
                <label className="text-xs font-medium text-content-muted uppercase tracking-wider">Email *</label>
                <span />
              </div>

              {/* Entry rows */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {entries.map((entry, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_1.5fr_2rem] gap-2 items-center">
                    <input
                      type="text"
                      value={entry.firstName}
                      onChange={(e) => updateEntry(idx, 'firstName', e.target.value)}
                      placeholder="Jane"
                      className="px-2.5 py-2 bg-surface-secondary border border-border rounded-lg text-content-primary placeholder-content-muted text-sm focus:ring-2 focus:ring-accent-coaching/40 focus:border-accent-coaching outline-none"
                    />
                    <input
                      type="text"
                      value={entry.lastName}
                      onChange={(e) => updateEntry(idx, 'lastName', e.target.value)}
                      placeholder="Smith"
                      className="px-2.5 py-2 bg-surface-secondary border border-border rounded-lg text-content-primary placeholder-content-muted text-sm focus:ring-2 focus:ring-accent-coaching/40 focus:border-accent-coaching outline-none"
                    />
                    <input
                      type="email"
                      value={entry.email}
                      onChange={(e) => updateEntry(idx, 'email', e.target.value)}
                      placeholder="coach@school.edu"
                      className={`px-2.5 py-2 bg-surface-secondary border rounded-lg text-content-primary placeholder-content-muted text-sm focus:ring-2 focus:ring-accent-coaching/40 focus:border-accent-coaching outline-none ${
                        entry.email.trim() && !emailPattern.test(entry.email.trim())
                          ? 'border-red-500/50'
                          : 'border-border'
                      }`}
                    />
                    <button
                      onClick={() => removeRow(idx)}
                      disabled={entries.length <= 1}
                      className="p-1 text-content-muted hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Remove row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add row button */}
              <button
                onClick={addRow}
                className="flex items-center gap-1.5 text-sm text-accent-coaching hover:text-accent-coaching-hover transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add another
              </button>

              {/* Validation feedback */}
              {filledCount > 0 && (
                <div className="space-y-1.5 text-sm">
                  {validEntries.length > 0 && (
                    <p className="text-emerald-400">
                      ✓ {validEntries.length} valid email{validEntries.length !== 1 ? 's' : ''}
                    </p>
                  )}
                  {invalidCount > 0 && (
                    <p className="text-red-400">
                      ✗ {invalidCount} invalid email{invalidCount !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}

              {/* Role selector */}
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1">
                  Role
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRole('coach')}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      role === 'coach'
                        ? 'bg-accent-coaching/10 border-accent-coaching text-accent-coaching'
                        : 'border-border text-content-muted hover:text-content-secondary hover:bg-surface-secondary'
                    }`}
                  >
                    Coach
                  </button>
                  <button
                    onClick={() => setRole('coxswain')}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      role === 'coxswain'
                        ? 'bg-accent-coaching/10 border-accent-coaching text-accent-coaching'
                        : 'border-border text-content-muted hover:text-content-secondary hover:bg-surface-secondary'
                    }`}
                  >
                    Coxswain
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex gap-2 p-3 bg-red-900/20 border border-red-800/30 rounded-lg text-sm text-red-400">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
            </>
          )}

          {step === 'sending' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-accent-coaching" />
              <p className="text-content-secondary text-sm">
                Sending {validEntries.length} invite{validEntries.length !== 1 ? 's' : ''}…
              </p>
            </div>
          )}

          {step === 'results' && (
            <div className="space-y-3">
              {/* Summary */}
              {(() => {
                const created = results.filter((r) => r.status === 'created').length;
                const added = results.filter((r) => r.status === 'added').length;
                const errors = results.filter((r) => r.status === 'error').length;
                return (
                  <div className="flex gap-4 p-3 bg-surface-secondary rounded-lg text-sm">
                    {created > 0 && (
                      <span className="text-emerald-400">
                        <UserPlus className="w-3.5 h-3.5 inline mr-1" />
                        {created} invited
                      </span>
                    )}
                    {added > 0 && (
                      <span className="text-blue-400">
                        <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                        {added} added
                      </span>
                    )}
                    {errors > 0 && (
                      <span className="text-red-400">
                        <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
                        {errors} failed
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Per-email results */}
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {results.map((r) => (
                  <div
                    key={r.email}
                    className="flex items-start gap-2 px-3 py-2 bg-surface-secondary rounded-lg text-sm"
                  >
                    {r.status === 'created' && <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />}
                    {r.status === 'added' && <CheckCircle2 className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />}
                    {r.status === 'error' && <AlertCircle className="w-4 h-4 mt-0.5 text-red-400 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-content-primary font-medium truncate">{r.email}</p>
                      {r.message && <p className="text-content-muted text-xs">{r.message}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-border">
          {step === 'input' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-content-muted hover:text-content-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={validEntries.length === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-accent-coaching text-white rounded-lg hover:bg-accent-coaching-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Mail className="w-4 h-4" />
                Invite {validEntries.length > 0 ? validEntries.length : ''} Coach{validEntries.length !== 1 ? 'es' : ''}
              </button>
            </>
          )}

          {step === 'results' && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium bg-accent-coaching text-white rounded-lg hover:bg-accent-coaching-hover transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
