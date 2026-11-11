import api from "../api";
import { createSlice } from "@reduxjs/toolkit";
import {
    APP_STATE,
    USER_STATE,
    ROLE_STATE,
    CLASS_STATE,
    LEVEL_STATE,
    ACTIVITY_STATE,
    STUDENT_STATE,
    SUB_FACILITY_STATE,
    FACILITY_STATE,
    CHECKIN_STATE,
    BOOKING_STATE,
    COUNSEL_STATE,
    SUPPORT_STRATEGY_STATE,
    QUESTION_STATE,
    BLOCKED_DATE_STATE,
    CCA_STATE,
    EQUIPMENT_STATE,
    EQUIPMENT_LOAN_STATE,
} from "./state";
import { stateKey } from "../utils/constants";

const INITIAL_STATE = {
    [stateKey.app]: { ...APP_STATE, pending: 0 },
    [stateKey.users]: USER_STATE,
    [stateKey.roles]: ROLE_STATE,
    [stateKey.class]: CLASS_STATE,
    [stateKey.levels]: LEVEL_STATE,
    [stateKey.activities]: ACTIVITY_STATE,
    [stateKey.students]: STUDENT_STATE,
    [stateKey.sub_facilities]: SUB_FACILITY_STATE,
    [stateKey.facilities]: FACILITY_STATE,
    [stateKey.checkin]: CHECKIN_STATE,
    [stateKey.bookings]: BOOKING_STATE,
    [stateKey.counsels]: COUNSEL_STATE,
    [stateKey.support_strategies]: SUPPORT_STRATEGY_STATE,
    [stateKey.questions]: QUESTION_STATE,
    [stateKey.blocked_dates]: BLOCKED_DATE_STATE,
    [stateKey.ccas]: CCA_STATE,
    [stateKey.equipment]: EQUIPMENT_STATE,
    [stateKey.equipment_loans]: EQUIPMENT_LOAN_STATE,
};

const isPlainObject = (v) =>
    v !== null && typeof v === "object" && !Array.isArray(v);

// Arrays are upserted by id (so saving one record never turns a list into an
// object); plain objects are shallow-merged; anything else is replaced.
const mergeValue = (current, incoming) => {
    if (Array.isArray(current)) {
        const next = [...current];
        for (const item of [].concat(incoming)) {
            const i = item?.id == null ? -1 : next.findIndex((x) => x?.id === item.id);
            if (i === -1) next.push(item);
            else next[i] = { ...next[i], ...item };
        }
        return next;
    }
    if (isPlainObject(current) && isPlainObject(incoming)) {
        return { ...current, ...incoming };
    }
    return incoming;
};

const globalSlice = createSlice({
    name: "global",
    initialState: INITIAL_STATE,
    reducers: {
        setStateData: (state, action) => {
            const {
                type = stateKey.app,
                data = {},
                key,
                isMerge = true,
                isReset = false,
            } = action.payload;
            const slot = state[type];
            if (!slot || !key) return; // unknown slice or missing key: ignore instead of writing state[type]["undefined"]
            if (isReset) {
                slot[key] = INITIAL_STATE[type]?.[key];
                return;
            }
            slot[key] = isMerge ? mergeValue(slot[key], data) : data;
        },
        resetStateData: (state, action) => {
            const { type = stateKey.app } = action.payload;
            state[type] = INITIAL_STATE[type];
        },
        resetStateKeyData: (state, action) => {
            const { type = stateKey.app, key } = action.payload;
            if (state[type]) state[type][key] = INITIAL_STATE[type]?.[key];
        },
        // Spinner is reference-counted: it stays visible until the LAST
        // in-flight request finishes, not the first one.
        loadingStarted: (state, action) => {
            const app = state[stateKey.app];
            app.pending = (app.pending ?? 0) + 1;
            app.spinner = { show: true, text: action.payload || "Loading..." };
        },
        loadingFinished: (state) => {
            const app = state[stateKey.app];
            app.pending = Math.max(0, (app.pending ?? 0) - 1);
            if (app.pending === 0) app.spinner = INITIAL_STATE[stateKey.app].spinner;
        },
    },
});

export const { setStateData, resetStateData, resetStateKeyData } =
    globalSlice.actions;
const { loadingStarted, loadingFinished } = globalSlice.actions;

export const setToastMessage = (message) => (dispatch) => {
    dispatch(setStateData({ key: "toastMessage", data: message, isMerge: false }));
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ApiError extends Error {
    constructor(message, { status = null, fieldErrors = {}, body = null } = {}) {
        super(message);
        this.name = "ApiError";
        this.status = status; // HTTP status, or null when the server was unreachable
        this.fieldErrors = fieldErrors; // Laravel 422 `errors` object, for inline form messages
        this.body = body;
    }
}

const toApiError = (error, fallback) => {
    if (error instanceof ApiError) return error;
    const res = error?.response;
    if (!res) {
        return new ApiError(
            "Can't reach the server. Check your connection and try again."
        );
    }
    const body = res.data ?? {};
    const fieldErrors = isPlainObject(body.errors) ? body.errors : {};
    const firstFieldError = Object.values(fieldErrors).flat()[0];
    // Laravel puts the useful text in errors.* for 422 and in message otherwise.
    // Its own 401 body ("Unauthenticated.") is replaced with something actionable.
    const message =
        res.status === 401
            ? "Your session has expired. Log in again."
            : firstFieldError || body.message || `${fallback} (HTTP ${res.status})`;
    return new ApiError(message, { status: res.status, fieldErrors, body });
};

// ---------------------------------------------------------------------------
// One request helper: spinner, envelope check, error normalisation, toast.
// Every thunk below goes through it, so behaviour is identical everywhere.
// ---------------------------------------------------------------------------

const request =
    ({ method, url, data, config, spinnerText, fallbackError, silentStatuses = [] }) =>
    async (dispatch) => {
        dispatch(loadingStarted(spinnerText));
        try {
            const { data: body } = await api.request({ method, url, data, ...config });
            // Backend returns { status, message, result }. status:false on a 2xx
            // is still a failure.
            if (body?.status === false) {
                throw new ApiError(body.message || fallbackError, {
                    status: 200,
                    fieldErrors: isPlainObject(body.errors) ? body.errors : {},
                    body,
                });
            }
            return body ?? {};
        } catch (raw) {
            const error = toApiError(raw, fallbackError);
            if (!silentStatuses.includes(error.status)) {
                dispatch(
                    setToastMessage({
                        severity: error.status === 401 ? "warn" : "error",
                        summary: error.status === 401 ? "Session expired" : "Error",
                        detail: error.message,
                        life: 6000,
                    })
                );
            }
            if (error.status === 401) {
                // app.jsx can watch this flag and call signOut() + navigate("/login").
                dispatch(setStateData({ key: "sessionExpired", data: true, isMerge: false }));
            }
            throw error;
        } finally {
            dispatch(loadingFinished());
        }
    };

const urlFor = (endPoint, type) => {
    const url = endPoint || (type ? `/api/${type}` : "");
    if (!url) throw new Error("No endpoint or type provided"); // programmer error, fail loudly
    return url;
};

const successToast = (detail) =>
    setToastMessage({ severity: "success", summary: "Success", detail, life: 3000 });

// ---------------------------------------------------------------------------
// Public thunks — same names, arguments and return contract as before:
//   getRecords   -> resolves to an array, never throws
//   create/update/import -> resolves to `true` or the result; THROWS on failure
//   deleteRecord -> resolves to true / false, never throws
// ---------------------------------------------------------------------------

export const getRecords =
    ({ type = "", endPoint, key, params }) =>
    async (dispatch) => {
        const target = type || stateKey.app;
        try {
            const body = await dispatch(
                request({
                    method: "get",
                    url: urlFor(endPoint, type),
                    config: { params },
                    spinnerText: "Fetching...",
                    fallbackError: "Couldn't load data",
                    silentStatuses: [404],
                })
            );
            const result = body.result ?? [];
            if (key) {
                dispatch(setStateData({ type: target, key, data: result, isMerge: false }));
            }
            return result;
        } catch (error) {
            // 404 means "nothing there": clear the list. Other errors keep the
            // last good data on screen (the toast already explained what happened).
            if (error.status === 404 && key) {
                dispatch(setStateData({ type: target, key, data: [], isMerge: false }));
            }
            if (!(error instanceof ApiError)) throw error; // programmer error
            return [];
        }
    };

const saveRecord =
    ({ method, spinnerText, failText, successText }) =>
    ({ type = "", endPoint, data, returnData = false }) =>
    async (dispatch) => {
        const body = await dispatch(
            request({
                method,
                url: urlFor(endPoint, type),
                data,
                spinnerText,
                fallbackError: failText,
            })
        );
        const result = body.result;
        // Not written into state[type].data: pages keep formatted rows there and
        // refetch after saving. Merging the raw server record in (with nested
        // objects like equipment or roles) breaks those tables until the refetch.
        dispatch(successToast(successText));
        return returnData ? result : true;
    };

export const createRecord = saveRecord({
    method: "post",
    spinnerText: "Creating...",
    failText: "Failed to create record",
    successText: "Record created successfully",
});

export const updateRecord = saveRecord({
    method: "put",
    spinnerText: "Updating...",
    failText: "Failed to update record",
    successText: "Record updated successfully",
});

export const deleteRecord =
    ({ type = "", endPoint, id }) =>
    async (dispatch, getState) => {
        try {
            await dispatch(
                request({
                    method: "delete",
                    url: urlFor(endPoint, type),
                    spinnerText: "Deleting...",
                    fallbackError: "Failed to delete record",
                })
            );
        } catch (error) {
            if (!(error instanceof ApiError)) throw error;
            return false;
        }
        // Optional: drop the row locally when the caller says which one.
        const list = getState().global[type]?.data;
        if (id != null && Array.isArray(list)) {
            dispatch(
                setStateData({
                    type,
                    key: "data",
                    data: list.filter((x) => x?.id !== id),
                    isMerge: false,
                })
            );
        }
        dispatch(successToast("Record deleted successfully"));
        return true;
    };

export const importRecord =
    ({ type = "", endPoint, file, returnData = false, hasExpand = false }) =>
    async (dispatch) => {
        const formData = new FormData();
        formData.append("file", file);
        if (hasExpand) formData.append("has_expand", "1");

        const body = await dispatch(
            request({
                method: "post",
                url: urlFor(endPoint, type),
                data: formData, // axios sets multipart + boundary itself
                config: { timeout: 120000 },
                spinnerText: "Importing...",
                fallbackError: "Failed to import data",
            })
        );
        dispatch(successToast(body.message || `${type} imported successfully`));
        return returnData ? body.result : true;
    };

export const globalReducer = globalSlice.reducer;
