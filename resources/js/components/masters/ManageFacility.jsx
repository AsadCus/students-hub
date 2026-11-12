import React, { useMemo, useState } from "react";
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

const EMPTY = { name: "", parent_id: null };
const tooltip = { position: "bottom", mouseTrack: true, mouseTrackTop: 15 };

/** Facilities (locations) that expand to their sub-facilities (rooms). */
function ManageFacility() {
    const { data: facilities = [], isLoading, refetch } = useListQuery({ type: "facilities" });
    const { save, remove, removeMany, saving, error, setError } = useSaveRecord("facilities");
    const [visible, setVisible] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState(EMPTY);

    const parents = useMemo(
        () => facilities.filter((f) => !f.parent_id).map((f) => ({ id: f.id, name: f.name })),
        [facilities]
    );
    const subFacilities = useMemo(
        () =>
            facilities
                .filter((f) => f.parent_id)
                .map((f) => ({ id: f.id, name: f.name, parent_id: f.parent_id })),
        [facilities]
    );
    const parentOptions = parents.map((f) => ({ label: f.name, value: f.id }));

    const openForm = (facility = null) => {
        setEditId(facility?.id ?? null);
        setFormData(facility ? { name: facility.name, parent_id: facility.parent_id ?? null } : EMPTY);
        setError("");
        setVisible(true);
    };
    const handleEdit = (id) => openForm(facilities.find((f) => f.id === id));

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
                    {isLoading ? (
                        <p>Please wait.</p>
                    ) : (
                        <>
                            <DataTable
                                type="facilities"
                                identifier="id"
                                hasExpand={true}
                                hasImport={true}
                                collection={parents}
                                onFetch={refetch}
                                onAdd={() => openForm()}
                                onEdit={handleEdit}
                                onEditSubFacility={handleEdit}
                                onDelete={remove}
                                onDeleteMany={removeMany}
                                title="Facility"
                                subFacilities={subFacilities}
                            />
                            <Dialog
                                header={editId ? "Edit Facility" : "Add Facility"}
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
                                            <InputText
                                                id="name"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                style={{ width: "100%" }}
                                                required
                                                disabled={saving}
                                                tooltip="Enter facility name"
                                                tooltipOptions={tooltip}
                                            />
                                            <label htmlFor="name">Name</label>
                                        </FloatLabel>
                                    </div>
                                    <div style={{ marginBottom: "2rem" }}>
                                        <FloatLabel>
                                            <Dropdown
                                                inputId="parent_id"
                                                value={formData.parent_id}
                                                options={parentOptions.filter((o) => o.value !== editId)}
                                                onChange={(e) => setFormData({ ...formData, parent_id: e.value ?? null })}
                                                style={{ width: "100%" }}
                                                placeholder="Select Parent Facility"
                                                disabled={saving}
                                                tooltip="Select parent facility (optional)"
                                                tooltipOptions={tooltip}
                                                showClear
                                            />
                                            <label htmlFor="parent_id">Parent Facility</label>
                                        </FloatLabel>
                                    </div>
                                    <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
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
                    )}
                </Card>
            </main>
        </div>
    );
}

export default ManageFacility;
