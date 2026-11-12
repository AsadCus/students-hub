import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { DateTime } from "luxon";
import {
    getRecords,
    createRecord,
    updateRecord,
    setStateData,
} from "../../store/global-slice";
import Header from "../../shared/layout/Header";
import DataTable from "../../shared/misc/DataTable";
import { Card } from "primereact/card";
import { Dialog } from "primereact/dialog";
import { FloatLabel } from "primereact/floatlabel";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { InputTextarea } from "primereact/inputtextarea";
import { Button } from "primereact/button";

const EMPTY_FORM = {
    level: null,
    class: null,
    student: null,
    cca: null,
    equipment: null,
    dates: null, // [start, end] from a range Calendar
    notes: "",
};

/** Local calendar date, so UTC+7/+8 users don't send yesterday. */
const toYmd = (date) => (date ? DateTime.fromJSDate(date).toISODate() : null);
const fromYmd = (ymd) => (ymd ? DateTime.fromISO(ymd).toJSDate() : null);
const display = (ymd) => (ymd ? DateTime.fromISO(ymd).toFormat("d LLL yyyy") : "");

/** Admin list of equipment loans: approve, reject, mark returned, cancel, create for a student. */
function EquipmentLoans() {
    const dispatch = useDispatch();
    const [visible, setVisible] = useState(false);
    const [editId, setEditId] = useState(null);
    const [rangeFilter, setRangeFilter] = useState(null);
    const [rawLoans, setRawLoans] = useState([]);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(true);
    const [error, setError] = useState("");
    const {
        equipment_loans: { endPoints: loanEndPoints },
        levels: { data: levels = [], endPoints: levelEndPoints },
        class: { data: classes = [], endPoints: classEndPoints },
        students: { data: students = [], endPoints: studentEndPoints },
        ccas: { data: ccas = [], endPoints: ccaEndPoints },
        equipment: { data: equipment = [], endPoints: equipmentEndPoints },
    } = useSelector((state) => state.global);

    const myFetch = (params = {}) => {
        const range =
            params.rangeFilter !== undefined ? params.rangeFilter : rangeFilter;
        const query = new URLSearchParams();
        if (range?.[0]) {
            query.set("range_time[start]", toYmd(range[0]));
            query.set("range_time[end]", toYmd(range[1] || range[0]));
        }
        const url = `${loanEndPoints.collection}${query.size ? `?${query}` : ""}`;

        dispatch(getRecords({ type: "equipment_loans", endPoint: url }))
            .then((rows) => {
                setRawLoans(rows);
                dispatch(
                    setStateData({
                        type: "equipment_loans",
                        key: "data",
                        isMerge: false,
                        data: rows.map((l) => ({
                            id: l.id,
                            student: l.student?.name || "N/A",
                            class: l.student?.class
                                ? `${l.student.class.level?.name} ${l.student.class.name}`
                                : "N/A",
                            cca: l.equipment?.cca?.name || "N/A",
                            equipment: l.equipment?.name || "N/A",
                            start_date: l.start_date,
                            end_date: l.end_date,
                            status: l.is_overdue ? "overdue" : l.status,
                            notes: l.notes || "",
                        })),
                    })
                );
            })
            .finally(() => setLoadingData(false));
    };

    useEffect(() => {
        myFetch();
        const lists = [
            ["levels", levelEndPoints],
            ["class", classEndPoints],
            ["students", studentEndPoints],
            ["ccas", ccaEndPoints],
            ["equipment", equipmentEndPoints],
        ];
        lists.forEach(([type, endPoints]) =>
            dispatch(getRecords({ type, endPoint: endPoints.collection, key: "data" }))
        );
    }, [dispatch]);

    const levelOptions = levels.map((l) => ({ label: l.name, value: l.id }));
    const classOptions = useMemo(
        () =>
            classes
                .filter((c) => c.level_id === formData.level)
                .map((c) => ({ label: c.name, value: c.id })),
        [classes, formData.level]
    );
    const studentOptions = useMemo(
        () =>
            students
                .filter((s) => s.class_id === formData.class)
                .map((s) => ({ label: s.name, value: s.id })),
        [students, formData.class]
    );
    const ccaOptions = ccas.map((c) => ({ label: c.name, value: c.id }));
    const equipmentOptions = useMemo(
        () =>
            equipment
                .filter((e) => e.cca_id === formData.cca)
                .map((e) => ({
                    label: `${e.name} (${e.quantity} unit${e.quantity === 1 ? "" : "s"})${
                        e.active ? "" : " - not available"
                    }`,
                    value: e.id,
                    disabled: !e.active,
                })),
        [equipment, formData.cca]
    );

    // Picking a parent clears its children, like the booking form.
    const setField = (name, value) =>
        setFormData((prev) => {
            const next = { ...prev, [name]: value };
            if (name === "level") Object.assign(next, { class: null, student: null });
            if (name === "class") next.student = null;
            if (name === "cca") next.equipment = null;
            return next;
        });

    const handleAdd = () => {
        setFormData(EMPTY_FORM);
        setEditId(null);
        setError("");
        setVisible(true);
    };

    const handleEdit = (id) => {
        const loan = rawLoans.find((l) => l.id === id);
        if (!loan) return;
        setFormData({
            level: loan.student?.class?.level_id ?? null,
            class: loan.student?.class_id ?? null,
            student: loan.student_id,
            cca: loan.equipment?.cca_id ?? null,
            equipment: loan.equipment_id,
            dates: [fromYmd(loan.start_date), fromYmd(loan.end_date)],
            notes: loan.notes || "",
        });
        setEditId(id);
        setError("");
        setVisible(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        const [start, end] = formData.dates || [];
        const data = {
            student_id: formData.student,
            equipment_id: formData.equipment,
            start_date: toYmd(start),
            end_date: toYmd(end || start),
            notes: formData.notes,
        };
        try {
            await dispatch(
                editId
                    ? updateRecord({
                          type: "equipment_loans",
                          endPoint: `${loanEndPoints.update}${editId}`,
                          data,
                      })
                    : createRecord({
                          type: "equipment_loans",
                          endPoint: loanEndPoints.store,
                          data,
                      })
            );
            setVisible(false);
            myFetch();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // approve / reject / cancel / return all hit "<endpoint><id>" and refresh.
    const transition = (endPointKey) => async (id) => {
        try {
            await dispatch(
                updateRecord({
                    type: "equipment_loans",
                    endPoint: `${loanEndPoints[endPointKey]}${id}`,
                    data: {},
                })
            );
            myFetch();
        } catch {
            // The slice already showed the error toast.
        }
    };

    const field = { marginBottom: "2rem" };

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
                                type="equipment_loans"
                                identifier="id"
                                onFetch={(params) => myFetch(params)}
                                onAdd={handleAdd}
                                onEdit={handleEdit}
                                onConfirm={transition("confirm")}
                                onReject={transition("reject")}
                                onCancel={transition("cancel")}
                                onReturn={transition("return")}
                                title="Equipment Loans"
                                rangeFilter={rangeFilter}
                                setRangeFilter={setRangeFilter}
                            />
                            <Dialog
                                header={editId ? "Edit Loan" : "Add Loan"}
                                visible={visible}
                                style={{ width: "600px" }}
                                onHide={() => setVisible(false)}
                            >
                                <form onSubmit={handleSubmit} className="mt-8">
                                    {error && (
                                        <p style={{ color: "red", marginBottom: "2rem" }}>
                                            {error}
                                        </p>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={field}>
                                        {[
                                            ["level", "Level", levelOptions],
                                            ["class", "Class", classOptions],
                                            ["student", "Student", studentOptions],
                                        ].map(([name, label, options]) => (
                                            <FloatLabel key={name}>
                                                <Dropdown
                                                    inputId={`loan-${name}`}
                                                    value={formData[name]}
                                                    options={options}
                                                    onChange={(e) => setField(name, e.value)}
                                                    filter
                                                    style={{ width: "100%" }}
                                                    required
                                                    disabled={loading}
                                                />
                                                <label htmlFor={`loan-${name}`}>{label}</label>
                                            </FloatLabel>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={field}>
                                        <FloatLabel>
                                            <Dropdown
                                                inputId="loan-cca"
                                                value={formData.cca}
                                                options={ccaOptions}
                                                onChange={(e) => setField("cca", e.value)}
                                                style={{ width: "100%" }}
                                                required
                                                disabled={loading}
                                            />
                                            <label htmlFor="loan-cca">CCA</label>
                                        </FloatLabel>
                                        <FloatLabel>
                                            <Dropdown
                                                inputId="loan-equipment"
                                                value={formData.equipment}
                                                options={equipmentOptions}
                                                optionDisabled="disabled"
                                                onChange={(e) => setField("equipment", e.value)}
                                                style={{ width: "100%" }}
                                                required
                                                disabled={loading}
                                            />
                                            <label htmlFor="loan-equipment">Equipment</label>
                                        </FloatLabel>
                                    </div>
                                    <div style={field}>
                                        <FloatLabel>
                                            <Calendar
                                                inputId="loan-dates"
                                                value={formData.dates}
                                                onChange={(e) => setField("dates", e.value)}
                                                selectionMode="range"
                                                dateFormat="d M yy"
                                                minDate={editId ? null : new Date()}
                                                showIcon
                                                style={{ width: "100%" }}
                                                required
                                                disabled={loading}
                                            />
                                            <label htmlFor="loan-dates">Dates (at most 2 days)</label>
                                        </FloatLabel>
                                    </div>
                                    <div style={field}>
                                        <FloatLabel>
                                            <InputTextarea
                                                id="loan-notes"
                                                value={formData.notes}
                                                onChange={(e) => setField("notes", e.target.value)}
                                                rows={2}
                                                style={{ width: "100%" }}
                                                disabled={loading}
                                            />
                                            <label htmlFor="loan-notes">Notes (optional)</label>
                                        </FloatLabel>
                                    </div>
                                    {formData.dates?.[0] && (
                                        <p style={{ marginBottom: "1rem", color: "#555" }}>
                                            {display(toYmd(formData.dates[0]))}
                                            {formData.dates[1] &&
                                            toYmd(formData.dates[1]) !== toYmd(formData.dates[0])
                                                ? ` to ${display(toYmd(formData.dates[1]))}`
                                                : " (one day)"}
                                        </p>
                                    )}
                                    <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                                        <Button
                                            label="Cancel"
                                            icon="pi pi-times"
                                            type="button"
                                            onClick={() => setVisible(false)}
                                            className="p-button-text"
                                            disabled={loading}
                                        />
                                        <Button
                                            label={editId ? "Update" : "Create"}
                                            icon="pi pi-check"
                                            type="submit"
                                            disabled={loading}
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

export default EquipmentLoans;
