import React, { useMemo, useState } from "react";
import {
    useCancelBookingMutation,
    useConfirmBookingMutation,
    useListQuery,
} from "../../store/hub-api";
import { useSaveRecord } from "../../store/use-save-record";
import { reportParams } from "../../utils/report-filters";
import { notify } from "../../utils/notify";
import Header from "../../shared/layout/Header";
import DataTable from "../../shared/misc/DataTable";
import { Card } from "primereact/card";
import { Dialog } from "primereact/dialog";
import { FloatLabel } from "primereact/floatlabel";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";

const EMPTY = {
    level: null,
    class: null,
    student: null,
    facility: null,
    start_date: null,
    start_time: null,
    end_date: null,
    end_time: null,
};

const option = (record) => (record ? { id: record.id, label: record.name } : null);

/** Booking times are stored in UTC as "YYYY-MM-DD HH:mm:00". */
const formatDateTimeForMySQL = (date) =>
    date ? `${date.toISOString().slice(0, 16).replace("T", " ")}:00` : null;

const combineDateAndTime = (date, time) => {
    if (!date || !time) return null;
    const combinedDate = new Date(date);
    const timeDate = new Date(time);
    combinedDate.setHours(timeDate.getHours(), timeDate.getMinutes(), timeDate.getSeconds());
    return combinedDate;
};

/** Returns what is wrong with the form, or null when it can be sent. */
const validationError = (formData) => {
    const { student, facility, start_date, start_time, end_date, end_time } = formData;
    if (!student?.id || !facility?.id || !start_date || !start_time || !end_date || !end_time) {
        return "Fill in every field.";
    }
    const start = combineDateAndTime(start_date, start_time);
    const end = combineDateAndTime(end_date, end_time);
    if (start <= new Date()) return "The start time must be in the future.";
    if (end <= start) return "The end time must be after the start time.";
    return null;
};

function FacilityReservations() {
    const [timeFilter, setTimeFilter] = useState("month");
    const [dateFilter, setDateFilter] = useState(null);
    const [rangeFilter, setRangeFilter] = useState(null);
    const [visible, setVisible] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState(EMPTY);

    // Changing a filter changes the query, which refetches on its own.
    const bookingQuery = useListQuery({
        type: "bookings",
        params: reportParams({ timeFilter, dateFilter, rangeFilter }),
    });
    const levelQuery = useListQuery({ type: "levels" });
    const classQuery = useListQuery({ type: "class" });
    const studentQuery = useListQuery({ type: "students" });
    const facilityQuery = useListQuery({ type: "facilities" });
    const { save, remove, removeMany, saving, error, setError } = useSaveRecord("bookings");
    const [confirmBooking, confirmState] = useConfirmBookingMutation();
    const [cancelBooking, cancelState] = useCancelBookingMutation();
    const loading = saving || confirmState.isLoading || cancelState.isLoading;

    const bookings = bookingQuery.data ?? [];
    const levels = levelQuery.data ?? [];
    const classes = classQuery.data ?? [];
    const students = studentQuery.data ?? [];
    const facilities = facilityQuery.data ?? [];

    const rows = useMemo(
        () =>
            bookings.map((i) => ({
                id: i.id,
                student: i.student?.name || "N/A",
                level: i.student?.class?.level?.name || "N/A",
                class: i.student?.class?.name || "N/A",
                facility: i.facility?.name
                    ? `${i.facility?.parent?.name} (${i.facility?.name})`
                    : "N/A",
                facility_id: i.facility_id,
                status: i.status,
                start_time: i.start_time,
                end_time: i.end_time,
            })),
        [bookings]
    );

    const facilityOptions = facilities
        .filter((i) => i.parent_id)
        .map((i) => ({ id: i.id, label: `${i.parent?.name} (${i.name})` }));

    const openForm = (booking = null) => {
        setEditId(booking?.id ?? null);
        setFormData(
            booking
                ? {
                      level: option(levels.find((l) => l.id === booking.student?.class?.level?.id)),
                      class: option(classes.find((c) => c.id === booking.student?.class?.id)),
                      student: option(students.find((s) => s.id === booking.student?.id)),
                      facility: facilityOptions.find((f) => f.id === booking.facility_id) ?? null,
                      start_date: booking.start_time ? new Date(booking.start_time) : null,
                      start_time: booking.start_time ? new Date(booking.start_time) : null,
                      end_date: booking.end_time ? new Date(booking.end_time) : null,
                      end_time: booking.end_time ? new Date(booking.end_time) : null,
                  }
                : EMPTY
        );
        setError("");
        setVisible(true);
    };

    // Toasts for confirm/cancel come from api-toasts.
    const handleConfirm = (id) => confirmBooking(id);
    const handleCancel = (id) => cancelBooking({ id });

    const handleChange = (e) => {
        const { name, value } = e.target ? e.target : e;

        setFormData((prev) => {
            const newData = { ...prev, [name]: value };

            if (name === "level") {
                newData.class = null;
                newData.student = null;
            } else if (name === "class") {
                newData.student = null;
            } else if (name === "start_date" || name === "start_time") {
                const start = combineDateAndTime(newData.start_date, newData.start_time);
                const end = combineDateAndTime(prev.end_date, prev.end_time);
                if (start && end && start >= end) {
                    newData.end_date = null;
                    newData.end_time = null;
                    notify.info("End time cleared", "The start time moved past it.");
                }
            }

            if (
                name === "end_date" &&
                newData.start_date &&
                value &&
                new Date(value) < new Date(newData.start_date)
            ) {
                newData.end_date = null;
                notify.warn("Invalid end date", "The end date can't be before the start date.");
            }

            if (name === "end_time") {
                const start = combineDateAndTime(newData.start_date, newData.start_time);
                const end = combineDateAndTime(newData.end_date, value);
                if (start && end && end <= start) {
                    newData.end_time = null;
                    notify.warn("Invalid end time", "The end time must be after the start time.");
                }
            }

            return newData;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const problem = validationError(formData);
        if (problem) {
            setError(problem);
            return;
        }
        const saved = await save(editId, {
            student_id: formData.student.id,
            facility_id: formData.facility.id,
            start_time: formatDateTimeForMySQL(
                combineDateAndTime(formData.start_date, formData.start_time)
            ),
            end_time: formatDateTimeForMySQL(
                combineDateAndTime(formData.end_date, formData.end_time)
            ),
        });
        if (saved) setVisible(false);
    };

    const levelOptions = levels.map(option);
    const classOptions = formData.level
        ? classes.filter((c) => c.level_id === formData.level.id).map(option)
        : [];
    const studentOptions = formData.class
        ? students.filter((s) => s.class_id === formData.class.id).map(option)
        : [];

    const isDataReady = [bookingQuery, levelQuery, classQuery, studentQuery, facilityQuery].every(
        (q) => !q.isLoading
    );

    return (
        <div>
            <Header />
            <main
                className="admin-container with-color"
                style={{ padding: "20px" }}
            >
                <Card>
                    {isDataReady ? (
                        <>
                            <DataTable
                                type="bookings"
                                identifier="id"
                                collection={rows}
                                onFetch={() => {}} // filters drive the query
                                onAdd={() => openForm()}
                                onEdit={(id) => openForm(bookings.find((b) => b.id === id))}
                                onDelete={remove}
                                onDeleteMany={removeMany}
                                onConfirm={handleConfirm}
                                onCancel={handleCancel}
                                title="Facility Reservations"
                                timeFilter={timeFilter}
                                setTimeFilter={setTimeFilter}
                                dateFilter={dateFilter}
                                setDateFilter={setDateFilter}
                                rangeFilter={rangeFilter}
                                setRangeFilter={setRangeFilter}
                            />
                            <Dialog
                                header={
                                    editId
                                        ? "Edit Facility Reservation"
                                        : "Add Facility Reservation"
                                }
                                visible={visible}
                                style={{ width: "600px" }}
                                onHide={() => setVisible(false)}
                            >
                                <form
                                    onSubmit={handleSubmit}
                                    className="mt-8 reservation-form"
                                >
                                    {error && (
                                        <p
                                            style={{
                                                color: "red",
                                                marginBottom: "2rem",
                                                backgroundColor: "#fee2e2",
                                                padding: "0.75rem",
                                                borderRadius: "8px",
                                            }}
                                        >
                                            {error}
                                        </p>
                                    )}
                                    <div style={{ marginBottom: "2rem" }}>
                                        <FloatLabel>
                                            <Dropdown
                                                name="level"
                                                value={formData.level}
                                                options={levelOptions}
                                                onChange={handleChange}
                                                filter
                                                optionLabel="label"
                                                style={{ width: "100%" }}
                                                required
                                                disabled={loading}
                                                placeholder="Select a level"
                                            />
                                            <label htmlFor="level">Level</label>
                                        </FloatLabel>
                                    </div>
                                    <div style={{ marginBottom: "2rem" }}>
                                        <FloatLabel>
                                            <Dropdown
                                                name="class"
                                                value={formData.class}
                                                options={classOptions}
                                                onChange={handleChange}
                                                filter
                                                optionLabel="label"
                                                style={{ width: "100%" }}
                                                required
                                                disabled={
                                                    !formData.level || loading
                                                }
                                                placeholder="Select a class"
                                            />
                                            <label htmlFor="class">Class</label>
                                        </FloatLabel>
                                    </div>
                                    <div style={{ marginBottom: "2rem" }}>
                                        <FloatLabel>
                                            <Dropdown
                                                name="student"
                                                value={formData.student}
                                                options={studentOptions}
                                                onChange={handleChange}
                                                filter
                                                optionLabel="label"
                                                style={{ width: "100%" }}
                                                required
                                                disabled={
                                                    !formData.class || loading
                                                }
                                                placeholder="Select a student"
                                            />
                                            <label htmlFor="student">
                                                Student
                                            </label>
                                        </FloatLabel>
                                    </div>
                                    <div style={{ marginBottom: "2rem" }}>
                                        <FloatLabel>
                                            <Dropdown
                                                name="facility"
                                                value={formData.facility}
                                                options={facilityOptions}
                                                onChange={handleChange}
                                                filter
                                                optionLabel="label"
                                                style={{ width: "100%" }}
                                                required
                                                disabled={loading}
                                                placeholder="Select a facility"
                                            />
                                            <label htmlFor="facility">
                                                Facility
                                            </label>
                                        </FloatLabel>
                                    </div>
                                    <div
                                        className="w-full flex justify-between"
                                        style={{ marginBottom: "2rem" }}
                                    >
                                        <FloatLabel>
                                            <Calendar
                                                name="start_date"
                                                value={formData.start_date}
                                                onChange={handleChange}
                                                dateFormat="yy-mm-dd"
                                                style={{ width: "100%" }}
                                                required
                                                disabled={loading}
                                                minDate={new Date()}
                                                touchUI
                                                showButtonBar
                                                readOnlyInput
                                                appendTo={document.body}
                                                panelClassName="date-time-panel"
                                                inputClassName="date-time-input"
                                                monthNavigator
                                                yearNavigator
                                                yearRange={`${new Date().getFullYear()}:${
                                                    new Date().getFullYear() + 5
                                                }`}
                                            />
                                            <label htmlFor="start_date">
                                                Start Date
                                            </label>
                                        </FloatLabel>
                                        <FloatLabel>
                                            <Calendar
                                                name="start_time"
                                                value={formData.start_time}
                                                onChange={handleChange}
                                                timeOnly
                                                hourFormat="12"
                                                style={{ width: "100%" }}
                                                required
                                                disabled={
                                                    loading ||
                                                    !formData.start_date
                                                }
                                                touchUI
                                                showButtonBar
                                                readOnlyInput
                                                appendTo={document.body}
                                                panelClassName="date-time-panel"
                                                inputClassName="date-time-input"
                                                stepMinute={30}
                                            />
                                            <label htmlFor="start_time">
                                                Start Time
                                            </label>
                                        </FloatLabel>
                                    </div>
                                    <div
                                        className="w-full flex justify-between"
                                        style={{ marginBottom: "2rem" }}
                                    >
                                        <FloatLabel>
                                            <Calendar
                                                name="end_date"
                                                value={formData.end_date}
                                                onChange={handleChange}
                                                dateFormat="yy-mm-dd"
                                                style={{ width: "100%" }}
                                                required
                                                disabled={
                                                    loading ||
                                                    !formData.start_date
                                                }
                                                minDate={
                                                    formData.start_date ||
                                                    new Date()
                                                }
                                                touchUI
                                                showButtonBar
                                                readOnlyInput
                                                appendTo={document.body}
                                                panelClassName="date-time-panel"
                                                inputClassName="date-time-input"
                                                monthNavigator
                                                yearNavigator
                                                yearRange={`${new Date().getFullYear()}:${
                                                    new Date().getFullYear() + 5
                                                }`}
                                            />
                                            <label htmlFor="end_date">
                                                End Date
                                            </label>
                                        </FloatLabel>
                                        <FloatLabel>
                                            <Calendar
                                                name="end_time"
                                                value={formData.end_time}
                                                onChange={handleChange}
                                                timeOnly
                                                hourFormat="12"
                                                style={{ width: "100%" }}
                                                required
                                                disabled={
                                                    loading ||
                                                    !formData.end_date
                                                }
                                                touchUI
                                                showButtonBar
                                                readOnlyInput
                                                appendTo={document.body}
                                                panelClassName="date-time-panel"
                                                inputClassName="date-time-input"
                                                stepMinute={30}
                                            />
                                            <label htmlFor="end_time">
                                                End Time
                                            </label>
                                        </FloatLabel>
                                    </div>
                                    <div
                                        className="reservation-form-buttons"
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
editId ? "Update" : "Create"
                                            }
                                            icon="pi pi-check"
                                            type="submit"
                                            disabled={loading}
                                            className="p-button-outlined"
                                        />
                                    </div>
                                </form>
                            </Dialog>
                        </>
                    ) : (
                        <p>Please wait.</p>
                    )}
                </Card>
            </main>
        </div>
    );
}

export default FacilityReservations;
