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

/** "level", "support strategy", but "CCA" stays upper case. */
export const lowerLabelOf = (type) => {
    const label = labelOf(type);
    return label === "CCA" ? label : label.toLowerCase();
};
