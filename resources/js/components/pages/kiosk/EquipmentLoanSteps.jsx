import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { DateTime } from "luxon";
import _ from "lodash";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { getRecords, createRecord, updateRecord } from "../../store/global-slice";

/**
 * Kiosk "Loan Equipment" flow: after the shared Level -> Class -> Name steps,
 * the student picks CCA -> Equipment -> Dates and sends a request that a
 * teacher approves. Home.jsx renders these as StepperPanels (they must be
 * direct children of its Stepper).
 */

const MAX_DAYS = 2; // mirrors EquipmentLoanService::MAX_DAYS
const toYmd = (date) => (date ? DateTime.fromJSDate(date).toISODate() : null);
const display = (date) => DateTime.fromJSDate(date).toFormat("ccc d LLL");
const displayYmd = (ymd) => DateTime.fromISO(ymd).toFormat("ccc d LLL");

export function useEquipmentLoan({ active, studentId }) {
    const dispatch = useDispatch();
    const [ccaId, setCcaId] = useState(null);
    const [equipmentId, setEquipmentId] = useState(null);
    const [dates, setDates] = useState(null);
    const [requested, setRequested] = useState(null); // the loan just created
    const [saving, setSaving] = useState(false);
    const {
        ccas: { data: ccas = [], endPoints: ccaEndPoints },
        equipment: { data: equipment = [], endPoints: equipmentEndPoints },
        equipment_loans: { endPoints: loanEndPoints },
    } = useSelector((state) => state.global);

    useEffect(() => {
        if (!active) return;
        // Only what a student can borrow right now.
        dispatch(getRecords({ type: "ccas", endPoint: `${ccaEndPoints.collection}?active=1`, key: "data" }));
        dispatch(getRecords({ type: "equipment", endPoint: `${equipmentEndPoints.collection}?active=1`, key: "data" }));
    }, [active, dispatch]);

    const [start, end] = dates || [];
    const days = start
        ? Math.round(DateTime.fromJSDate(end || start).diff(DateTime.fromJSDate(start), "days").days) + 1
        : 0;

    const submit = async () => {
        setSaving(true);
        try {
            const loan = await dispatch(
                createRecord({
                    type: "equipment_loans",
                    endPoint: loanEndPoints.request,
                    data: {
                        student_id: studentId,
                        equipment_id: equipmentId,
                        start_date: toYmd(start),
                        end_date: toYmd(end || start),
                    },
                    returnData: true,
                })
            );
            setRequested(loan);
        } catch {
            // The slice already showed why (e.g. no units left for those dates).
        } finally {
            setSaving(false);
        }
    };

    const cancelRequest = async () => {
        setSaving(true);
        try {
            const loan = await dispatch(
                updateRecord({
                    type: "equipment_loans",
                    endPoint: `${loanEndPoints.cancel}${requested.id}`,
                    data: {},
                    returnData: true,
                })
            );
            setRequested(loan);
        } catch {
            // toast already shown
        } finally {
            setSaving(false);
        }
    };

    const reset = () => {
        setCcaId(null);
        setEquipmentId(null);
        setDates(null);
        setRequested(null);
    };

    return {
        ccas,
        equipment: equipment.filter((e) => e.cca_id === ccaId),
        ccaId,
        selectCca: (id) => {
            setCcaId(id);
            setEquipmentId(null);
        },
        equipmentId,
        setEquipmentId,
        selectedEquipment: equipment.find((e) => e.id === equipmentId),
        dates,
        setDates,
        days,
        tooLong: days > MAX_DAYS,
        requested,
        saving,
        submit,
        cancelRequest,
        reset,
    };
}

/** Same chunked grid of stretch buttons as the Level/Class/Name steps. */
function ChoiceGrid({ items, selectedId, onSelect, label }) {
    const columns = window.innerWidth >= 640 ? 3 : 2;
    if (!items.length) {
        return <p className="text-gray-600">Nothing available to borrow here yet.</p>;
    }
    return (
        <div className="flex flex-col gap-2 overflow-y-auto max-h-64">
            {_.chunk(items, columns).map((row, i) => (
                <div key={i} className="centered-row" style={{ "--num-columns": columns }}>
                    {row.map((item) => (
                        <Button
                            key={item.id}
                            label={label(item)}
                            onClick={() => onSelect(item.id)}
                            className={`stretch-button ${
                                selectedId === item.id ? "bg-blue-500 text-white" : "bg-gray-200"
                            }`}
                            size="small"
                            icon={selectedId === item.id ? "pi pi-check" : null}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}

function Nav({ stepperRef, nextDisabled, next }) {
    return (
        <div className="flex pt-4 justify-between">
            <Button
                label="Back"
                severity="secondary"
                icon="pi pi-arrow-left"
                size="small"
                onClick={() => stepperRef.current.prevCallback()}
            />
            {next || (
                <Button
                    label="Next"
                    icon="pi pi-arrow-right"
                    iconPos="right"
                    size="small"
                    onClick={() => stepperRef.current.nextCallback()}
                    disabled={nextDisabled}
                />
            )}
        </div>
    );
}

export function LoanCcaStep({ loan, stepperRef }) {
    return (
        <div className="flex flex-col h-full">
            <p className="mb-2">Which CCA is the equipment from?</p>
            <ChoiceGrid
                items={loan.ccas}
                selectedId={loan.ccaId}
                onSelect={loan.selectCca}
                label={(c) => c.name}
            />
            <Nav stepperRef={stepperRef} nextDisabled={!loan.ccaId} />
        </div>
    );
}

export function LoanEquipmentStep({ loan, stepperRef }) {
    return (
        <div className="flex flex-col h-full">
            <p className="mb-2">What do you want to borrow?</p>
            <ChoiceGrid
                items={loan.equipment}
                selectedId={loan.equipmentId}
                onSelect={loan.setEquipmentId}
                label={(e) => `${e.name} (${e.quantity} unit${e.quantity === 1 ? "" : "s"})`}
            />
            <Nav stepperRef={stepperRef} nextDisabled={!loan.equipmentId} />
        </div>
    );
}

export function LoanDateStep({ loan, stepperRef, onDone }) {
    const { requested } = loan;

    if (requested) {
        const cancelled = requested.status === "cancelled";
        return (
            <div className="flex flex-col gap-4 h-full">
                <div className="border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 p-5">
                    <p className="font-semibold">
                        {cancelled ? "Request cancelled" : "Request sent"}
                    </p>
                    <p>
                        {loan.selectedEquipment?.name}, {displayYmd(requested.start_date)}
                        {requested.end_date !== requested.start_date &&
                            ` to ${displayYmd(requested.end_date)}`}
                        .
                    </p>
                    {!cancelled && <p>A teacher will approve it. Collect it from your CCA teacher.</p>}
                </div>
                <div className="flex justify-between">
                    {!cancelled ? (
                        <Button
                            label="Cancel request"
                            severity="danger"
                            outlined
                            size="small"
                            onClick={loan.cancelRequest}
                            disabled={loan.saving}
                        />
                    ) : (
                        <span />
                    )}
                    <Button label="Done" icon="pi pi-home" size="small" onClick={onDone} />
                </div>
            </div>
        );
    }

    const [start] = loan.dates || [];
    const latestEnd = start ? DateTime.fromJSDate(start).plus({ days: MAX_DAYS - 1 }).toJSDate() : null;

    return (
        <div className="flex flex-col h-full">
            <p className="mb-2">
                When do you need it? Pick the first day, then the last day (at most {MAX_DAYS} days).
            </p>
            <Calendar
                value={loan.dates}
                onChange={(e) => loan.setDates(e.value)}
                selectionMode="range"
                inline
                minDate={new Date()}
                maxDate={loan.dates?.[1] ? null : latestEnd}
                className="w-full"
            />
            {start && (
                <p className="mt-2">
                    {display(start)}
                    {loan.days > 1 && ` to ${display(loan.dates[1])}`} ({loan.days} day
                    {loan.days === 1 ? "" : "s"})
                </p>
            )}
            {loan.tooLong && (
                <p className="mt-1" style={{ color: "red" }}>
                    That's more than {MAX_DAYS} days. Pick a shorter range.
                </p>
            )}
            <Nav
                stepperRef={stepperRef}
                next={
                    <Button
                        label="Request loan"
                        icon="pi pi-send"
                        iconPos="right"
                        size="small"
                        onClick={loan.submit}
                        disabled={!start || loan.tooLong || loan.saving}
                    />
                }
            />
        </div>
    );
}
