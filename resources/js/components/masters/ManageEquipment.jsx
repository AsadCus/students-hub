import React, { useMemo, useState } from "react";
import { useListQuery } from "../store/hub-api";
import { useSaveRecord } from "../store/use-save-record";
import Header from "../shared/layout/Header";
import DataTable from "../shared/misc/DataTable";
import { Card } from "primereact/card";
import { Dialog } from "primereact/dialog";
import { FloatLabel } from "primereact/floatlabel";
import { InputText } from "primereact/inputtext";
import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";

const EMPTY_CCA = { name: "", description: "", active: true };
const EMPTY_EQUIPMENT = {
    cca_id: null,
    name: "",
    code: "",
    quantity: 1,
    active: true,
};

/** CCAs, each expanding to the equipment it lends out. Same layout as Facilities. */
function ManageEquipment() {
    const { data: ccaList = [], isLoading: loadingCcas, refetch } = useListQuery({ type: "ccas" });
    const { data: equipment = [], isLoading: loadingEquipment } = useListQuery({ type: "equipment" });
    const ccaRecords = useSaveRecord("ccas");
    const equipmentRecords = useSaveRecord("equipment");
    const [dialog, setDialog] = useState(null); // "cca" | "equipment" | null
    const [editId, setEditId] = useState(null);
    const [ccaForm, setCcaForm] = useState(EMPTY_CCA);
    const [equipmentForm, setEquipmentForm] = useState(EMPTY_EQUIPMENT);
    const loadingData = loadingCcas || loadingEquipment;
    const loading = ccaRecords.saving || equipmentRecords.saving;
    const error = dialog === "cca" ? ccaRecords.error : equipmentRecords.error;

    const ccas = useMemo(
        () =>
            ccaList.map((c) => ({
                id: c.id,
                name: c.name,
                description: c.description,
                equipment: c.equipment?.length ?? 0,
                active: c.active ? "Yes" : "No",
            })),
        [ccaList]
    );

    const closeDialog = () => {
        setDialog(null);
        setEditId(null);
    };

    const openCca = (cca = null) => {
        setCcaForm(
            cca
                ? { name: cca.name, description: cca.description || "", active: cca.active === "Yes" }
                : EMPTY_CCA
        );
        setEditId(cca?.id ?? null);
        ccaRecords.setError("");
        setDialog("cca");
    };
    const handleAddCca = () => openCca();
    const handleEditCca = (id) => openCca(ccas.find((c) => c.id === id));

    const openEquipment = (item, ccaId = null) => {
        setEquipmentForm(
            item
                ? {
                      cca_id: item.cca_id,
                      name: item.name,
                      code: item.code || "",
                      quantity: item.quantity,
                      active: !!item.active,
                  }
                : { ...EMPTY_EQUIPMENT, cca_id: ccaId }
        );
        setEditId(item?.id ?? null);
        equipmentRecords.setError("");
        setDialog("equipment");
    };
    const handleAddEquipment = (ccaId) => openEquipment(null, ccaId);
    const handleEditEquipment = (id) => openEquipment(equipment.find((e) => e.id === id));
    const handleDeleteEquipment = (id) => equipmentRecords.remove(id);

    const submit = (records, form) => async (e) => {
        e.preventDefault();
        if (await records.save(editId, form)) closeDialog();
    };

    const ccaOptions = ccas.map((c) => ({ label: c.name, value: c.id }));
    const field = { marginBottom: "2rem" };
    const actions = (onCancel, isEdit) => (
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Button
                label="Cancel"
                icon="pi pi-times"
                type="button"
                onClick={onCancel}
                className="p-button-text"
                disabled={loading}
            />
            <Button
                label={isEdit ? "Update" : "Create"}
                icon="pi pi-check"
                type="submit"
                disabled={loading}
            />
        </div>
    );

    return (
        <div>
            <Header />
            <main
                className="admin-container with-color"
                style={{ padding: "20px" }}
            >
                <Card>
                    {loadingData ? (
                        <p>Please wait.</p>
                    ) : (
                        <>
                            <DataTable
                                type="ccas"
                                identifier="id"
                                hasExpand={true}
                                collection={ccas}
                                onFetch={refetch}
                                onAdd={handleAddCca}
                                onEdit={handleEditCca}
                                onDelete={ccaRecords.remove}
                                onAddEquipment={handleAddEquipment}
                                onEditEquipment={handleEditEquipment}
                                onDeleteEquipment={handleDeleteEquipment}
                                title="CCA Equipment"
                                equipment={equipment}
                            />

                            <Dialog
                                header={editId ? "Edit CCA" : "Add CCA"}
                                visible={dialog === "cca"}
                                style={{ width: "400px" }}
                                onHide={closeDialog}
                            >
                                <form className="mt-8" onSubmit={submit(ccaRecords, ccaForm)}>
                                    {error && (
                                        <p style={{ color: "red", marginBottom: "2rem" }}>
                                            {error}
                                        </p>
                                    )}
                                    <div style={field}>
                                        <FloatLabel>
                                            <InputText
                                                id="cca-name"
                                                value={ccaForm.name}
                                                onChange={(e) =>
                                                    setCcaForm({ ...ccaForm, name: e.target.value })
                                                }
                                                style={{ width: "100%" }}
                                                required
                                                disabled={loading}
                                            />
                                            <label htmlFor="cca-name">Name</label>
                                        </FloatLabel>
                                    </div>
                                    <div style={field}>
                                        <FloatLabel>
                                            <InputText
                                                id="cca-description"
                                                value={ccaForm.description}
                                                onChange={(e) =>
                                                    setCcaForm({ ...ccaForm, description: e.target.value })
                                                }
                                                style={{ width: "100%" }}
                                                disabled={loading}
                                            />
                                            <label htmlFor="cca-description">Description</label>
                                        </FloatLabel>
                                    </div>
                                    <div style={{ ...field, display: "flex", gap: "10px", alignItems: "center" }}>
                                        <InputSwitch
                                            inputId="cca-active"
                                            checked={ccaForm.active}
                                            onChange={(e) => setCcaForm({ ...ccaForm, active: e.value })}
                                            disabled={loading}
                                        />
                                        <label htmlFor="cca-active">Shown on the kiosk</label>
                                    </div>
                                    {actions(closeDialog, !!editId)}
                                </form>
                            </Dialog>

                            <Dialog
                                header={editId ? "Edit Equipment" : "Add Equipment"}
                                visible={dialog === "equipment"}
                                style={{ width: "400px" }}
                                onHide={closeDialog}
                            >
                                <form className="mt-8" onSubmit={submit(equipmentRecords, equipmentForm)}>
                                    {error && (
                                        <p style={{ color: "red", marginBottom: "2rem" }}>
                                            {error}
                                        </p>
                                    )}
                                    <div style={field}>
                                        <FloatLabel>
                                            <Dropdown
                                                inputId="equipment-cca"
                                                value={equipmentForm.cca_id}
                                                options={ccaOptions}
                                                onChange={(e) =>
                                                    setEquipmentForm({ ...equipmentForm, cca_id: e.value })
                                                }
                                                style={{ width: "100%" }}
                                                required
                                                disabled={loading}
                                            />
                                            <label htmlFor="equipment-cca">CCA</label>
                                        </FloatLabel>
                                    </div>
                                    <div style={field}>
                                        <FloatLabel>
                                            <InputText
                                                id="equipment-name"
                                                value={equipmentForm.name}
                                                onChange={(e) =>
                                                    setEquipmentForm({ ...equipmentForm, name: e.target.value })
                                                }
                                                style={{ width: "100%" }}
                                                required
                                                disabled={loading}
                                            />
                                            <label htmlFor="equipment-name">Name</label>
                                        </FloatLabel>
                                    </div>
                                    <div style={field}>
                                        <FloatLabel>
                                            <InputText
                                                id="equipment-code"
                                                value={equipmentForm.code}
                                                onChange={(e) =>
                                                    setEquipmentForm({ ...equipmentForm, code: e.target.value })
                                                }
                                                style={{ width: "100%" }}
                                                disabled={loading}
                                            />
                                            <label htmlFor="equipment-code">Code (optional)</label>
                                        </FloatLabel>
                                    </div>
                                    <div style={field}>
                                        <FloatLabel>
                                            <InputNumber
                                                inputId="equipment-quantity"
                                                value={equipmentForm.quantity}
                                                onValueChange={(e) =>
                                                    setEquipmentForm({ ...equipmentForm, quantity: e.value })
                                                }
                                                min={1}
                                                showButtons
                                                style={{ width: "100%" }}
                                                required
                                                disabled={loading}
                                            />
                                            <label htmlFor="equipment-quantity">Units available</label>
                                        </FloatLabel>
                                    </div>
                                    <div style={{ ...field, display: "flex", gap: "10px", alignItems: "center" }}>
                                        <InputSwitch
                                            inputId="equipment-active"
                                            checked={equipmentForm.active}
                                            onChange={(e) =>
                                                setEquipmentForm({ ...equipmentForm, active: e.value })
                                            }
                                            disabled={loading}
                                        />
                                        <label htmlFor="equipment-active">Available for loan</label>
                                    </div>
                                    {actions(closeDialog, !!editId)}
                                </form>
                            </Dialog>
                        </>
                    )}
                </Card>
            </main>
        </div>
    );
}

export default ManageEquipment;
