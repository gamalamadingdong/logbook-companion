import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { createTeam } from '../../services/coaching/coachingService';

export function TeamSetup() {
  const { userId, refreshTeam, hasTeam } = useCoachingContext();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !name.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await createTeam(userId, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      await refreshTeam();
      navigate('/team-management');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Back link when user already has a team */}
        {hasTeam && (
          <button
            onClick={() => navigate('/team-management')}
            className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Team Management
          </button>
        )}
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-500/10 flex items-center justify-center">
            <Users className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {hasTeam ? 'Create Another Team' : 'Create Your Team'}
          </h1>
          <p className="text-neutral-400">
            {hasTeam
              ? 'Add a new team to manage separately.'
              : 'Set up your team to start managing athletes, schedules, and erg scores.'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-sm mb-6 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleCreate} className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-5">
          <div>
            <label htmlFor="team-name" className="block text-sm font-medium text-neutral-300 mb-1">
              Team Name *
            </label>
            <input
              id="team-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={3}
              maxLength={100}
              placeholder="e.g. Varsity Men's 8+"
              className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
            <p className="text-neutral-500 text-xs mt-1">3–100 characters</p>
          </div>

          <div>
            <label htmlFor="team-description" className="block text-sm font-medium text-neutral-300 mb-1">
              Description
            </label>
            <textarea
              id="team-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional — a short description of your team"
              className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || name.trim().length < 3}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating…
              </>
            ) : (
              'Create Team'
            )}
          </button>

          <p className="text-neutral-500 text-xs text-center">
            An invite code will be generated automatically. You can share it with team members later.
          </p>
        </form>
      </div>
    </div>
  );
}
