// The app's single toast. app.jsx mounts one PrimeReact <Toast> and binds it
// here; everything else calls notify.*.
//
// Copy rules: English; the summary says what happened in 2-4 words ("Level
// created", "Couldn't save level"); the detail only when it adds something
// (the server's message). Never "Success"/"Error" as a summary.

const LIFE = { success: 3000, info: 4000, warn: 5000, error: 6000 };

let host = null;

export const bindToast = (toast) => {
    host = toast;
};

const show = (severity) => (summary, detail) => {
    if (!host) return;
    host.show({ severity, summary, ...(detail ? { detail } : {}), life: LIFE[severity] });
};

export const notify = {
    success: show("success"),
    info: show("info"),
    warn: show("warn"),
    error: show("error"),
    clear: () => host?.clear(),
};
