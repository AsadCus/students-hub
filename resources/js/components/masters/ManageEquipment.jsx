import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    getRecords,
    createRecord,
    updateRecord,
    deleteRecord,
    setStateData,
} from "../store/global-slice";
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
    const dispatch = useDispatch();
    const [dialog, setDialog] = useState(null); // "cca" | "equipment" | null
    const [editId, setEditId] = useState(null);
    const [ccaForm, setCcaForm] = useState(EMPTY_CCA);
    const [equipmentForm, setEquipmentForm] = useState(EMPTY_EQUIPMENT);
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(true);
    const [error, setError] = useState("");
    const {
        ccas: { data: ccas = [], endPoints: ccaEndPoints },
        equipment: { data: equipment = [], endPoints: equipmentEndPoints },
    } = useSelector((state) => state.global);

    const myFetch = () => {
        Promise.all([
            dispatch(
                getRecords({
                    type: "ccas",
                    endPoint: ccaEndPoints.collection,
                })
            ),
            dispatch(
                getRecords({
                    type: "equipment",
                    endPoint: equipmentEndPoints.collection,
                })
            ),
        ])
            .then(([ccaRows, equipmentRows]) => {
                dispatch(
                    setStateData({
                        type: "ccas",
                        key: "data",
                        isMerge: false,
                        data: ccaRows.map((c) => ({
                            id: c.id,
                            name: c.name,
                            description: c.description,
                            equipment: c.equipment?.length ?? 0,
                            active: c.active ? "Yes" : "No",
                        })),
                    })
                );
                dispatch(
                    setStateData({
                        type: "equipment",
                        key: "data",
                        isMerge: false,
                        data: equipmentRows,
                    })
                );
            })
            .finally(() => setLoadingData(false));
    };

    useEffect(() => {
        myFetch();
    }, [dispatch]);

    const closeDialog = () => {
        setDialog(null);
        setEditId(null);
        setError("");
    };

    const handleAddCca = () => {
        setCcaForm(EMPTY_CCA);
        setEditId(null);
        setDialog("cca");
    };

    const handleEditCca = (id) => {
        const cca = ccas.find((c) => c.id === id);
        if (!cca) return;
        setCcaForm({
            name: cca.name,
            description: cca.description || "",
            active: cca.active === "Yes",
        });
        setEditId(id);
        setDialog("cca");
    };

    const handleAddEquipment = (ccaId) => {
        setEquipmentForm({ ...EMPTY_EQUIPMENT, cca_id: ccaId });
        setEditId(null);
        setDialog("equipment");
    };

    const handleEditEquipment = (id) => {
        const item = equipment.find((e) => e.id === id);
        if (!item) return;
        setEquipmentForm({
            cca_id: item.cca_id,
            name: item.name,
            code: item.code || "",
            quantity: item.quantity,
            active: !!item.active,
        });
        setEditId(id);
        setDialog("equipment");
    };

    const handleDeleteEquipment = async (id) => {
        const deleted = await dispatch(
            deleteRecord({
                type: "equipment",
                endPoint: `${equipmentEndPoints.delete}${id}`,
                id,
            })
        );
        if (deleted) myFetch();
    };

    const save = async (type, endPoints, data) => {
        setLoading(true);
        setError("");
        try {
            await dispatch(
                editId
                    ? updateRecord({
                          type,
                          endPoint: `${endPoints.update}${editId}`,
                          data,
                      })
                    : createRecord({ type, endPoint: endPoints.store, data })
            );
            closeDialog();
            myFetch();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
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
                                onFetch={myFetch}
                                onAdd={handleAddCca}
                                onEdit={handleEditCca}
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
                                <form
                                    className="mt-8"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        save("ccas", ccaEndPoints, ccaForm);
                                    }}
                                >
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
                                <form
                                    className="mt-8"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        save("equipment", equipmentEndPoints, equipmentForm);
                                    }}
                                >
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
