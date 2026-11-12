import React, { useMemo, useState } from "react";
import { useIsAuthenticated } from "react-auth-kit";
import { useListQuery } from "../store/hub-api";
import { useSaveRecord } from "../store/use-save-record";
import Header from "../shared/layout/Header";
import DataTable from "../shared/misc/DataTable";
import { Card } from "primereact/card";
import { Dialog } from "primereact/dialog";
import { FloatLabel } from "primereact/floatlabel";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";

const EMPTY = { name: "", email: "", password: "", access: "" };

function ManageUser() {
    const isAuthenticated = useIsAuthenticated();
    const { data: users = [], refetch: myFetch } = useListQuery({ type: "users" });
    const { save, remove, saving: loading, error, setError } = useSaveRecord("users");
    const [visible, setVisible] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState(EMPTY);
    const mode = editId ? "edit" : "create";

    const rows = useMemo(
        () =>
            users.map((u) => ({
                id: u.id,
                name: u.name || "N/A",
                email: u.email || "N/A",
                role: u.roles?.[0]?.name,
                created_at: u.created_at,
                updated_at: u.updated_at,
            })),
        [users]
    );

    const openForm = (user = null) => {
        setEditId(user?.id ?? null);
        setFormData(
            user
                ? { name: user.name, email: user.email, password: "", access: user.role }
                : EMPTY
        );
        setError("");
        setVisible(true);
    };
    const handleAdd = () => openForm();
    const handleEdit = (id) => openForm(rows.find((u) => u.id === id));

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.access) {
            setError("Pick a role for this user.");
            return;
        }
        if (await save(editId, formData)) setVisible(false);
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
                                collection={rows}
                                onFetch={myFetch}
                                onAdd={handleAdd}
                                onEdit={handleEdit}
                                onDelete={remove}
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
                                                Pick one of the roles below.
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
