const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TrainingBlockSearchLink {
    enrollmentId: string | null;
    date: string | null;
    sessionId: string | null;
    invalid: boolean;
}

function validDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseTrainingBlockSearchLink(search: string): TrainingBlockSearchLink {
    const params = new URLSearchParams(search);
    const enrollment = params.get('enrollment');
    const date = params.get('date');
    const session = params.get('session');
    const enrollmentId = enrollment && UUID.test(enrollment) ? enrollment.toLowerCase() : null;
    const validDay = date && validDate(date) ? date : null;
    const sessionId = session && /^[\w:.-]{1,200}$/.test(session) ? session : null;
    return {
        enrollmentId,
        date: validDay,
        sessionId,
        invalid: (enrollment !== null && !enrollmentId) || (date !== null && !validDay) || (session !== null && !sessionId),
    };
}

export function findLinkedPersonalEnrollment<T extends { id: string; user_id: string; team_id: string | null; org_id: string | null }>(
    link: TrainingBlockSearchLink,
    userId: string,
    enrollments: readonly T[],
): T | null {
    if (!link.enrollmentId || link.invalid) return null;
    return enrollments.find((entry) => entry.id === link.enrollmentId && entry.user_id === userId && entry.team_id === null && entry.org_id === null) ?? null;
}

export function resolveLinkedPlanDay(
    link: TrainingBlockSearchLink,
    days: readonly { date: string; sessions: readonly { id: string }[] }[],
): { date: string | null; sessionId: string | null; error: string | null } {
    if (link.invalid) return { date: null, sessionId: null, error: 'This training block link is invalid.' };
    if (!link.date) return { date: null, sessionId: null, error: link.sessionId ? 'The linked session has no scheduled day.' : null };
    const day = days.find((entry) => entry.date === link.date);
    if (!day) return { date: null, sessionId: null, error: 'The linked day is no longer in this training block.' };
    if (link.sessionId && !day.sessions.some((session) => session.id === link.sessionId)) {
        return { date: day.date, sessionId: null, error: 'The linked session is no longer on this day.' };
    }
    return { date: day.date, sessionId: link.sessionId, error: null };
}

export function parseSupportTemplateSearchLink(search: string): { templateId: string | null; invalid: boolean } {
    const value = new URLSearchParams(search).get('template');
    const templateId = value && UUID.test(value) ? value.toLowerCase() : null;
    return { templateId, invalid: value !== null && !templateId };
}
