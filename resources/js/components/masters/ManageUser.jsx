import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useIsAuthenticated } from "react-auth-kit";
import {
    getRecords,
    createRecord,
    updateRecord,
    setStateData,
} from "../store/global-slice";
import Header from "../shared/layout/Header";
import DataTable from "../shared/misc/DataTable";
import { Card } from "primereact/card";
import { Dialog } from "primereact/dialog";
import { FloatLabel } from "primereact/floatlabel";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";

function ManageUser() {
    const dispatch = useDispatch();
    const isAuthenticated = useIsAuthenticated();
    const [visible, setVisible] = useState(false);
    const [mode, setMode] = useState("create");
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        access: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const {
        users: { data: users = [], endPoints: userEndPoints },
    } = useSelector((state) => state.global);

    const myFetch = () => {
        dispatch(
            getRecords({
                type: "users",
                endPoint: userEndPoints.collection,
                key: "data",
            })
        ).then((d) => {
            const formattedUser = d.map((i) => ({
                id: i.id,
                name: i.name || "N/A",
                email: i.email || "N/A",
                role: i.roles[0]?.name,
                created_at: i.created_at,
                updated_at: i.updated_at,
            }));
            dispatch(
                setStateData({
                    type: "users",
                    data: formattedUser,
                    key: "data",
                    isMerge: false,
                })
            );
        });
    };

    useEffect(() => {
        myFetch();
    }, [dispatch]);

    const handleEdit = (id) => {
        const user = users.find((u) => u.id === id);
        if (user) {
            setFormData({
                name: user.name,
                email: user.email,
                password: "",
                access: user.role,
            });
            setEditId(id);
            setMode("edit");
            setVisible(true);
        }
    };

    const handleAdd = () => {
        setMode("create");
        setFormData({ name: "", email: "", password: "", access: "" });
        setVisible(true);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.access) {
            setError("Access type is required.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            if (mode === "create") {
                dispatch(
                    createRecord({
                        type: "users",
                        endPoint: userEndPoints.store,
                        data: formData,
                    })
                ).then((success) => {
                    if (success) {
                        setFormData({
                            name: "",
                            email: "",
                            password: "",
                            access: "",
                        });
                        myFetch();
                        setVisible(false);
                    }
                });
            } else {
                dispatch(
                    updateRecord({
                        type: "users",
                        endPoint: `${userEndPoints.update}${editId}`,
                        data: formData,
                    })
                ).then((success) => {
                    if (success) {
                        setFormData({
                            name: "",
                            email: "",
                            password: "",
                            access: "",
                        });
                        myFetch();
                        setVisible(false);
                    }
                });
            }
        } catch (err) {
            setError(err.message || "Operation failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <Header />
            <main
                className="admin-container with-color"
                style={{ padding: "20px" }}
            >
                <Card>
                    {isAuthenticated() ? (
                        <>
                            <DataTable
                                type="users"
                                identifier="id"
                                hasImport={true}
                                onFetch={myFetch}
                                onAdd={handleAdd}
                                onEdit={handleEdit}
                                title="User"
                            />
                            <Dialog
                                header={
                                    mode === "create" ? `Add User` : `Edit User`
                                }
                                visible={visible}
                                style={{ width: "400px" }}
                                onHide={() => setVisible(false)}
                            >
                                <form onSubmit={handleSubmit} className="mt-8">
                                    {error && (
                                        <p
                                            style={{
                                                color: "red",
                                                marginBottom: "2rem",
                                            }}
                                        >
                                            {error}
                                        </p>
                                    )}
                                    <div style={{ marginBottom: "2rem" }}>
                                        <FloatLabel>
                                            <InputText
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                style={{ width: "100%" }}
                                                required
                                                disabled={loading}
                                                tooltip="Enter user name"
                                                tooltipOptions={{
                                                    position: "bottom",
                                                    mouseTrack: true,
                                                    mouseTrackTop: 15,
                                                }}
                                            />
                                            <label htmlFor="name">Name</label>
                                        </FloatLabel>
                                    </div>
                                    <div style={{ marginBottom: "2rem" }}>
                                        <FloatLabel>
                                            <InputText
                                                name="email"
                                                value={formData.email}
                                                onChange={handleChange}
                                                type="email"
                                                style={{ width: "100%" }}
                                                required
                                                disabled={loading}
                                                tooltip="Enter user email"
                                                tooltipOptions={{
                                                    position: "bottom",
                                                    mouseTrack: true,
                                                    mouseTrackTop: 15,
                                                }}
                                            />
                                            <label htmlFor="email">Email</label>
                                        </FloatLabel>
                                    </div>
                                    <div style={{ marginBottom: "2rem" }}>
                                        <FloatLabel>
                                            <InputText
                                                name="password"
                                                value={formData.password}
                                                onChange={handleChange}
                                                type="password"
                                                style={{ width: "100%" }}
                                                required={mode === "create"}
                                                minLength={8}
                                                disabled={loading}
                                                tooltip={
                                                    mode === "create"
                                                        ? "At least 8 characters"
                                                        : "Leave blank to keep the current password"
                                                }
                                                tooltipOptions={{
                                                    position: "bottom",
                                                    mouseTrack: true,
                                                    mouseTrackTop: 15,
                                                }}
                                            />
                                            <label htmlFor="password">
                                                {mode === "create"
                                                    ? "Password"
                                                    : "New password (optional)"}
                                            </label>
                                        </FloatLabel>
                                    </div>
                                    <div style={{ marginBottom: "2rem" }}>
                                        <label
                                            style={{
                                                fontWeight: "bold",
                                                display: "block",
                                                marginBottom: "0.5rem",
                                            }}
                                        >
                                            Access Type
                                        </label>
                                        {!formData.access && error && (
                                            <small style={{ color: "red" }}>
                                                Pick one of this access below.
                                            </small>
                                        )}
                                        <div
                                            style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: "0.5rem",
                                            }}
                                        >
                                            {[
                                                "Superadmin",
                                                "Checkin",
                                                "Booking",
                                                "Counsel",
                                            ].map((type) => (
                                                <div
                                                    key={type}
                                                    className="flex align-items-center"
                                                >
                                                    <Checkbox
                                                        inputId={type}
                                                        name="access"
                                                        value={type}
                                                        onChange={(e) => {
                                                            setFormData({
                                                                ...formData,
                                                                access: e.value,
                                                            });
                                                        }}
                                                        checked={
                                                            formData.access ==
                                                            type
                                                        }
                                                        disabled={loading}
                                                    />
                                                    <label
                                                        htmlFor={type}
                                                        className="ml-2"
                                                    >
                                                        {type}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            gap: "10px",
                                            justifyContent: "flex-end",
                                        }}
                                    >
                                        <Button
                                            label="Cancel"
                                            icon="pi pi-times"
                                            type="button"
                                            onClick={() => setVisible(false)}
                                            className="p-button-text"
                                            disabled={loading}
                                        />
                                        <Button
                                            label={
                                                mode === "create"
                                                    ? "Create"
                                                    : "Update"
                                            }
                                            icon="pi pi-check"
                                            type="submit"
                                            disabled={loading}
                                            autoFocus
                                        />
                                    </div>
                                </form>
                            </Dialog>
                        </>
                    ) : (
                        <p>Please log in to view and manage users.</p>
                    )}
                </Card>
            </main>
        </div>
    );
}

export default ManageUser;
