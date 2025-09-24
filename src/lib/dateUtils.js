export function getMonday(dateStr) {
    let inputDateStr;
    if (!dateStr) {
        // Use current date if no date provided
        const now = new Date();
        inputDateStr = formatDate(now);
    } else {
        inputDateStr = formatDate(dateStr);
    }

    // Parse as UTC and set to midnight
    const d = new Date(`${inputDateStr}T00:00:00.000Z`);
    const dayOfWeek = d.getUTCDay();

    // Calculate days to subtract to get to Monday (1)
    // Sunday (0) -> subtract 6 days, Monday (1) -> subtract 0 days, Tuesday (2) -> subtract 1 day, etc.
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - daysToSubtract);

    return formatDate(monday);
}

export function getNextMonday(mondayStr) {
    const monday = new Date(`${mondayStr}T00:00:00.000Z`);
    const nextMonday = new Date(monday);
    nextMonday.setUTCDate(monday.getUTCDate() + 7);
    return formatDate(nextMonday);
}

export function formatDate(date) {
    if (typeof date === 'string') {
        return date.split('T')[0];
    }
    return date.toISOString().split('T')[0];
}