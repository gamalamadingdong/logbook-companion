import React, { useState } from 'react';
import { X, MessageSquare, Bug, Lightbulb, MessageCircle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'other'>('feature');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !message.trim()) return;

        setIsSubmitting(true);
        setSubmitStatus('idle');

        try {
            const { error } = await supabase
                .from('user_feedback')
                .insert({
                    user_id: user.id,
                    feedback_type: feedbackType,
                    message: message.trim()
                });

            if (error) throw error;

            setSubmitStatus('success');
            setMessage('');
            setTimeout(() => {
                onClose();
                setSubmitStatus('idle');
            }, 1500);
        } catch (error) {
            console.error('Failed to submit feedback:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const typeOptions = [
        { value: 'feature', label: 'Feature Request', icon: Lightbulb, color: 'text-blue-400' },
        { value: 'bug', label: 'Bug Report', icon: Bug, color: 'text-red-400' },
        { value: 'other', label: 'Other', icon: MessageCircle, color: 'text-neutral-400' }
    ];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-neutral-900 rounded-2xl border border-neutral-800 max-w-lg w-full shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-neutral-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                            <MessageSquare size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-white">Send Feedback</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-neutral-500 hover:text-white transition-colors"
                        disabled={isSubmitting}
                        aria-label="Close feedback modal"
                        title="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Type Selector */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-3">
                            What type of feedback?
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {typeOptions.map(option => {
                                const Icon = option.icon;
                                const isSelected = feedbackType === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setFeedbackType(option.value as any)}
                                        className={`p-4 rounded-xl border-2 transition-all ${isSelected
                                                ? 'border-emerald-500 bg-emerald-500/10'
                                                : 'border-neutral-800 bg-neutral-800/50 hover:border-neutral-700'
                                            }`}
                                    >
                                        <Icon size={20} className={`mx-auto mb-2 ${isSelected ? 'text-emerald-400' : option.color}`} />
                                        <div className={`text-xs font-medium ${isSelected ? 'text-white' : 'text-neutral-400'}`}>
                                            {option.label}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Message */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-2">
                            Your feedback
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Tell us what you think..."
                            rows={6}
                            required
                            disabled={isSubmitting}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none disabled:opacity-50"
                        />
                        <div className="text-xs text-neutral-500 mt-2">
                            {message.length} / 1000 characters
                        </div>
                    </div>

                    {/* Status Messages */}
                    {submitStatus === 'success' && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-emerald-400 text-sm">
                            ✓ Feedback sent! Thank you for helping us improve.
                        </div>
                    )}
                    {submitStatus === 'error' && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
                            Failed to send feedback. Please try again.
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl transition-colors font-medium disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !message.trim()}
                            className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Sending...' : 'Send Feedback'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
