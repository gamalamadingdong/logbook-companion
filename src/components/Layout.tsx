import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LogOut, Menu, X, Waves, Home, TrendingUp, Database, Link as LinkIcon, Settings, MessageSquare, Dumbbell, BookOpen, Users } from 'lucide-react';
import { FeedbackModal } from './FeedbackModal';
import { ReconnectPrompt } from './ReconnectPrompt';
import { supabase } from '../services/supabase';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { logout, profile, user, isCoach, isAdmin } = useAuth();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const [newFeedbackCount, setNewFeedbackCount] = useState(0);

    // Fetch new feedback count for admin
    useEffect(() => {
        if (isAdmin) {
            const fetchNewFeedbackCount = async () => {
                const { count, error } = await supabase
                    .from('user_feedback')
                    .select('id', { count: 'exact' })
                    .limit(0)
                    .eq('status', 'new');

                if (!error && count !== null) {
                    setNewFeedbackCount(count);
                }
            };

            fetchNewFeedbackCount();

            // Poll every 30 seconds for new feedback
            const interval = setInterval(fetchNewFeedbackCount, 30000);
            return () => clearInterval(interval);
        }
    }, [isAdmin]);

    const links = [
        { path: '/', label: 'Log Dashboard', icon: Home },
        { path: '/analytics', label: 'Analysis', icon: TrendingUp },
        { path: '/sync', label: 'Sync Data', icon: Database },
        { path: '/templates', label: 'Library', icon: Dumbbell },
        { path: '/preferences', label: 'Settings', icon: Settings },
        ...(isCoach ? [
            { path: '/coaching', label: 'Coaching', icon: Users },
        ] : []),
        { path: '/docs', label: 'Documentation', icon: BookOpen },
        ...(isAdmin ? [
            { path: '/feedback', label: 'Feedback', icon: MessageSquare }
        ] : [])
    ];

    const isLinkActive = (path: string) => {
        if (path === '/') {
            return location.pathname === '/';
        }
        return location.pathname.startsWith(path);
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col md:flex-row">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-64 bg-neutral-900 border-r border-neutral-800 flex-col h-screen fixed left-0 top-0 z-50">
                <div className="p-6 border-b border-neutral-800">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                            <Waves size={24} />
                        </div>
                        <h1 className="text-xl font-bold tracking-tight">Logbook<br /><span className="text-neutral-500 font-medium">Companion</span></h1>
                    </div>
                </div>

                <div className="px-6 pt-6 pb-2">
                    {user ? (
                        <>
                            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Athlete</div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-900/30 text-emerald-500 flex items-center justify-center font-bold text-lg border border-emerald-500/20">
                                    {(profile?.display_name || user?.email || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div className="overflow-hidden">
                                    <div className="text-sm font-medium text-white truncate">
                                        {profile?.display_name || user?.email?.split('@')[0] || 'User'}
                                    </div>
                                    <Link to="/preferences" className="text-xs text-neutral-500 hover:text-emerald-400 block truncate transition-colors">
                                        Edit Profile
                                    </Link>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="p-3 bg-neutral-800/50 rounded-lg border border-neutral-700/50">
                            <p className="text-sm text-neutral-400 mb-2">Welcome, Guest!</p>
                            <Link to="/login" className="block w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold text-center rounded transition-colors">
                                Log In / Sign Up
                            </Link>
                        </div>
                    )}
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {links.map(link => {
                        const Icon = link.icon;
                        const isActive = isLinkActive(link.path);
                        return (
                            <Link
                                key={link.path}
                                to={link.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
                                    ? 'bg-neutral-800 text-white font-medium shadow-sm'
                                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
                                    }`}
                            >
                                <Icon size={20} className={isActive ? 'text-indigo-400' : ''} />
                                <span className="flex-1">{link.label}</span>
                                {link.path === '/feedback' && newFeedbackCount > 0 && (
                                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                        {newFeedbackCount}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-neutral-800 space-y-2">
                    {user && !localStorage.getItem('concept2_token') && (
                        <button
                            onClick={() => {
                                const client_id = import.meta.env.VITE_CONCEPT2_CLIENT_ID;
                                const redirect_uri = `${window.location.origin}/callback`;
                                const scope = 'user:read,results:read';
                                window.location.href = `https://log.concept2.com/oauth/authorize?client_id=${client_id}&scope=${scope}&response_type=code&redirect_uri=${redirect_uri}`;
                            }}
                            className="flex items-center gap-3 px-4 py-3 w-full text-left text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-all"
                        >
                            <LinkIcon size={20} />
                            Connect Logbook
                        </button>
                    )}
                    {user ? (
                        <button
                            onClick={() => logout()}
                            className="flex items-center gap-3 px-4 py-3 w-full text-left text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        >
                            <LogOut size={20} />
                            Sign Out
                        </button>
                    ) : (
                        <Link
                            to="/login"
                            className="flex items-center gap-3 px-4 py-3 w-full text-left text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-all"
                        >
                            <LogOut size={20} className="rotate-180" /> {/* Flip icon for Login */}
                            Sign In
                        </Link>
                    )}

                    <div className="pt-4 mt-2 border-t border-neutral-800 text-[10px] text-neutral-600 text-center">
                        <p>© 2026 Sam Gammon</p>
                        <a href="/LICENSE" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-500 transition-colors">
                            MIT Licensed
                        </a>
                    </div>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden flex items-center justify-between p-4 bg-neutral-900 border-b border-neutral-800 sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-900/30 text-emerald-500 flex items-center justify-center font-bold text-sm border border-emerald-500/20">
                        {(profile?.display_name || user?.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-lg truncate max-w-[200px]">
                        {profile?.display_name || 'Logbook Companion'}
                    </span>
                </div>
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="p-2 text-neutral-400 hover:text-white"
                >
                    {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div className="md:hidden fixed inset-0 z-40 bg-neutral-950/95 pt-20 px-6 backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-200">
                    <nav className="space-y-4">
                        {links.map(link => {
                            const Icon = link.icon;
                            return (
                                <Link
                                    key={link.path}
                                    to={link.path}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`flex items-center gap-4 px-4 py-4 rounded-xl text-lg ${isLinkActive(link.path)
                                        ? 'bg-neutral-800 text-white font-bold'
                                        : 'text-neutral-400'
                                        }`}
                                >
                                    <Icon size={24} />
                                    {link.label}
                                </Link>
                            );
                        })}
                        <button
                            onClick={() => {
                                setMobileMenuOpen(false);
                                logout();
                            }}
                            className="flex items-center gap-4 px-4 py-4 w-full text-left text-red-400 text-lg border-t border-neutral-800 mt-4"
                        >
                            <LogOut size={24} />
                            Sign Out
                        </button>
                    </nav>
                </div>
            )}

            {/* Main Content Area */}
            <main className="flex-1 md:ml-64 min-h-screen">
                {children}
            </main>

            {/* Floating Feedback Button */}
            <button
                onClick={() => setFeedbackOpen(true)}
                className="fixed bottom-6 right-6 z-40 bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-full shadow-2xl transition-all hover:scale-110 flex items-center gap-2 group"
                title="Send Feedback"
            >
                <MessageSquare size={24} />
                <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap">
                    Feedback
                </span>
            </button>

            {/* Feedback Modal */}
            <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

            {/* Concept2 Reconnection Prompt */}
            <ReconnectPrompt />
        </div>
    );
};
