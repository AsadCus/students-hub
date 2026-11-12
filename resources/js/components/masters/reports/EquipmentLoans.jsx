import React, { useMemo, useState } from "react";
import { DateTime } from "luxon";
import {
    useCancelLoanMutation,
    useConfirmLoanMutation,
    useListQuery,
    useRejectLoanMutation,
    useReturnLoanMutation,
} from "../../store/hub-api";
import { useSaveRecord } from "../../store/use-save-record";
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
    const [visible, setVisible] = useState(false);
    const [editId, setEditId] = useState(null);
    const [rangeFilter, setRangeFilter] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);

    // Loans are whole days, so the range goes as local dates, not instants.
    const params = rangeFilter?.[0]
        ? {
              range_time: {
                  start: toYmd(rangeFilter[0]),
                  end: toYmd(rangeFilter[1] || rangeFilter[0]),
              },
          }
        : {};
    const loanQuery = useListQuery({ type: "equipment_loans", params });
    const { data: levels = [] } = useListQuery({ type: "levels" });
    const { data: classes = [] } = useListQuery({ type: "class" });
    const { data: students = [] } = useListQuery({ type: "students" });
    const { data: ccas = [] } = useListQuery({ type: "ccas" });
    const { data: equipment = [] } = useListQuery({ type: "equipment" });
    const { save, remove, removeMany, saving: loading, error, setError } =
        useSaveRecord("equipment_loans");
    // Toasts for these come from api-toasts.
    const [confirmLoan] = useConfirmLoanMutation();
    const [rejectLoan] = useRejectLoanMutation();
    const [returnLoan] = useReturnLoanMutation();
    const [cancelLoan] = useCancelLoanMutation();

    const loans = loanQuery.data ?? [];
    const rows = useMemo(
        () =>
            loans.map((l) => ({
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
        [loans]
    );

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
        const loan = loans.find((l) => l.id === id);
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
        const [start, end] = formData.dates || [];
        const saved = await save(editId, {
            student_id: formData.student,
            equipment_id: formData.equipment,
            start_date: toYmd(start),
            end_date: toYmd(end || start),
            notes: formData.notes,
        });
        if (saved) setVisible(false);
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
                    {loanQuery.isLoading ? (
                        <p>Please wait.</p>
                    ) : (
                        <>
                            <DataTable
                                type="equipment_loans"
                                identifier="id"
                                collection={rows}
                                onFetch={() => {}} // the range filter drives the query
                                onAdd={handleAdd}
                                onEdit={handleEdit}
                                onDelete={remove}
                                onDeleteMany={removeMany}
                                onConfirm={confirmLoan}
                                onReject={rejectLoan}
                                onCancel={(id) => cancelLoan({ id })}
                                onReturn={returnLoan}
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
