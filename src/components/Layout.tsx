import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LayoutDashboard, LogOut, Menu, X, Waves, Home, TrendingUp, Database } from 'lucide-react';
import { useState } from 'react';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { logout } = useAuth();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const links = [
        { path: '/', label: 'Dashboard', icon: Home },
        { path: '/analytics', label: 'Analytics', icon: TrendingUp },
        { path: '/sync', label: 'Sync & Data', icon: Database },
    ];

    return (
        <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col md:flex-row">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-64 bg-neutral-900 border-r border-neutral-800 flex-col h-screen fixed left-0 top-0 z-50">
                <div className="p-6 border-b border-neutral-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                            <Waves size={24} />
                        </div>
                        <h1 className="text-xl font-bold tracking-tight">Logbook<br /><span className="text-neutral-500 font-medium">Analyzer</span></h1>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {links.map(link => {
                        const Icon = link.icon;
                        const isActive = location.pathname === link.path;
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
                                {link.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-neutral-800">
                    <button
                        onClick={() => logout()}
                        className="flex items-center gap-3 px-4 py-3 w-full text-left text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                        <LogOut size={20} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden flex items-center justify-between p-4 bg-neutral-900 border-b border-neutral-800 sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                        <Waves size={20} />
                    </div>
                    <span className="font-bold text-lg">Logbook Analyzer</span>
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
                                    className={`flex items-center gap-4 px-4 py-4 rounded-xl text-lg ${location.pathname === link.path
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
        </div>
    );
};
