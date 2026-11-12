import {
    createListenerMiddleware,
    isFulfilled,
    isRejectedWithValue,
} from "@reduxjs/toolkit";
import { notify } from "../utils/notify";
import { labelOf, lowerLabelOf } from "../utils/labels";
import { setStateData } from "./global-slice";

/**
 * The one place that decides which toast an API result gets, so every action
 * shows exactly one message.
 *
 * - Generic CRUD and approval actions toast here ("Level created").
 * - Kiosk actions (check-in/out, booking, counsel, loan request) are not
 *   listed: their screens show a richer message of their own.
 * - Form validation errors (422 on create/update) are shown inline by the
 *   form, and login errors on the login page, so they get no toast.
 */
export const SUCCESS_TEXT = {
    create: ({ type }) => `${labelOf(type)} created`,
    update: ({ type }) => `${labelOf(type)} updated`,
    remove: ({ type }) => `${labelOf(type)} deleted`,
    importRecords: () => "Import finished",
    confirmBooking: () => "Booking confirmed",
    cancelBooking: () => "Booking cancelled",
    confirmLoan: () => "Loan approved",
    rejectLoan: () => "Loan rejected",
    returnLoan: () => "Loan marked as returned",
    cancelLoan: () => "Loan cancelled",
    setLoginRequired: () => "Setting saved",
};

const FAILURE_TEXT = {
    list: () => "Couldn't load data",
    create: ({ type }) => `Couldn't save ${lowerLabelOf(type)}`,
    update: ({ type }) => `Couldn't save ${lowerLabelOf(type)}`,
    remove: ({ type }) => `Couldn't delete ${lowerLabelOf(type)}`,
    importRecords: () => "Import failed",
    loginRequired: () => "Couldn't load settings",
    setLoginRequired: () => "Couldn't save setting",
    checkIn: () => "Couldn't check in",
    checkOut: () => "Couldn't check out",
    book: () => "Couldn't book",
    confirmBooking: () => "Couldn't confirm booking",
    cancelBooking: () => "Couldn't cancel booking",
    submitCounsel: () => "Couldn't send answers",
    requestLoan: () => "Couldn't request loan",
    confirmLoan: () => "Couldn't approve loan",
    rejectLoan: () => "Couldn't reject loan",
    returnLoan: () => "Couldn't mark as returned",
    cancelLoan: () => "Couldn't cancel loan",
};

/** Pure decision, exported for tests: which toast (if any) an RTK Query action gets. */
export const toastFor = (action) => {
    const endpoint = action.meta?.arg?.endpointName;
    const args = action.meta?.arg?.originalArgs ?? {};
    if (!endpoint) return null;
    // The caller reports the outcome itself (e.g. one toast for a bulk delete).
    if (args.silent) return null;

    if (isRejectedWithValue(action)) {
        const { status, message } = action.payload ?? {};
        // Login shows its errors on the form; logout always signs out anyway.
        if (endpoint === "login" || endpoint === "logout") return null;
        if (status === 401) {
            return { severity: "warn", summary: "Session expired", detail: message, sessionExpired: true };
        }
        if (status === 422 && (endpoint === "create" || endpoint === "update")) return null;
        const summary = FAILURE_TEXT[endpoint]?.(args) ?? "Something went wrong";
        return { severity: "error", summary, detail: message };
    }

    if (isFulfilled(action) && action.meta.arg.type === "mutation" && SUCCESS_TEXT[endpoint]) {
        const detail = endpoint === "importRecords" ? action.payload?.message : undefined;
        return { severity: "success", summary: SUCCESS_TEXT[endpoint](args), detail };
    }

    return null;
};

export const apiToasts = createListenerMiddleware();

apiToasts.startListening({
    predicate: (action) => !!action.meta?.arg?.endpointName,
    effect: (action, { dispatch }) => {
        const toast = toastFor(action);
        if (!toast) return;
        notify[toast.severity](toast.summary, toast.detail);
        if (toast.sessionExpired) {
            // app.jsx signs out and redirects (staff only).
            dispatch(setStateData({ key: "sessionExpired", data: true, isMerge: false }));
        }
    },
});
