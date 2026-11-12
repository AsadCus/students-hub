import { createApi } from "@reduxjs/toolkit/query/react";
import api from "../api";
import { toApiError } from "./api-error";

/**
 * The one way the SPA talks to the API (RTK Query).
 *
 * Every endpoint resolves to the response's `result`. Errors are plain
 * objects {status, message, fieldErrors} (serializable, so they can live in
 * the store); `.unwrap()` throws them, so forms can do
 * `try { await save(...).unwrap() } catch (e) { setErrors(e.fieldErrors) }`.
 * Toasts for results and errors are shown by api-toasts.js, not by pages.
 */
const axiosBaseQuery = async ({ url, method = "get", data, params }) => {
    try {
        const { data: body } = await api.request({ url, method, data, params });
        if (body?.status === false) {
            return {
                error: {
                    status: 200,
                    message: body.message || "Request failed",
                    fieldErrors: body.errors || {},
                },
            };
        }
        return { data: body };
    } catch (raw) {
        const error = toApiError(raw);
        return {
            error: {
                status: error.status,
                message: error.message,
                fieldErrors: error.fieldErrors,
            },
        };
    }
};

/**
 * Lists that show data from another type, so a change to the key also
 * refreshes them (a class row shows its student count, a CCA its equipment).
 */
export const RELATED = {
    levels: ["class", "students"],
    class: ["levels", "students"],
    students: ["class", "levels"],
    activities: ["checkin"],
    facilities: ["bookings"],
    support_strategies: ["questions", "counsels"],
    questions: ["support_strategies", "counsels"],
    radio_options: ["questions"],
    ccas: ["equipment", "equipment_loans"],
    equipment: ["ccas", "equipment_loans"],
    roles: ["users"],
    permissions: ["roles"],
};

export const tagsFor = (type) => [type, ...(RELATED[type] || [])];

const TYPES = [
    "roles", "permissions", "users", "class", "levels", "students",
    "activities", "facilities", "checkin", "bookings", "counsels",
    "support_strategies", "questions", "radio_options", "blocked_dates",
    "ccas", "equipment", "equipment_loans",
];

const result = (body) => body?.result;

export const hubApi = createApi({
    reducerPath: "hubApi",
    baseQuery: axiosBaseQuery,
    tagTypes: [...TYPES, "Settings"],
    // Lists refetch when a page mounts, as before; mutations refresh them
    // through tags in between.
    refetchOnMountOrArgChange: true,
    endpoints: (build) => ({
        // ---- generic, for every master type -------------------------------
        list: build.query({
            query: ({ type, params }) => ({ url: `/api/${type}`, params }),
            transformResponse: (body) => body?.result ?? [],
            providesTags: (_r, _e, { type }) => [type],
        }),
        create: build.mutation({
            query: ({ type, data }) => ({ url: `/api/${type}`, method: "post", data }),
            transformResponse: result,
            invalidatesTags: (_r, error, { type }) => (error ? [] : tagsFor(type)),
        }),
        update: build.mutation({
            query: ({ type, id, data }) => ({ url: `/api/${type}/${id}`, method: "put", data }),
            transformResponse: result,
            invalidatesTags: (_r, error, { type }) => (error ? [] : tagsFor(type)),
        }),
        remove: build.mutation({
            query: ({ type, id }) => ({ url: `/api/${type}/${id}`, method: "delete" }),
            transformResponse: result,
            invalidatesTags: (_r, error, { type }) => (error ? [] : tagsFor(type)),
        }),
        importRecords: build.mutation({
            query: ({ type, file, hasExpand = false }) => {
                const data = new FormData();
                data.append("file", file);
                if (hasExpand) data.append("has_expand", "1");
                return { url: `/api/${type}/import`, method: "post", data };
            },
            // The message carries "N added, M updated"; keep it.
            transformResponse: (body) => ({ records: body?.result ?? [], message: body?.message }),
            invalidatesTags: (_r, error, { type }) => (error ? [] : tagsFor(type)),
        }),

        // ---- auth and settings --------------------------------------------
        login: build.mutation({
            query: (credentials) => ({ url: "/api/login", method: "post", data: credentials }),
            transformResponse: result, // {token, user}
        }),
        logout: build.mutation({
            query: () => ({ url: "/api/logout", method: "post" }),
        }),
        loginRequired: build.query({
            query: () => ({ url: "/api/settings/login-required" }),
            transformResponse: (body) => !!body?.result?.login_required,
            providesTags: ["Settings"],
        }),
        setLoginRequired: build.mutation({
            query: (loginRequired) => ({
                url: "/api/settings/login-required",
                method: "put",
                data: { login_required: loginRequired },
            }),
            invalidatesTags: ["Settings"],
        }),

        // ---- kiosk and approval actions -------------------------------------
        checkIn: build.mutation({
            query: (data) => ({ url: "/api/check-in", method: "post", data }),
            transformResponse: result,
            invalidatesTags: ["checkin"],
        }),
        checkOut: build.mutation({
            query: (data) => ({ url: "/api/check-out", method: "post", data }),
            transformResponse: result,
            invalidatesTags: ["checkin"],
        }),
        book: build.mutation({
            query: (data) => ({ url: "/api/booking", method: "post", data }),
            transformResponse: result,
            invalidatesTags: ["bookings"],
        }),
        confirmBooking: build.mutation({
            query: (id) => ({ url: `/api/booking-confirm/${id}`, method: "put" }),
            transformResponse: result,
            invalidatesTags: ["bookings"],
        }),
        // studentId is required at the kiosk; staff may omit it.
        cancelBooking: build.mutation({
            query: ({ id, studentId }) => ({
                url: `/api/booking-cancel/${id}`,
                method: "put",
                data: studentId ? { student_id: studentId } : {},
            }),
            transformResponse: result,
            invalidatesTags: ["bookings"],
        }),
        submitCounsel: build.mutation({
            query: (data) => ({ url: "/api/counsel-submit", method: "post", data }),
            transformResponse: result,
            invalidatesTags: ["counsels"],
        }),
        requestLoan: build.mutation({
            query: (data) => ({ url: "/api/equipment-loans", method: "post", data }),
            transformResponse: result,
            invalidatesTags: ["equipment_loans"],
        }),
        confirmLoan: build.mutation({
            query: (id) => ({ url: `/api/equipment-loans-confirm/${id}`, method: "put" }),
            transformResponse: result,
            invalidatesTags: ["equipment_loans"],
        }),
        rejectLoan: build.mutation({
            query: (id) => ({ url: `/api/equipment-loans-reject/${id}`, method: "put" }),
            transformResponse: result,
            invalidatesTags: ["equipment_loans"],
        }),
        returnLoan: build.mutation({
            query: (id) => ({ url: `/api/equipment-loans-return/${id}`, method: "put" }),
            transformResponse: result,
            invalidatesTags: ["equipment_loans"],
        }),
        cancelLoan: build.mutation({
            query: ({ id, studentId }) => ({
                url: `/api/equipment-loans-cancel/${id}`,
                method: "put",
                data: studentId ? { student_id: studentId } : {},
            }),
            transformResponse: result,
            invalidatesTags: ["equipment_loans"],
        }),
    }),
});

export const {
    useListQuery,
    useCreateMutation,
    useUpdateMutation,
    useRemoveMutation,
    useImportRecordsMutation,
    useLoginMutation,
    useLogoutMutation,
    useLoginRequiredQuery,
    useSetLoginRequiredMutation,
    useCheckInMutation,
    useCheckOutMutation,
    useBookMutation,
    useConfirmBookingMutation,
    useCancelBookingMutation,
    useSubmitCounselMutation,
    useRequestLoanMutation,
    useConfirmLoanMutation,
    useRejectLoanMutation,
    useReturnLoanMutation,
    useCancelLoanMutation,
} = hubApi;
