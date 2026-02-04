/**
 * Extract Main Work Block from RWN
 * 
 * Strips warmup ([w]), cooldown ([c]), and test ([t]) blocks to get just the core work.
 * 
 * Examples:
 *   "[w]10:00 + 6000m + [c]5:00" → "6000m"
 *   "[w]5:00 + 4x500m/1:00r + [c]5:00" → "4x500m/1:00r"
 *   "10000m" → "10000m" (no change if no blocks)
 */

export function extractMainWork(canonicalName: string): string {
    if (!canonicalName) return canonicalName;

    // Split by ' + ' to get segments
    const segments = canonicalName.split(/\s*\+\s*/);

    // Filter out warmup, cooldown, and test blocks
    // Supports both old format [w]/[c]/[t] and new format #warmup/#cooldown/#test
    const workSegments = segments.filter(segment => {
        const trimmed = segment.trim();
        // Remove segments with block tags:
        // Old format: starts with [w], [c], or [t]
        // New format: ends with #warmup, #cooldown, #test
        return !trimmed.match(/^\[(w|c|t)\]/i) && !trimmed.match(/#(warmup|cooldown|test)$/i);
    });

    // If no work segments found, might be a single block with tag - strip the tag
    if (workSegments.length === 0) {
        // Try stripping tags from the original
        const stripped = canonicalName.replace(/^\[([wct])\]\s*/i, '').replace(/#(warmup|cooldown|test)$/i, '').trim();
        return stripped || canonicalName;
    }

    // Strip any remaining block tags from work segments
    const cleanSegments = workSegments.map(segment => 
        segment.replace(/#(warmup|cooldown|test)$/i, '').trim()
    );

    // Join remaining segments back together
    return cleanSegments.join(' + ').trim();
}

/**
 * Normalize canonical name for matching
 * 
 * Handles various formats and edge cases:
 * - Strips block tags
 * - Normalizes spacing
 * - Handles "JustRow" suffix
 */
export function normalizeForMatching(canonicalName: string): string {
    if (!canonicalName) return canonicalName;

    // Extract main work
    let normalized = extractMainWork(canonicalName);

    // Remove "JustRow" suffix (these are freeform, hard to template)
    normalized = normalized.replace(/\s*JustRow\s*$/i, '').trim();

    // Normalize spacing around operators
    normalized = normalized.replace(/\s*\/\s*/g, '/'); // "500m / 1:00r" → "500m/1:00r"
    normalized = normalized.replace(/\s*\+\s*/g, ' + '); // Consistent spacing around +

    return normalized;
}
