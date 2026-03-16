import { useState, useEffect, useCallback } from 'react';
import { Shield, CheckCircle, XCircle, Loader2, Clock, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';

interface CoachingRequest {
  id: string;
  user_id: string;
  display_name: string;
  message: string | null;
  status: string;
  created_at: string;
}

export function PendingCoachingRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<CoachingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [canReview, setCanReview] = useState(false);

  const fetchRequests = useCallback(async () => {
    if (!user?.id) {
      setCanReview(false);
      setLoading(false);
      return;
    }

    const { data: reviewerMembership, error: reviewerError } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', user.id)
      .in('role', ['owner', 'admin'])
      .limit(1)
      .maybeSingle();

    if (reviewerError) {
      setError('Failed to load requests.');
      setCanReview(false);
      setLoading(false);
      return;
    }

    if (!reviewerMembership) {
      setCanReview(false);
      setLoading(false);
      return;
    }

    setCanReview(true);
    setError(null);
    const query = supabase
      .from('coaching_access_requests')
      .select('id, user_id, display_name, message, status, created_at')
      .order('created_at', { ascending: false });

    if (!showAll) query.eq('status', 'pending');

    const { data, error: fetchErr } = await query;
    if (fetchErr) {
      setError('Failed to load requests.');
    } else {
      setRequests(data || []);
    }
    setLoading(false);
  }, [showAll, user?.id]);

  useEffect(() => { void fetchRequests(); }, [fetchRequests]);

  const handleAction = async (requestId: string, newStatus: 'approved' | 'rejected') => {
    setActing(requestId);
    setError(null);

    const { error: rpcErr } = await supabase.rpc('approve_coaching_request', {
      request_id: requestId,
      new_status: newStatus,
    });

    if (rpcErr) {
      setError(rpcErr.message || 'Failed to update request.');
    } else {
      await fetchRequests();
    }
    setActing(null);
  };

  if (!loading && !canReview) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-surface-primary border border-border-primary rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={18} className="text-indigo-400" />
          <h3 className="text-base font-semibold text-text-primary">Coaching Requests</h3>
        </div>
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-text-tertiary" size={24} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-primary border border-border-primary rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-indigo-400" />
          <h3 className="text-base font-semibold text-text-primary">Coaching Requests</h3>
          {requests.filter(r => r.status === 'pending').length > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/10 text-amber-400">
              {requests.filter(r => r.status === 'pending').length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAll(prev => !prev)}
            className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
          >
            {showAll ? 'Pending only' : 'Show all'}
          </button>
          <button
            onClick={fetchRequests}
            className="p-1.5 rounded-md hover:bg-surface-secondary transition-colors"
            aria-label="Refresh requests"
          >
            <RefreshCw size={14} className="text-text-tertiary" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      {requests.length === 0 ? (
        <p className="text-sm text-text-tertiary text-center py-6">
          {showAll ? 'No coaching requests yet.' : 'No pending requests.'}
        </p>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div
              key={req.id}
              className="flex items-start gap-4 p-4 rounded-xl bg-surface-secondary border border-border-primary"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-text-primary truncate">
                    {req.display_name}
                  </span>
                  {req.status === 'pending' && (
                    <span className="flex items-center gap-1 text-xs text-amber-400">
                      <Clock size={12} /> Pending
                    </span>
                  )}
                  {req.status === 'approved' && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <CheckCircle size={12} /> Approved
                    </span>
                  )}
                  {req.status === 'rejected' && (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <XCircle size={12} /> Rejected
                    </span>
                  )}
                </div>
                {req.message && (
                  <p className="text-xs text-text-secondary line-clamp-2">{req.message}</p>
                )}
                <p className="text-xs text-text-tertiary mt-1">
                  {new Date(req.created_at).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </p>
              </div>

              {req.status === 'pending' && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleAction(req.id, 'approved')}
                    disabled={acting === req.id}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors"
                    aria-label={`Approve ${req.display_name}`}
                  >
                    {acting === req.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <CheckCircle size={14} />
                    )}
                    Approve
                  </button>
                  <button
                    onClick={() => handleAction(req.id, 'rejected')}
                    disabled={acting === req.id}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-primary border border-border-primary hover:bg-red-500/10 hover:border-red-500/30 text-text-secondary hover:text-red-400 disabled:opacity-50 transition-colors"
                    aria-label={`Reject ${req.display_name}`}
                  >
                    <XCircle size={14} />
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
