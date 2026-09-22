import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader2, CheckCircle, Clock, Send } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import { Layout } from '../../components/Layout';

type RequestStatus = 'none' | 'pending' | 'approved' | 'rejected';

export function RequestCoachingAccess() {
  const { user, profile, isCoach } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingStatus, setExistingStatus] = useState<RequestStatus>('none');
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  // If already a coach, redirect to team management
  useEffect(() => {
    if (isCoach) navigate('/team-management', { replace: true });
  }, [isCoach, navigate]);

  // Check for existing request
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('coaching_access_requests')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) setExistingStatus(data.status as RequestStatus);
      setLoading(false);
    })();
  }, [user]);

  // Pre-fill name from profile
  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name);
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { error: fnError } = await supabase.functions.invoke('request-coaching-access', {
        body: { displayName: displayName.trim(), message: message.trim() },
      });

      if (fnError) {
        const ctx = (fnError as { context?: Response }).context;
        if (ctx) {
          const payload = await ctx.json();
          throw new Error(payload.error || 'Failed to submit request.');
        }
        throw fnError;
      }

      setSubmitted(true);
      setExistingStatus('pending');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="animate-spin text-neutral-500" size={32} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-lg">
          <div className="bg-surface-primary border border-border-primary rounded-2xl p-4 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-indigo-500/10">
                <Shield size={24} className="text-indigo-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-text-primary">Coaching Access</h1>
                <p className="text-sm text-text-secondary">Request access to coaching tools</p>
              </div>
            </div>

            {/* Pending state */}
            {(existingStatus === 'pending' || submitted) && (
              <div className="text-center py-8 space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Clock size={32} className="text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Request Pending</h2>
                  <p className="text-sm text-text-secondary mt-2">
                    Your request has been submitted. You'll receive coaching access once it's approved.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/')}
                  className="mt-4 min-h-11 px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  ← Back to Dashboard
                </button>
              </div>
            )}

            {/* Approved state (edge case — shouldn't normally show) */}
            {existingStatus === 'approved' && !submitted && (
              <div className="text-center py-8 space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle size={32} className="text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Access Granted</h2>
                  <p className="text-sm text-text-secondary mt-2">
                    You have coaching access. Set up your team to get started.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/team-management/setup')}
                  className="mt-4 min-h-11 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
                >
                  Set Up Team
                </button>
              </div>
            )}

            {/* Form — show for new or rejected requests */}
            {existingStatus !== 'pending' && existingStatus !== 'approved' && !submitted && (
              <>
                {existingStatus === 'rejected' && (
                  <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                    Your previous request was not approved. You can submit a new one below.
                  </div>
                )}

                <p className="text-sm text-text-secondary mb-6">
                  Coaching tools let you manage teams, track athlete progress, assign workouts, and more.
                  Fill out the form below and we'll review your request.
                </p>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="displayName" className="block text-sm font-medium text-text-secondary mb-1.5">
                      Your Name
                    </label>
                    <input
                      id="displayName"
                      type="text"
                      required
                      minLength={2}
                      maxLength={100}
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-surface-secondary border border-border-primary rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors"
                      placeholder="Coach name"
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-text-secondary mb-1.5">
                      What do you plan to use coaching tools for?
                    </label>
                    <textarea
                      id="message"
                      rows={4}
                      maxLength={1000}
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      className="w-full px-4 py-2.5 bg-surface-secondary border border-border-primary rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors resize-none"
                      placeholder="e.g. I coach a high school rowing team and want to track erg scores and assign workouts..."
                    />
                    <div className="text-xs text-text-tertiary mt-1 text-right">{message.length}/1000</div>
                  </div>

                  {error && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || displayName.trim().length < 2}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                  >
                    {submitting ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Send size={18} />
                    )}
                    {submitting ? 'Submitting…' : 'Request Access'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
