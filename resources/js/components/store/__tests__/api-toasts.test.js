import { afterEach, describe, expect, it, vi } from "vitest";
import { hubApi } from "../hub-api";
import { toastFor } from "../api-toasts";
import { fakeApi, httpError, makeStore, ok, settle, shownToasts } from "./test-store";

vi.mock("../../api", () => ({ default: { request: vi.fn(), calls: [] } }));

const action = (endpointName, status, { args = {}, payload, kind = "mutation" } = {}) => ({
    type: `hubApi/execute${kind === "mutation" ? "Mutation" : "Query"}/${status}`,
    payload,
    meta: {
        arg: { endpointName, originalArgs: args, type: kind },
        requestId: "r1",
        requestStatus: status,
        ...(status === "rejected" ? { rejectedWithValue: true } : {}),
    },
});

describe("toastFor", () => {
    it("names the record in CRUD success messages", () => {
        expect(toastFor(action("create", "fulfilled", { args: { type: "levels" } }))).toMatchObject({ severity: "success", summary: "Level created" });
        expect(toastFor(action("remove", "rejected", { args: { type: "support_strategies" }, payload: { status: 403, message: "No" } }))).toMatchObject({ severity: "error", summary: "Couldn't delete support strategy", detail: "No" });
    });

    it("leaves kiosk success messages to the kiosk screens", () => {
        for (const endpoint of ["checkIn", "checkOut", "book", "submitCounsel", "requestLoan"]) {
            expect(toastFor(action(endpoint, "fulfilled"))).toBeNull();
        }
    });

    it("shows form validation and login errors inline instead of toasting", () => {
        expect(toastFor(action("create", "rejected", { args: { type: "levels" }, payload: { status: 422, message: "x" } }))).toBeNull();
        expect(toastFor(action("update", "rejected", { args: { type: "levels" }, payload: { status: 422, message: "x" } }))).toBeNull();
        expect(toastFor(action("login", "rejected", { payload: { status: 401, message: "Email or password is wrong." } }))).toBeNull();
        expect(toastFor(action("logout", "rejected", { payload: { status: 401 } }))).toBeNull();
    });

    it("still toasts a 422 from a kiosk action, which has no form to show it", () => {
        expect(toastFor(action("book", "rejected", { payload: { status: 422, message: "Bookings are closed" } }))).toEqual({ severity: "error", summary: "Couldn't book", detail: "Bookings are closed" });
    });

    it("flags an expired session", () => {
        expect(toastFor(action("list", "rejected", { kind: "query", args: { type: "users" }, payload: { status: 401, message: "Log in to continue." } }))).toMatchObject({ severity: "warn", summary: "Session expired", sessionExpired: true });
    });

    it("never toasts a successful load", () => {
        expect(toastFor(action("list", "fulfilled", { kind: "query", args: { type: "levels" } }))).toBeNull();
    });

    it("stays silent when the caller reports the outcome itself (bulk delete)", () => {
        expect(toastFor(action("remove", "fulfilled", { args: { type: "class", id: 1, silent: true } }))).toBeNull();
        expect(toastFor(action("remove", "rejected", { args: { type: "class", id: 1, silent: true }, payload: { status: 422, message: "x" } }))).toBeNull();
    });

    it("shows the import summary as the detail", () => {
        expect(toastFor(action("importRecords", "fulfilled", { args: { type: "activities" }, payload: { message: "1 added, 2 updated" } }))).toMatchObject({ summary: "Import finished", detail: "1 added, 2 updated" });
    });
});

describe("toast listener", () => {
    afterEach(() => {
        shownToasts.length = 0;
    });

    it("shows exactly one toast per action, and marks the session expired on 401", async () => {
        fakeApi({
            "post /api/levels": () => ok({ id: 1, name: "P1" }),
            "get /api/users": () => { throw httpError(401, { status: false, message: "Log in to continue." }); },
        });
        const store = makeStore();
        await store.dispatch(hubApi.endpoints.create.initiate({ type: "levels", data: { name: "P1" } }));
        await store.dispatch(hubApi.endpoints.list.initiate({ type: "users" }));
        await settle();

        expect(shownToasts.map((t) => [t.severity, t.summary, t.life])).toEqual([
            ["success", "Level created", 3000],
            ["warn", "Session expired", 5000],
        ]);
        expect(store.getState().global.app.sessionExpired).toBe(true);
    });
});
