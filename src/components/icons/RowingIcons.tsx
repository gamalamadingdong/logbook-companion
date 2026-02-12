/**
 * Custom rowing-specific icons to replace generic Lucide icons.
 * All icons follow Lucide conventions: 24x24 viewBox, stroke-based, stroke-width="2"
 */

interface IconProps {
  className?: string;
  size?: number;
}

/**
 * Rowing shell (side view) - use for Boatings, lineups, etc.
 */
export function RowingShellIcon({ className, size = 24 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Hull - sleek racing shell shape */}
      <path d="M1 14 Q3 12, 12 12 Q21 12, 23 14" />
      <path d="M3 14 Q12 16, 21 14" />
      {/* Riggers/oarlocks */}
      <line x1="6" y1="12" x2="5" y2="9" />
      <line x1="10" y1="12" x2="9" y2="9" />
      <line x1="14" y1="12" x2="15" y2="9" />
      <line x1="18" y1="12" x2="19" y2="9" />
    </svg>
  );
}

/**
 * Single oar - use for technique, stroke work
 */
export function OarIcon({ className, size = 24 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Handle */}
      <line x1="2" y1="22" x2="8" y2="16" />
      {/* Shaft */}
      <line x1="8" y1="16" x2="18" y2="6" />
      {/* Blade */}
      <path d="M18 6 Q22 4, 22 2 Q20 2, 18 6" />
    </svg>
  );
}

/**
 * Ergometer (rowing machine) - use for Ergs section
 */
export function ErgIcon({ className, size = 24 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Monorail/beam */}
      <line x1="2" y1="16" x2="22" y2="16" />
      {/* Front support */}
      <line x1="4" y1="16" x2="4" y2="20" />
      {/* Rear support */}
      <line x1="20" y1="16" x2="20" y2="20" />
      {/* Flywheel housing */}
      <circle cx="5" cy="12" r="3" />
      {/* Seat */}
      <rect x="12" y="14" width="4" height="2" rx="0.5" />
      {/* Handle chain */}
      <line x1="8" y1="12" x2="11" y2="12" />
      {/* Handle */}
      <line x1="11" y1="10" x2="11" y2="14" />
      {/* PM5 display */}
      <rect x="3" y="6" width="4" height="3" rx="0.5" />
    </svg>
  );
}

/**
 * Crossed oars - use for crew/team, could replace Users in some contexts
 */
export function CrossedOarsIcon({ className, size = 24 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Left oar */}
      <line x1="4" y1="20" x2="20" y2="4" />
      <path d="M20 4 Q22 2, 22 2 Q22 4, 20 4" />
      {/* Right oar */}
      <line x1="20" y1="20" x2="4" y2="4" />
      <path d="M4 4 Q2 2, 2 2 Q2 4, 4 4" />
    </svg>
  );
}

/**
 * Stopwatch with split display - use for timing, intervals
 */
export function SplitTimerIcon({ className, size = 24 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Watch body */}
      <circle cx="12" cy="14" r="8" />
      {/* Top button */}
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="10" y1="2" x2="14" y2="2" />
      {/* Side button */}
      <line x1="19" y1="8" x2="21" y2="6" />
      {/* Clock hands showing split */}
      <line x1="12" y1="14" x2="12" y2="10" />
      <line x1="12" y1="14" x2="16" y2="14" />
    </svg>
  );
}

/**
 * Coxbox/SpeedCoach display - use for Live racing, real-time data
 */
export function CoxboxIcon({ className, size = 24 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Device body */}
      <rect x="3" y="6" width="18" height="12" rx="2" />
      {/* Screen */}
      <rect x="5" y="8" width="10" height="8" rx="1" />
      {/* Buttons */}
      <circle cx="18" cy="10" r="1" />
      <circle cx="18" cy="14" r="1" />
      {/* Display line (split time) */}
      <line x1="6" y1="12" x2="14" y2="12" />
    </svg>
  );
}
