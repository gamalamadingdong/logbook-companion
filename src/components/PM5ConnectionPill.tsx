import { Link, useLocation } from 'react-router-dom';
import { Activity, Bluetooth } from 'lucide-react';
import { usePM5 } from '../hooks/usePM5';

function formatPace(pace: number): string {
  if (!Number.isFinite(pace) || pace <= 0) return '--:--';
  const totalSeconds = pace / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Persistent monitor state shown above the bottom navigation.
 *
 * Connection is application state, so it stays visible away from the workout
 * screen and offers a way back into a piece already in progress. Hidden on the
 * workout screen itself, where the same information is already primary.
 */
export function PM5ConnectionPill() {
  const { status, connectedDevice, liveData, rowing } = usePM5();
  const location = useLocation();

  if (location.pathname.startsWith('/pm5')) return null;
  if (status !== 'connected' && !rowing) return null;

  const distance = liveData ? `${Math.round(liveData.distance)} m` : null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 px-3 md:hidden">
      <Link
        to="/pm5"
        aria-label={rowing ? 'Return to the piece in progress' : 'Open the connected PM5'}
        className="mx-auto flex min-h-11 max-w-lg items-center gap-3 rounded-full border border-border bg-surface-card/95 px-4 py-2 shadow-lg backdrop-blur focus:outline-none focus:ring-2 focus:ring-focus"
      >
        <span
          className={rowing ? 'text-accent-primary-text' : 'text-content-muted'}
          aria-hidden="true"
        >
          {rowing ? <Activity size={16} /> : <Bluetooth size={16} />}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-content-primary">
          {rowing ? 'Rowing' : connectedDevice?.name ?? 'PM5 connected'}
        </span>
        {rowing && distance && (
          <span className="shrink-0 text-xs tabular-nums text-content-secondary">
            {distance} · {formatPace(liveData?.pace ?? 0)}/500m
          </span>
        )}
      </Link>
    </div>
  );
}
