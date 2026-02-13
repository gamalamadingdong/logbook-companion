import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Users, Loader2, AlertTriangle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
  getTeamByInviteCode,
  joinTeamByInviteCode,
} from '../services/coaching/coachingService';
import type { Team } from '../services/coaching/types';

export function JoinTeam() {
  const { code: urlCode } = useParams<{ code?: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [inviteCode, setInviteCode] = useState(urlCode ?? '');
  const [step, setStep] = useState<'enter' | 'preview' | 'success'>('enter');
  const [team, setTeam] = useState<Team | null>(null);
  const [isLooking, setIsLooking] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-lookup if code came from URL
  useEffect(() => {
    if (urlCode && urlCode.length >= 6) {
      handleLookup(urlCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCode]);

  const handleLookup = async (code?: string) => {
    const c = (code ?? inviteCode).toUpperCase().trim();
    if (c.length < 6) {
      setError('Invite codes are at least 6 characters.');
      return;
    }

    setError(null);
    setIsLooking(true);

    try {
      const found = await getTeamByInviteCode(c);
      if (!found) {
        setError('No team found with that invite code. Please check and try again.');
        return;
      }
      setTeam(found);
      setInviteCode(c);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to look up team');
    } finally {
      setIsLooking(false);
    }
  };

  const handleJoin = async () => {
    if (!user?.id || !inviteCode) return;

    setError(null);
    setIsJoining(true);

    try {
      await joinTeamByInviteCode(user.id, inviteCode);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join team');
    } finally {
      setIsJoining(false);
    }
  };

  // ── Step 1: Enter Code ──────────────────────────────────────────────────
  if (step === 'enter') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Users className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Join a Team</h1>
            <p className="text-neutral-400">
              Enter the invite code your coach shared with you.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-sm mb-6 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Code Entry Form */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-5">
            <div>
              <label htmlFor="invite-code" className="block text-sm font-medium text-neutral-300 mb-1">
                Invite Code
              </label>
              <input
                id="invite-code"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABCD1234"
                maxLength={12}
                autoComplete="off"
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-center text-xl font-mono tracking-widest placeholder-neutral-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none uppercase"
              />
            </div>

            <button
              onClick={() => handleLookup()}
              disabled={isLooking || inviteCode.trim().length < 6}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isLooking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Looking up...
                </>
              ) : (
                'Find Team'
              )}
            </button>
          </div>

          {/* Back link */}
          <div className="text-center mt-6">
            <button
              onClick={() => navigate('/')}
              className="text-sm text-neutral-500 hover:text-white transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Preview Team + Confirm ──────────────────────────────────────
  if (step === 'preview' && team) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Users className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Join Team</h1>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-sm mb-6 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Team Preview Card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-5">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-indigo-500/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold text-white">{team.name}</h2>
              {team.description && (
                <p className="text-neutral-400 text-sm mt-1">{team.description}</p>
              )}
            </div>

            <div className="border-t border-neutral-800 pt-4 space-y-3">
              <p className="text-neutral-300 text-sm text-center">
                You&apos;ll join as a <span className="text-white font-medium">team member</span>.
                Your coach can change your role later.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('enter');
                  setTeam(null);
                  setError(null);
                }}
                className="flex-1 px-4 py-2.5 border border-neutral-700 text-neutral-300 rounded-lg hover:bg-neutral-800 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleJoin}
                disabled={isJoining}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50 font-medium"
              >
                {isJoining ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  'Join Team'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 3: Success ─────────────────────────────────────────────────────
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Welcome to the team!</h1>
        <p className="text-neutral-400 mb-2">
          You&apos;ve joined <span className="text-white font-medium">{team?.name}</span>.
        </p>
        <p className="text-neutral-500 text-sm mb-8">
          Your coach will be able to see you in the team members list.
          Check your team dashboard to view scores and notes.
        </p>

        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          <button
            onClick={() => navigate('/team')}
            className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors font-medium"
          >
            Go to My Team
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full px-4 py-2.5 border border-neutral-700 text-neutral-300 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
