import { configureStore } from "@reduxjs/toolkit";
import { globalReducer } from "./global-slice";
import { hubApi } from "./hub-api";
import { apiToasts } from "./api-toasts";

export const store = configureStore({
    reducer: {
        global: globalReducer, // legacy pages; removed once every page uses hubApi
        [hubApi.reducerPath]: hubApi.reducer,
    },
    middleware: (getDefault) =>
        getDefault().prepend(apiToasts.middleware).concat(hubApi.middleware),
});
