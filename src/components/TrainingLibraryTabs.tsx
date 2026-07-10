import React from 'react';
import { Dumbbell, Waves } from 'lucide-react';
import { Link } from 'react-router-dom';

type TrainingLibraryMode = 'rowing' | 'strength-mobility';

interface TrainingLibraryTabsProps {
    activeMode: TrainingLibraryMode;
}

const tabClassName = (active: boolean) => [
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card',
    active
        ? 'bg-surface-card text-content-primary shadow-sm'
        : 'text-content-muted hover:text-content-primary',
].join(' ');

export const TrainingLibraryTabs: React.FC<TrainingLibraryTabsProps> = ({ activeMode }) => (
    <nav
        aria-label="Training library sections"
        className="inline-flex w-full rounded-lg border border-border bg-surface-secondary p-1 sm:w-auto"
    >
        <Link
            to="/library"
            aria-current={activeMode === 'rowing' ? 'page' : undefined}
            className={tabClassName(activeMode === 'rowing')}
        >
            <Waves size={16} />
            Rowing Workouts
        </Link>
        <Link
            to="/library/strength-mobility"
            aria-current={activeMode === 'strength-mobility' ? 'page' : undefined}
            className={tabClassName(activeMode === 'strength-mobility')}
        >
            <Dumbbell size={16} />
            Strength & Mobility
        </Link>
    </nav>
);
