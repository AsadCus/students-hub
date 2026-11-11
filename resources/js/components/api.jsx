import axios from "axios";

const api = axios.create({
    // ponytail: SPA is served by Laravel itself, so the API is always same-origin
    baseURL: window.location.origin,
    withCredentials: true,
});

api.get("/sanctum/csrf-cookie").catch((err) =>
    console.error("CSRF Error:", err)
);

const readCookie = (name) => {
    const entry = document.cookie
        .split("; ")
        .find((c) => c.startsWith(`${name}=`));
    return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
};

// Read the token react-auth-kit stores (_auth / _auth_type cookies) on every
// request. Attaching it from a useEffect in app.jsx was too late: child pages
// run their effects first, so their first request on a page load had no token.
api.interceptors.request.use((config) => {
    const token = readCookie("_auth");
    if (token) {
        config.headers.Authorization = `${readCookie("_auth_type") || "Bearer"} ${token}`;
    }
    return config;
});

export default api;
