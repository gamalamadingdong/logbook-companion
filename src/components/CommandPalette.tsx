// Global search / command palette triggered by Cmd+K or Ctrl+K
import React from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
    Home,
    TrendingUp,
    Database,
    Library,
    Settings,
    BookOpen,
    Users,
    FilePlus,
    Link as LinkIcon,
    Dumbbell,
    Search,
} from 'lucide-react';

interface CommandPaletteProps {
    open: boolean;
    onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose }) => {
    const navigate = useNavigate();
    const { isCoach } = useAuth();

    const go = (path: string) => {
        onClose();
        navigate(path);
    };

    const connectConcept2 = () => {
        onClose();
        const clientId = import.meta.env.VITE_CONCEPT2_CLIENT_ID;
        const redirectUri = `${window.location.origin}/callback`;
        const scope = 'user:read,results:write';
        window.location.href = `https://log.concept2.com/oauth/authorize?client_id=${clientId}&scope=${scope}&response_type=code&redirect_uri=${redirectUri}`;
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100]">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 animate-in fade-in duration-150"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="relative flex items-start justify-center pt-[20vh]">
                <Command
                    className="w-full max-w-lg bg-surface-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
                    label="Command palette"
                >
                    {/* Search input */}
                    <div className="flex items-center gap-3 px-4 border-b border-border">
                        <Search size={18} className="text-content-muted shrink-0" />
                        <Command.Input
                            autoFocus
                            placeholder="Search pages and actions…"
                            className="w-full py-3.5 bg-transparent text-base text-content-primary placeholder:text-content-muted outline-none"
                        />
                    </div>

                    {/* Results */}
                    <Command.List className="max-h-72 overflow-y-auto p-2">
                        <Command.Empty className="py-6 text-center text-sm text-content-muted">
                            No results found.
                        </Command.Empty>

                        {/* Pages */}
                        <Command.Group
                            heading="Pages"
                            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-content-muted"
                        >
                            <PaletteItem icon={Home} label="Dashboard" onSelect={() => go('/')} />
                            <PaletteItem icon={TrendingUp} label="Analytics" onSelect={() => go('/analytics')} />
                            <PaletteItem icon={Database} label="Sync Data" onSelect={() => go('/sync')} />
                            <PaletteItem icon={Library} label="Training Library" onSelect={() => go('/library')} />
                            <PaletteItem icon={Dumbbell} label="Strength & Mobility" onSelect={() => go('/library/strength-mobility')} />
                            <PaletteItem icon={Settings} label="Preferences" onSelect={() => go('/preferences')} />
                            <PaletteItem icon={BookOpen} label="Documentation" onSelect={() => go('/docs')} />
                            {isCoach && (
                                <PaletteItem icon={Users} label="Team Management" onSelect={() => go('/team-management')} />
                            )}
                        </Command.Group>

                        {/* Actions */}
                        <Command.Group
                            heading="Actions"
                            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-content-muted"
                        >
                            <PaletteItem icon={FilePlus} label="Propose Workout" onSelect={() => go('/library/propose')} />
                            <PaletteItem icon={LinkIcon} label="Connect Concept2" onSelect={connectConcept2} />
                        </Command.Group>
                    </Command.List>
                </Command>
            </div>
        </div>
    );
};

/* Single item row */
interface PaletteItemProps {
    icon: React.FC<{ size?: number; className?: string }>;
    label: string;
    onSelect: () => void;
}

const PaletteItem: React.FC<PaletteItemProps> = ({ icon: Icon, label, onSelect }) => (
    <Command.Item
        onSelect={onSelect}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-content-secondary cursor-pointer select-none data-[selected=true]:bg-surface-secondary data-[selected=true]:text-content-primary transition-colors"
    >
        <Icon size={16} className="shrink-0" />
        <span>{label}</span>
    </Command.Item>
);
