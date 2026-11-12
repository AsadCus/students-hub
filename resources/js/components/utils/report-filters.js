// Turns a report page's filter state into API query params. Same semantics
// the pages used before: timestamps are sent as UTC instants, and a single
// day or a range ends at the start of the day after the last picked day.
// (Equipment loans use date columns and send local YYYY-MM-DD instead.)

const dayRange = (from, to = from) => {
    const end = new Date(to);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start: from.toISOString(), end: end.toISOString() };
};

/** @returns {{time?: string, range_time?: {start: string, end: string}}} */
export const reportParams = ({ timeFilter, dateFilter, rangeFilter }) => {
    if (dateFilter) return { range_time: dayRange(dateFilter) };
    if (rangeFilter?.[0]) {
        return { range_time: dayRange(rangeFilter[0], rangeFilter[1] || rangeFilter[0]) };
    }
    if (timeFilter) return { time: timeFilter };
    return {};
};
