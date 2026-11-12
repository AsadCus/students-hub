// Shared helpers for store tests: a real store with hubApi and the toast
// listener, a fake axios instance (vi.mock'd in each test file), and a toast
// host that records what was shown.
import { configureStore } from "@reduxjs/toolkit";
import api from "../../api";
import { hubApi } from "../hub-api";
import { apiToasts } from "../api-toasts";
import { globalReducer } from "../global-slice";
import { bindToast } from "../../utils/notify";

export const shownToasts = [];
bindToast({ show: (t) => shownToasts.push(t), clear: () => {} });

export const makeStore = () =>
    configureStore({
        reducer: { global: globalReducer, [hubApi.reducerPath]: hubApi.reducer },
        middleware: (getDefault) =>
            getDefault().prepend(apiToasts.middleware).concat(hubApi.middleware),
    });

/** Route fake API calls: routes["get /api/levels"] = (cfg) => response | throw. */
export const fakeApi = (routes) => {
    api.calls = [];
    api.request = async (cfg) => {
        api.calls.push(cfg);
        const handler = routes[`${cfg.method || "get"} ${cfg.url}`];
        if (!handler) throw new Error("Network Error");
        return handler(cfg);
    };
    return api;
};

export const ok = (result, message = "OK") => ({ data: { status: true, message, result } });
export const httpError = (status, data) =>
    Object.assign(new Error("Request failed"), { response: { status, data } });

export const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
