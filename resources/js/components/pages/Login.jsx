import axios from "axios";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSignIn } from "react-auth-kit";
import { useDispatch } from "react-redux";
import { setStateData } from "../store/global-slice";
import { Card } from "primereact/card";
import { FloatLabel } from "primereact/floatlabel";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";

const Login = () => {
    const navigate = useNavigate();
    const signIn = useSignIn();
    const dispatch = useDispatch();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        dispatch(
            setStateData({
                key: "spinner",
                data: { show: true, text: "Logging in..." },
            })
        );
        try {
            const response = await axios.post("/api/login", {
                email,
                password,
            });
            setLoading(false);
            dispatch(
                setStateData({
                    key: "spinner",
                    data: { show: false, text: "" },
                })
            );
            if (response.data.status) {
                const { token, user } = response.data.result;
                signIn({
                    token,
                    expiresIn: 720, // minutes; matches the API token lifetime (config/sanctum.php)
                    tokenType: "Bearer",
                    authState: user,
                });
                if (
                    user.permissions.includes("dashboard view")
                ) {
                    navigate("/dashboard");
                } else if (
                    user.permissions.includes(
                        "dashboard-checkin view"
                    )
                ) {
                    navigate("/checkin");
                } else if (
                    user.permissions.includes(
                        "dashboard-bookings view"
                    )
                ) {
                    navigate("/facility-reservations");
                } else if (
                    user.permissions.includes(
                        "dashboard-counsels view"
                    )
                ) {
                    navigate("/counsels");
                } else {
                    navigate("/home");
                }
            }
        } catch (error) {
            setLoading(false);
            dispatch(
                setStateData({
                    key: "spinner",
                    data: { show: false, text: "" },
                })
            );
            const errorMsg =
                error.response?.data?.message ||
                "Can't reach the server. Check your connection and try again.";
            setError(errorMsg);
        }
    };

    const handleBack = () => {
        navigate("/home");
    };

    return (
        <div
            className="home-container with-color"
            // className="home-container with-background"
            style={{
                minHeight: "100vh",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            <div
                style={{
                    width: "80%",
                    maxWidth: "500px",
                    textAlign: "center",
                    position: "relative",
                }}
            >
                <Button
                    icon="pi pi-home"
                    rounded
                    onClick={handleBack}
                    style={{
                        position: "absolute",
                        top: "-15px",
                        left: "-15px",
                        width: "40px",
                        height: "40px",
                        padding: "0",
                    }}
                />
                <div className="card flex justify-center">
                    <Card title="Students-Hub" className="w-full">
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: "20px" }}>
                                <FloatLabel>
                                    <InputText
                                        id="email"
                                        style={{ width: "100%" }}
                                        type="email"
                                        value={email}
                                        onChange={(e) =>
                                            setEmail(e.target.value)
                                        }
                                        required
                                        disabled={loading}
                                    />
                                    <label htmlFor="email">Email</label>
                                </FloatLabel>
                            </div>
                            <div style={{ marginBottom: "20px" }}>
                                <FloatLabel>
                                    <InputText
                                        id="password"
                                        style={{ width: "100%" }}
                                        type="password"
                                        value={password}
                                        onChange={(e) =>
                                            setPassword(e.target.value)
                                        }
                                        required
                                        disabled={loading}
                                    />
                                    <label htmlFor="password">Password</label>
                                </FloatLabel>
                            </div>
                            {error && (
                                <p
                                    style={{
                                        color: "red",
                                        marginBottom: "20px",
                                    }}
                                >
                                    {error}
                                </p>
                            )}
                            <Button
                                label="Login"
                                type="submit"
                                disabled={loading}
                                style={{
                                    width: "100%",
                                    cursor: loading ? "not-allowed" : "pointer",
                                }}
                            />
                        </form>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Login;
