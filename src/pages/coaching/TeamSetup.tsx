import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Loader2, AlertTriangle, ArrowLeft, Building2 } from 'lucide-react';
import { useCoachingContext } from '../../hooks/useCoachingContext';
import { createTeam, getOrganizationsForUser, assignTeamToOrg, createOrganization } from '../../services/coaching/coachingService';
import type { Organization } from '../../services/coaching/types';

export function TeamSetup() {
  const { userId, refreshTeam, hasTeam } = useCoachingContext();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Organization selection
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('none');
  const [showNewOrg, setShowNewOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDescription, setNewOrgDescription] = useState('');

  useEffect(() => {
    if (!userId) return;
    getOrganizationsForUser(userId).then(setOrgs).catch(() => {});
  }, [userId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !name.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Determine org assignment
      let orgId: string | null = null;

      if (selectedOrgId === 'new' && newOrgName.trim()) {
        // Create the new org first
        const newOrg = await createOrganization(userId, {
          name: newOrgName.trim(),
          description: newOrgDescription.trim() || undefined,
        });
        orgId = newOrg.id;
      } else if (selectedOrgId !== 'none') {
        orgId = selectedOrgId;
      }

      const team = await createTeam(userId, {
        name: name.trim(),
        description: description.trim() || undefined,
      });

      // Assign to org if selected
      if (orgId) {
        await assignTeamToOrg(team.id, orgId);
      }

      await refreshTeam();
      navigate('/team-management');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 sm:p-6">
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
        <form onSubmit={handleCreate} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-5 sm:p-6">
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

          {/* Organization selection */}
          <div>
            <label htmlFor="team-org" className="block text-sm font-medium text-neutral-300 mb-1">
              <Building2 className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              Organization
            </label>
            <select
              id="team-org"
              value={selectedOrgId}
              onChange={(e) => {
                setSelectedOrgId(e.target.value);
                setShowNewOrg(e.target.value === 'new');
              }}
              className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            >
              <option value="none">No organization (standalone)</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
              <option value="new">+ Create new organization</option>
            </select>
            <p className="text-neutral-500 text-xs mt-1">
              Group teams under an organization (club, program) for easier management.
            </p>
          </div>

          {/* New org fields */}
          {showNewOrg && (
            <div className="border border-neutral-700 rounded-lg p-4 space-y-3 bg-neutral-800/50">
              <div>
                <label htmlFor="new-org-name" className="block text-sm font-medium text-neutral-300 mb-1">
                  Organization Name *
                </label>
                <input
                  id="new-org-name"
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  required
                  minLength={3}
                  maxLength={100}
                  placeholder="e.g. City Rowing Club"
                  className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label htmlFor="new-org-desc" className="block text-sm font-medium text-neutral-300 mb-1">
                  Organization Description
                </label>
                <input
                  id="new-org-desc"
                  type="text"
                  value={newOrgDescription}
                  onChange={(e) => setNewOrgDescription(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || name.trim().length < 3 || (selectedOrgId === 'new' && newOrgName.trim().length < 3)}
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
