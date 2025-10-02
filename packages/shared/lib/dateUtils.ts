/**
 * Date utilities with proper timezone handling
 * Fixes off-by-one date issues caused by UTC conversion
 * 
 * @source Extracted from ScheduleBoard v2
 * @license MIT
 */

/**
 * Gets the local date string in YYYY-MM-DD format without timezone conversion
 * This prevents the common off-by-one error when using toISOString() in different timezones
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets today's date in local timezone as YYYY-MM-DD string
 */
export function getTodayLocalString(): string {
  return getLocalDateString(new Date());
}

/**
 * Parses a YYYY-MM-DD date string into a Date object in local timezone
 * Avoids timezone shift issues that occur with Date constructor parsing
 */
export function parseDateString(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
}

/**
 * Checks if a date is today in local timezone
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return date.getFullYear() === today.getFullYear() &&
         date.getMonth() === today.getMonth() &&
         date.getDate() === today.getDate();
}

/**
 * Formats a date for display in schedule headers
 */
export function formatScheduleDate(date: Date): {
  dayName: string;
  dayNumber: string;
  monthName: string;
  isToday: boolean;
} {
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNumber = date.getDate().toString();
  const monthName = date.toLocaleDateString('en-US', { month: 'short' });
  
  return {
    dayName,
    dayNumber,
    monthName,
    isToday: isToday(date)
  };
}
