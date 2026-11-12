// Shared by the legacy thunks (global-slice.jsx) and RTK Query (hub-api.js).

const isPlainObject = (v) =>
    v !== null && typeof v === "object" && !Array.isArray(v);

export class ApiError extends Error {
    constructor(message, { status = null, fieldErrors = {}, body = null } = {}) {
        super(message);
        this.name = "ApiError";
        this.status = status; // HTTP status, or null when the server was unreachable
        this.fieldErrors = fieldErrors; // Laravel 422 `errors`, for inline form messages
        this.body = body;
    }
}

/**
 * Turn an axios error into an ApiError with a message people can act on.
 * The API answers {status: false, message, errors?}; message is already the
 * first field error for 422s (see app/Support/ApiResponse.php).
 */
export const toApiError = (error, fallback = "Something went wrong") => {
    if (error instanceof ApiError) return error;
    const res = error?.response;
    if (!res) {
        return new ApiError(
            "Can't reach the server. Check your connection and try again."
        );
    }
    const body = res.data ?? {};
    const fieldErrors = isPlainObject(body.errors) ? body.errors : {};
    // The server's message comes first: a 401 from /api/login means a wrong
    // password, not an expired session.
    const message =
        body.message ||
        Object.values(fieldErrors).flat()[0] ||
        (res.status === 401
            ? "Your session has expired. Log in again."
            : `${fallback} (HTTP ${res.status})`);
    return new ApiError(message, { status: res.status, fieldErrors, body });
};
