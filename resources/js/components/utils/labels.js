// Human names for API types in messages ("Level created"). Mirrors
// MasterApiController::label() on the server.
const LABELS = {
    roles: "Role",
    permissions: "Permission",
    users: "User",
    class: "Class",
    levels: "Level",
    students: "Student",
    activities: "Activity",
    facilities: "Facility",
    checkin: "Check-in",
    bookings: "Booking",
    counsels: "Counsel record",
    support_strategies: "Support strategy",
    questions: "Question",
    radio_options: "Option",
    blocked_dates: "Blocked date",
    ccas: "CCA",
    equipment: "Equipment",
    equipment_loans: "Loan",
};

export const labelOf = (type) => LABELS[type] || "Record";

const PLURALS = {
    class: "classes",
    activities: "activities",
    facilities: "facilities",
    support_strategies: "support strategies",
    equipment: "equipment",
    ccas: "CCAs",
    checkin: "check-ins",
    counsels: "counsel records",
    blocked_dates: "blocked dates",
    equipment_loans: "loans",
};

/** "3 classes", "1 class": for bulk messages. */
export const countOf = (n, type) =>
    `${n} ${n === 1 ? lowerLabelOf(type) : PLURALS[type] || `${lowerLabelOf(type)}s`}`;

/** "level", "support strategy", but "CCA" stays upper case. */
export const lowerLabelOf = (type) => {
    const label = labelOf(type);
    return label === "CCA" ? label : label.toLowerCase();
};
