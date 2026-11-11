import "./bootstrap";
import "../css/app.css";

import { PrimeReactProvider } from "primereact/api";
import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
    useNavigate,
} from "react-router-dom";
import {
    AuthProvider,
    useAuthUser,
    useSignOut,
} from "react-auth-kit";
import { Provider, useSelector, useDispatch } from "react-redux";
import { store } from "./components/store";
import { ProgressSpinner } from "primereact/progressspinner";
import { Toast } from "primereact/toast";
import { setStateData } from "./components/store/global-slice";
import api from "./components/api";
import { stateKey } from "./components/utils/constants";
import Login from "./components/pages/Login";
import Home from "./components/pages/Home";
import About from "./components/pages/About";
import ManageUser from "./components/masters/ManageUser";
import NotFound from "./components/pages/NotFound";
import ManageClass from "./components/masters/ManageClass";
import ManageLevel from "./components/masters/ManageLevel";
import ManageActivity from "./components/masters/ManageActivity";
import ManageFacility from "./components/masters/ManageFacility";
import ManageStudent from "./components/masters/ManageStudent";
import Checkin from "./components/masters/reports/Checkin";
import Dashboard from "./components/pages/Dashboard";
import FacilityReservations from "./components/masters/reports/FacilityReservations";
import Counsel from "./components/masters/reports/Counsel";
import ManageSupportAndQuestions from "./components/masters/ManageSupportAndQuestions";
import ManageLevelClassStudent from "./components/masters/ManageLevelClassStudent";

const PrivateRoute = ({ element, permission, loginRequired }) => {
    const auth = useAuthUser();
    const permissions = auth()?.permissions || [];

    if (loginRequired && !auth()) {
        return <Navigate to="/login" replace />;
    }

    if (!loginRequired) {
        return element;
    }

    if (permission) {
        const requiredPermissions = Array.isArray(permission)
            ? permission
            : [permission];

        const hasPermission = requiredPermissions.some((p) =>
            permissions.includes(p)
        );

        if (!hasPermission) {
            return <Navigate to="/home" replace />;
        }
    }

    return element;
};

const AppWrapper = () => {
    const auth = useAuthUser();
    const [loginRequired, setLoginRequired] = useState(false);
    const signOut = useSignOut();
    const { spinner, toastMessage, sessionExpired } = useSelector(
        (state) => state.global[stateKey.app]
    );
    const dispatch = useDispatch();
    const toast = useRef(null);
    const navigate = useNavigate();

    // Set by global-slice on any 401. Thunks can't use auth hooks, so the redirect lives here.
    useEffect(() => {
        if (!sessionExpired) return;
        dispatch(setStateData({ key: "sessionExpired", data: false, isMerge: false }));
        if (auth()) {
            // ponytail: anonymous kiosk users only see the toast, no redirect
            signOut();
            navigate("/login");
        }
    }, [sessionExpired]);

    useEffect(() => {
        if (toastMessage) {
            toast.current.show(toastMessage);
        }
    }, [toastMessage]);

    useEffect(() => {
        const fetchLoginRequired = async () => {
            try {
                const res = await api.get("api/settings/login-required");
                const enabled = !!res?.data?.result?.login_required;
                setLoginRequired(enabled);
            } catch (e) {
                // ignore toggle fetch error, do not block app
            }
        };
        fetchLoginRequired();
    }, [auth()]);

    const protectedRoutes = [
        {
            path: "/dashboard",
            element: <Dashboard />,
            permission: ["dashboard view", "dashboard-bookings view"],
        },
        { path: "/users", element: <ManageUser />, permission: "users view" },
        { path: "/class", element: <ManageClass />, permission: "class view" },
        {
            path: "/levels-class-students",
            element: <ManageLevelClassStudent />,
            permission: "levels view",
        },
        {
            path: "/levels",
            element: <ManageLevel />,
            permission: "levels view",
        },
        {
            path: "/activities",
            element: <ManageActivity />,
            permission: "activities view",
        },
        {
            path: "/students",
            element: <ManageStudent />,
            permission: "students view",
        },
        {
            path: "/facilities",
            element: <ManageFacility />,
            permission: "facilities view",
        },
        {
            path: "/questions",
            element: <ManageSupportAndQuestions />,
            permission: "questions view",
        },
        { path: "/checkin", element: <Checkin />, permission: "checkin view" },
        {
            path: "/facility-reservations",
            element: <FacilityReservations />,
            permission: "bookings view",
        },
        {
            path: "/counsels",
            element: <Counsel />,
            permission: "counsels view",
        },
    ];

    return (
        <>
            <Toast ref={toast} />
            {spinner.show && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: "100vw",
                        height: "100vh",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        zIndex: 9999,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            textWrap: "wrap",
                        }}
                    >
                        <ProgressSpinner />
                        <span
                            style={{
                                marginTop: "10px",
                                color: "white",
                                textAlign: "center",
                            }}
                        >
                            {spinner.text}
                        </span>
                    </div>
                </div>
            )}
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                    path="/"
                    element={
                        <PrivateRoute
                            element={<Home />}
                            loginRequired={loginRequired}
                        />
                    }
                />
                <Route
                    path="/home"
                    element={
                        <PrivateRoute
                            element={<Home />}
                            loginRequired={loginRequired}
                        />
                    }
                />
                <Route path="/about" element={<About />} />
                {protectedRoutes.map(({ path, element, permission }) => (
                    <Route
                        key={path}
                        path={path}
                        element={
                            <PrivateRoute
                                element={element}
                                permission={permission}
                                loginRequired={loginRequired}
                            />
                        }
                    />
                ))}
                <Route path="/*" element={<NotFound />} />
            </Routes>
        </>
    );
};

const App = () => (
    <PrimeReactProvider>
        <Provider store={store}>
            <AuthProvider
                authType="cookie"
                authName="_auth"
                cookieDomain={window.location.hostname}
                cookieSecure={window.location.protocol === "https:"}
            >
                <BrowserRouter>
                    <AppWrapper />
                </BrowserRouter>
            </AuthProvider>
        </Provider>
    </PrimeReactProvider>
);

const root = createRoot(document.getElementById("app"));
root.render(<App />);
