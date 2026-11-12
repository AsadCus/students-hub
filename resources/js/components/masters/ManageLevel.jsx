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

const EMPTY = { name: "" };

function ManageLevel() {
    const isAuthenticated = useIsAuthenticated();
    const { data: levels = [], refetch } = useListQuery({ type: "levels" });
    const { save, remove, saving, error, setError } = useSaveRecord("levels");
    const [visible, setVisible] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState(EMPTY);

    const rows = useMemo(
        () =>
            levels.map((l) => ({
                id: l.id,
                name: l.name,
                created_at: l.created_at,
                updated_at: l.updated_at,
            })),
        [levels]
    );

    const openForm = (level = null) => {
        setEditId(level?.id ?? null);
        setFormData(level ? { name: level.name } : EMPTY);
        setError("");
        setVisible(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
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
                                type="levels"
                                identifier="id"
                                hasImport={true}
                                collection={rows}
                                onFetch={refetch}
                                onAdd={() => openForm()}
                                onEdit={(id) => openForm(levels.find((l) => l.id === id))}
                                onDelete={remove}
                                title="Level"
                            />
                            <Dialog
                                header={editId ? "Edit Level" : "Add Level"}
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
                                                id="name"
                                                name="name"
                                                value={formData.name}
                                                onChange={(e) =>
                                                    setFormData({ name: e.target.value })
                                                }
                                                style={{ width: "100%" }}
                                                required
                                                disabled={saving}
                                                tooltip="Enter level name"
                                                tooltipOptions={{
                                                    position: "bottom",
                                                    mouseTrack: true,
                                                    mouseTrackTop: 15,
                                                }}
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
                        <p>Please log in to view and manage levels.</p>
                    )}
                </Card>
            </main>
        </div>
    );
}

export default ManageLevel;
