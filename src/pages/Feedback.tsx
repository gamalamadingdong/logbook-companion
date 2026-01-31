import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { MessageSquare, Bug, Lightbulb, MessageCircle, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface FeedbackItem {
    id: string;
    user_id: string;
    feedback_type: 'bug' | 'feature' | 'other';
    message: string;
    status: 'new' | 'reviewed' | 'resolved';
    created_at: string;
    admin_response?: string;
    admin_response_at?: string;
}

interface UserProfile {
    display_name?: string;
    email?: string;
}

export const Feedback: React.FC = () => {
    const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
    const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'new' | 'reviewed' | 'resolved'>('all');

    useEffect(() => {
        fetchFeedback();
    }, []);

    const fetchFeedback = async () => {
        try {
            const { data, error } = await supabase
                .from('user_feedback')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            setFeedback(data || []);

            // Fetch user profiles for all unique user_ids
            const userIds = [...new Set(data?.map(f => f.user_id) || [])];
            const profiles: Record<string, UserProfile> = {};

            // Query profiles table for user information
            if (userIds.length > 0) {
                const { data: profileData, error: profileError } = await supabase
                    .from('user_profiles')
                    .select('user_id, display_name, email')
                    .in('user_id', userIds);

                if (profileError) {
                    console.error('Failed to fetch user profiles:', profileError);
                } else if (profileData) {
                    profileData.forEach(profile => {
                        profiles[profile.user_id] = {
                            display_name: profile.display_name,
                            email: profile.email
                        };
                    });
                }
            }

            setUserProfiles(profiles);
        } catch (error) {
            console.error('Failed to fetch feedback:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (id: string, newStatus: 'new' | 'reviewed' | 'resolved') => {
        try {
            const { error } = await supabase
                .from('user_feedback')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;

            setFeedback(prev => prev.map(f => f.id === id ? { ...f, status: newStatus } : f));
        } catch (error) {
            console.error('Failed to update status:', error);
        }
    };

    const updateResponse = async (id: string, response: string) => {
        try {
            const { error } = await supabase
                .from('user_feedback')
                .update({
                    admin_response: response,
                    admin_response_at: new Date().toISOString(),
                    status: 'reviewed' // Auto-mark as reviewed if replied
                })
                .eq('id', id);

            if (error) throw error;

            setFeedback(prev => prev.map(f => f.id === id ? {
                ...f,
                admin_response: response,
                admin_response_at: new Date().toISOString(),
                status: 'reviewed'
            } : f));
            setReplyingTo(null);
        } catch (error) {
            console.error('Failed to save response:', error);
            alert('Failed to save response');
        }
    };

    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');

    const filteredFeedback = filter === 'all'
        ? feedback
        : feedback.filter(f => f.status === filter);

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'bug': return <Bug size={18} className="text-red-400" />;
            case 'feature': return <Lightbulb size={18} className="text-blue-400" />;
            default: return <MessageCircle size={18} className="text-neutral-400" />;
        }
    };

    const getStatusBadge = (status: string) => {
        const styles = {
            new: 'bg-red-500/10 text-red-400 border-red-500/30',
            reviewed: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
            resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
        };
        const icons = {
            new: <AlertCircle size={14} />,
            reviewed: <Clock size={14} />,
            resolved: <CheckCircle size={14} />
        };
        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${styles[status as keyof typeof styles]}`}>
                {icons[status as keyof typeof icons]}
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-950 p-8">
                <div className="text-neutral-400">Loading feedback...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950 p-6 md:p-12">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-2">User Feedback</h1>
                        <p className="text-neutral-400">Manage feature requests and bug reports</p>
                    </div>
                    <div className="text-sm text-neutral-500">
                        Total: <span className="text-white font-medium">{feedback.length}</span>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {['all', 'new', 'reviewed', 'resolved'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilter(status as any)}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${filter === status
                                ? 'bg-emerald-600 text-white'
                                : 'bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700'
                                }`}
                        >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                            <span className="ml-2 text-xs opacity-70">
                                ({status === 'all' ? feedback.length : feedback.filter(f => f.status === status).length})
                            </span>
                        </button>
                    ))}
                </div>

                {/* Feedback List */}
                <div className="space-y-4">
                    {filteredFeedback.length === 0 ? (
                        <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-12 text-center">
                            <MessageSquare size={48} className="mx-auto mb-4 text-neutral-600" />
                            <p className="text-neutral-500">No feedback found</p>
                        </div>
                    ) : (
                        filteredFeedback.map(item => (
                            <div key={item.id} className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 hover:border-neutral-700 transition-colors">
                                <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-neutral-800 rounded-lg">
                                            {getTypeIcon(item.feedback_type)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-white capitalize">
                                                    {item.feedback_type === 'feature' ? 'Feature Request' : item.feedback_type}
                                                </span>
                                                {getStatusBadge(item.status)}
                                            </div>
                                            <div className="text-sm text-neutral-500">
                                                From: {userProfiles[item.user_id]?.display_name || userProfiles[item.user_id]?.email || 'Unknown User'}
                                            </div>
                                            <div className="text-xs text-neutral-600 mt-1">
                                                {new Date(item.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <p className="text-neutral-300 mb-4 whitespace-pre-wrap">{item.message}</p>



                                {
                                    item.admin_response && (
                                        <div className="mt-4 bg-emerald-900/10 border border-emerald-900/30 rounded-xl p-4 ml-8">
                                            <div className="flex items-center gap-2 mb-2 text-xs text-emerald-400 font-medium">
                                                <CheckCircle size={12} />
                                                Admin Response • {new Date(item.admin_response_at!).toLocaleString()}
                                            </div>
                                            <p className="text-emerald-100 text-sm">{item.admin_response}</p>
                                        </div>
                                    )
                                }

                                {replyingTo === item.id ? (
                                    <div className="mt-4 ml-8">
                                        <textarea
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            placeholder="Write a response..."
                                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 min-h-[100px]"
                                            autoFocus
                                        />
                                        <div className="flex justify-end gap-2 mt-2">
                                            <button
                                                onClick={() => setReplyingTo(null)}
                                                className="px-3 py-1.5 text-neutral-400 text-xs hover:text-white transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => updateResponse(item.id, replyText)}
                                                disabled={!replyText.trim()}
                                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                                            >
                                                Save Response
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-2 mt-4 pt-4 border-t border-neutral-800/50">
                                        <button
                                            onClick={() => updateStatus(item.id, 'new')}
                                            disabled={item.status === 'new'}
                                            className="px-3 py-1.5 bg-neutral-800 hover:bg-red-500/20 text-red-400 text-sm rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            New
                                        </button>
                                        <button
                                            onClick={() => updateStatus(item.id, 'reviewed')}
                                            disabled={item.status === 'reviewed'}
                                            className="px-3 py-1.5 bg-neutral-800 hover:bg-yellow-500/20 text-yellow-400 text-sm rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            Reviewed
                                        </button>
                                        <button
                                            onClick={() => updateStatus(item.id, 'resolved')}
                                            disabled={item.status === 'resolved'}
                                            className="px-3 py-1.5 bg-neutral-800 hover:bg-emerald-500/20 text-emerald-400 text-sm rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            Resolved
                                        </button>
                                        <div className="flex-1"></div>
                                        <button
                                            onClick={() => {
                                                setReplyingTo(item.id);
                                                setReplyText(item.admin_response || '');
                                            }}
                                            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm rounded-lg transition-colors"
                                        >
                                            {item.admin_response ? 'Edit Response' : 'Reply'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div >
    );
};
