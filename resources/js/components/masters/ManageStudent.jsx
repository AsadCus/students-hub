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
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";

const EMPTY = { class_id: null, name: "" };

function ManageStudent() {
    const isAuthenticated = useIsAuthenticated();
    const { data: records = [], refetch } = useListQuery({ type: "students" });
    const { data: classes = [] } = useListQuery({ type: "class" });
    const { save, remove, saving, error, setError } = useSaveRecord("students");
    const [visible, setVisible] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState(EMPTY);
    const set = (name, value) => setFormData((prev) => ({ ...prev, [name]: value }));

    const rows = useMemo(
        () =>
            records.map((r) => (({
                id: r.id,
                class: r.class?.name || "N/A",
                name: r.name,
                class_id: r.class_id,
                created_at: r.created_at,
                updated_at: r.updated_at,
            }))),
        [records]
    );

    const classOptions = classes.map((c) => ({ label: c.name, value: c.id }));

    const openForm = (record = null) => {
        setEditId(record?.id ?? null);
        setFormData(record ? { class_id: record.class_id, name: record.name } : EMPTY);
        setError("");
        setVisible(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (await save(editId, formData)) setVisible(false);
    };

    const tooltip = { position: "bottom", mouseTrack: true, mouseTrackTop: 15 };

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
                                type="students"
                                identifier="id"
                                hasImport={true}
                                collection={rows}
                                onFetch={refetch}
                                onAdd={() => openForm()}
                                onEdit={(id) => openForm(records.find((r) => r.id === id))}
                                onDelete={remove}
                                title="Student"
                            />
                            <Dialog
                                header={editId ? "Edit Student" : "Add Student"}
                                visible={visible}
                                style={{ width: "400px" }}
                                onHide={() => setVisible(false)}
                            >
                                <form onSubmit={handleSubmit} className="mt-8">
                                    {error && (
                                        <p style={{ color: "red", marginBottom: "2rem" }}>
                                            {error}
                                        </p>
                                    )}
                                    <div style={{ marginBottom: "2rem" }}>
                                        <FloatLabel>
                                            <Dropdown
                                                inputId="class_id"
                                                value={formData.class_id}
                                                options={classOptions}
                                                onChange={(e) => set("class_id", e.value)}
                                                filter
                                                style={{ width: "100%" }}
                                                required
                                                checkmark={true}
                                                disabled={saving}
                                                placeholder="Select a class"
                                                tooltip="Select class"
                                                tooltipOptions={tooltip}
                                            />
                                            <label htmlFor="class_id">Class</label>
                                        </FloatLabel>
                                    </div>
                                    <div style={{ marginBottom: "2rem" }}>
                                        <FloatLabel>
                                            <InputText
                                                id="name"
                                                value={formData.name ?? ""}
                                                onChange={(e) => set("name", e.target.value)}
                                                style={{ width: "100%" }}
                                                required
                                                disabled={saving}
                                                tooltip="Enter student name"
                                                tooltipOptions={tooltip}
                                            />
                                            <label htmlFor="name">Name</label>
                                        </FloatLabel>
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
                                            disabled={saving}
                                        />
                                        <Button
                                            label={editId ? "Update" : "Create"}
                                            icon="pi pi-check"
                                            type="submit"
                                            disabled={saving}
                                            autoFocus
                                        />
                                    </div>
                                </form>
                            </Dialog>
                        </>
                    ) : (
                        <p>Please log in to view and manage students.</p>
                    )}
                </Card>
            </main>
        </div>
    );
}

export default ManageStudent;
