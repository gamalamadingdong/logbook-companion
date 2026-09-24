import { connectConcept2 } from '../services/concept2Auth';
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Blocks, Bluetooth, Bug, LogOut, Waves, Home, TrendingUp, Database, Link as LinkIcon, Settings, MessageSquare, BookOpen, Users, Library, Search, Plus } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { FeedbackModal } from './FeedbackModal';
import { ReconnectPrompt } from './ReconnectPrompt';
import { CommandPalette } from './CommandPalette';
import { MobileBottomNavigation } from './MobileBottomNavigation';
import { AccountSheet, MobileNavigationDrawer } from './MobileNavigationDrawer';
import { PM5ConnectionPill } from './PM5ConnectionPill';
import { supabase } from '../services/supabase';
import { appDiagnosticsEnabled } from '../services/appDiagnostics';

interface LayoutProps {
    children: React.ReactNode;
}

/** Titles shown in the mobile header where the sidebar label reads differently. */
const mobileTitleOverrides: Record<string, string> = {
    '/pm5': 'Train',
};

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { logout, profile, user, isAdmin, isCoach } = useAuth();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [accountSheetOpen, setAccountSheetOpen] = useState(false);
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
    const [newFeedbackCount, setNewFeedbackCount] = useState(0);

    // Close mobile surfaces whenever the route changes, including hardware Back
    // and deep links, so a destination is never rendered beneath an open sheet.
    useEffect(() => {
        setMobileMenuOpen(false);
        setAccountSheetOpen(false);
    }, [location.pathname]);

    // Cmd+K / Ctrl+K to toggle command palette
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            setCommandPaletteOpen(prev => !prev);
        }
    }, []);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

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
        { path: '/completed-workout/new', label: 'Add completed workout', icon: Plus },
        { path: '/pm5', label: 'Connect PM5', icon: Bluetooth },
        { path: '/analytics', label: 'Analysis', icon: TrendingUp },
        { path: '/sync', label: 'Sync Data', icon: Database },
        { path: '/library', label: 'Training Library', icon: Library },
        { path: '/preferences', label: 'Settings', icon: Settings },
        { path: '/team-management', label: 'Team Management', icon: Users },
        { path: '/training-block', label: 'Training Block', icon: Blocks },
        { path: '/docs', label: 'Documentation', icon: BookOpen },
        ...(appDiagnosticsEnabled ? [{ path: '/diagnostics', label: 'Diagnostics', icon: Bug }] : []),
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

    const mobileScreenTitle = (() => {
        if (location.pathname === '/') return 'Logbook Companion';
        const override = Object.keys(mobileTitleOverrides)
            .find(path => location.pathname.startsWith(path));
        if (override) return mobileTitleOverrides[override];
        const match = links.find(link => link.path !== '/' && location.pathname.startsWith(link.path));
        return match?.label ?? 'Logbook Companion';
    })();

    return (
        <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col md:flex-row">
            <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-surface-card focus:text-content-primary focus:rounded-md focus:m-2">
                Skip to content
            </a>
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
                    <button
                        type="button"
                        onClick={() => setCommandPaletteOpen(true)}
                        className="flex items-center gap-3 px-4 py-2.5 w-full text-left text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50 rounded-lg transition-all mb-1 border border-neutral-800 border-dashed"
                    >
                        <Search size={16} />
                        <span className="flex-1 text-sm">Search…</span>
                        <kbd className="hidden lg:inline text-[10px] font-mono bg-neutral-800 text-neutral-500 px-1.5 py-0.5 rounded">⌘K</kbd>
                    </button>
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
                    {user && <NotificationBell variant="sidebar" />}
                    {user && !localStorage.getItem('concept2_token') && (
                        <button
                            type="button"
                            onClick={() => {
                                void connectConcept2();
                            }}
                            className="flex items-center gap-3 px-4 py-3 w-full text-left text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-all"
                        >
                            <LinkIcon size={20} />
                            Connect Logbook
                        </button>
                    )}
                    {user ? (
                        <button
                            type="button"
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
            <div className="md:hidden flex items-center justify-between gap-2 p-4 bg-neutral-900 border-b border-neutral-800 sticky top-0 z-50">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-500 shrink-0">
                        <Waves size={18} />
                    </div>
                    <span className="font-bold text-lg truncate">
                        {mobileScreenTitle}
                    </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {user && <NotificationBell variant="icon" align="right" />}
                    <button
                        type="button"
                        onClick={() => setAccountSheetOpen(true)}
                        aria-haspopup="dialog"
                        aria-expanded={accountSheetOpen}
                        aria-label="Account menu"
                        className="w-9 h-9 rounded-full bg-emerald-900/30 text-emerald-500 flex items-center justify-center font-bold text-sm border border-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-focus"
                    >
                        {(profile?.display_name || user?.email || 'U').charAt(0).toUpperCase()}
                    </button>
                </div>
            </div>

            <MobileNavigationDrawer
                open={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                isCoach={isCoach}
                isAdmin={isAdmin}
            />

            <AccountSheet
                open={accountSheetOpen}
                onClose={() => setAccountSheetOpen(false)}
                displayName={profile?.display_name || user?.email?.split('@')[0] || 'Account'}
                email={user?.email ?? undefined}
                onSignOut={logout}
            />

            {/* Main Content Area */}
            <main id="main-content" className="min-h-screen flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:ml-64 md:pb-0">
                {children}
            </main>

            <PM5ConnectionPill />

            <MobileBottomNavigation
                menuOpen={mobileMenuOpen}
                onMore={() => setMobileMenuOpen(current => !current)}
            />
            {/* Floating Feedback Button */}
            <button
                type="button"
                onClick={() => setFeedbackOpen(true)}
                className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 md:bottom-6 md:right-6 z-40 bg-emerald-600 hover:bg-emerald-500 text-white p-3 md:p-4 rounded-full shadow-2xl transition-all hover:scale-110 flex items-center gap-2 group"
                aria-label="Send Feedback"
                title="Send Feedback"
            >
                <MessageSquare size={20} className="md:w-6 md:h-6" />
                <span className="hidden md:inline max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap">
                    Feedback
                </span>
            </button>

            {/* Feedback Modal */}
            <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

            {/* Concept2 Reconnection Prompt */}
            <ReconnectPrompt />

            {/* Command Palette */}
            <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
        </div>
    );
};
