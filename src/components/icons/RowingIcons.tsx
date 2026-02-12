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
      {/* Top-down shell silhouette (longer + thinner) */}
      <path d="M12 1 Q13 3 13.5 7 L14 17 Q14 20 12 23 Q10 20 10 17 L10.5 7 Q11 3 12 1" />
      {/* Centerline */}
      <line x1="12" y1="3" x2="12" y2="21" />
      {/* Outriggers (4 per side, alternating) */}
      <line x1="10.5" y1="5" x2="4" y2="2" />
      <line x1="13.5" y1="7" x2="20" y2="4" />
      <line x1="10.5" y1="9" x2="4" y2="6" />
      <line x1="13.5" y1="11" x2="20" y2="8" />
      <line x1="10.5" y1="13" x2="4" y2="10" />
      <line x1="13.5" y1="15" x2="20" y2="12" />
      <line x1="10.5" y1="17" x2="4" y2="14" />
      <line x1="13.5" y1="19" x2="20" y2="16" />
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
      {/* Flywheel/monitor motif */}
      <circle cx="12" cy="12" r="8" />
      {/* Abstract C */}
      <path d="M11 8.5 Q8.5 10, 8.5 12 Q8.5 14, 11 15.5" />
      {/* Abstract 2 */}
      <path d="M13.5 9.5 Q15.5 9.5, 15.5 11 Q15.5 12, 12.5 14.5" />
      <line x1="12.5" y1="14.5" x2="16" y2="14.5" />
      {/* Small monitor nub */}
      <line x1="12" y1="4" x2="12" y2="2" />
      <line x1="10.5" y1="2" x2="13.5" y2="2" />
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
      {/* Pulse waveform */}
      <polyline points="6,12 8,12 9,10 11,14 12.5,11.5 14,12" />
    </svg>
  );
}
