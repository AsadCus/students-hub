import { afterEach, describe, expect, it, vi } from "vitest";
import { hubApi } from "../hub-api";
import { fakeApi, httpError, makeStore, ok, settle, shownToasts } from "./test-store";

vi.mock("../../api", () => ({ default: { request: vi.fn(), calls: [] } }));

const gets = (api, url) => api.calls.filter((c) => (c.method || "get") === "get" && c.url === url).length;

describe("hubApi", () => {
    afterEach(() => {
        shownToasts.length = 0;
    });

    it("resolves lists to the response result", async () => {
        fakeApi({ "get /api/levels": () => ok([{ id: 1, name: "Primary 1" }]) });
        const store = makeStore();
        const { data } = await store.dispatch(hubApi.endpoints.list.initiate({ type: "levels" }));
        expect(data).toEqual([{ id: 1, name: "Primary 1" }]);
    });

    it("treats an empty list response as []", async () => {
        fakeApi({ "get /api/levels": () => ({ data: { status: true, message: "No records found" } }) });
        const { data } = await makeStore().dispatch(hubApi.endpoints.list.initiate({ type: "levels" }));
        expect(data).toEqual([]);
    });

    it("refreshes the saved type and related lists, not unrelated ones", async () => {
        let levels = [{ id: 1, name: "Primary 1" }];
        const api = fakeApi({
            "get /api/levels": () => ok(levels),
            "get /api/class": () => ok([]),
            "get /api/users": () => ok([]),
            "post /api/levels": (cfg) => {
                levels = [...levels, { id: 2, ...cfg.data }];
                return ok(levels[1], "Level created");
            },
        });
        const store = makeStore();
        const subs = ["levels", "class", "users"].map((type) => store.dispatch(hubApi.endpoints.list.initiate({ type })));
        await settle();
        const before = { levels: gets(api, "/api/levels"), class: gets(api, "/api/class"), users: gets(api, "/api/users") };

        const created = await store.dispatch(hubApi.endpoints.create.initiate({ type: "levels", data: { name: "Primary 2" } })).unwrap();
        await settle();

        expect(created).toEqual({ id: 2, name: "Primary 2" });
        expect(gets(api, "/api/levels")).toBe(before.levels + 1);
        expect(gets(api, "/api/class")).toBe(before.class + 1); // a class row shows its level
        expect(gets(api, "/api/users")).toBe(before.users);
        expect(hubApi.endpoints.list.select({ type: "levels" })(store.getState()).data).toHaveLength(2);
        subs.forEach((s) => s.unsubscribe());
    });

    it("rejects with {status, message, fieldErrors} for validation errors", async () => {
        fakeApi({
            "post /api/levels": () => {
                throw httpError(422, { status: false, message: "The name has already been taken.", errors: { name: ["The name has already been taken."] } });
            },
        });
        await expect(
            makeStore().dispatch(hubApi.endpoints.create.initiate({ type: "levels", data: { name: "Primary 1" } })).unwrap()
        ).rejects.toEqual({ status: 422, message: "The name has already been taken.", fieldErrors: { name: ["The name has already been taken."] } });
    });

    it("keeps the server's message for a failed login", async () => {
        fakeApi({ "post /api/login": () => { throw httpError(401, { status: false, message: "Email or password is wrong." }); } });
        await expect(
            makeStore().dispatch(hubApi.endpoints.login.initiate({ email: "a@b.c", password: "x" })).unwrap()
        ).rejects.toMatchObject({ status: 401, message: "Email or password is wrong." });
    });

    it("treats status:false on a 2xx as a failure, and a dead server as unreachable", async () => {
        fakeApi({ "post /api/booking": () => ({ data: { status: false, message: "Soft failure" } }) });
        const store = makeStore();
        await expect(store.dispatch(hubApi.endpoints.book.initiate({})).unwrap()).rejects.toMatchObject({ message: "Soft failure" });
        await expect(store.dispatch(hubApi.endpoints.checkIn.initiate({})).unwrap()).rejects.toMatchObject({ status: null, message: expect.stringMatching(/Can't reach the server/) });
    });

    it("sends student_id when a kiosk cancels, and nothing extra for staff", async () => {
        const api = fakeApi({ "put /api/booking-cancel/7": () => ok({ id: 7, status: "cancelled" }) });
        const store = makeStore();
        await store.dispatch(hubApi.endpoints.cancelBooking.initiate({ id: 7, studentId: 938 })).unwrap();
        await store.dispatch(hubApi.endpoints.cancelBooking.initiate({ id: 7 })).unwrap();
        expect(api.calls.map((c) => c.data)).toEqual([{ student_id: 938 }, {}]);
    });
});
