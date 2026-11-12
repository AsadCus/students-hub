import React, { useMemo, useState } from "react";
import { useListQuery } from "../../store/hub-api";
import { useSaveRecord } from "../../store/use-save-record";
import { reportParams } from "../../utils/report-filters";
import Header from "../../shared/layout/Header";
import DataTable from "../../shared/misc/DataTable";
import { Card } from "primereact/card";
import { Dialog } from "primereact/dialog";
import { FloatLabel } from "primereact/floatlabel";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { InputText } from "primereact/inputtext";
import { Checkbox } from "primereact/checkbox";

const EMPTY = {
    level: null,
    class: null,
    student: null,
    activity: null,
    checkin_time: null,
    checkout_time: null,
    hasReason: false,
    reason: "",
};

const option = (record) => (record ? { id: record.id, label: record.name } : null);

/** Check-in times are stored in UTC as "YYYY-MM-DD HH:mm:ss". */
const formatDateTimeForMySQL = (date) =>
    date ? date.toISOString().slice(0, 19).replace("T", " ") : null;

function Checkin() {
    const [timeFilter, setTimeFilter] = useState("today");
    const [dateFilter, setDateFilter] = useState(null);
    const [rangeFilter, setRangeFilter] = useState(null);
    const [visible, setVisible] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState(EMPTY);

    // Changing a filter changes the query, which refetches on its own.
    const checkinQuery = useListQuery({
        type: "checkin",
        params: reportParams({ timeFilter, dateFilter, rangeFilter }),
    });
    const levelQuery = useListQuery({ type: "levels" });
    const classQuery = useListQuery({ type: "class" });
    const studentQuery = useListQuery({ type: "students" });
    const activityQuery = useListQuery({ type: "activities" });
    const { save, remove, removeMany, saving: loading, error, setError } =
        useSaveRecord("checkin");

    const checkins = checkinQuery.data ?? [];
    const levels = levelQuery.data ?? [];
    const classes = classQuery.data ?? [];
    const students = studentQuery.data ?? [];
    const activities = activityQuery.data ?? [];

    const rows = useMemo(
        () =>
            checkins.map((i) => ({
                id: i.id,
                student: i.student?.name || "N/A",
                level: i.student?.class?.level?.name || "N/A",
                class: i.student?.class?.name || "N/A",
                activity: i.activity?.name || i.other_activity || "N/A",
                checkin_time: i.checkin_time,
                checkout_time: i.checkout_time,
                reason: i.reason,
            })),
        [checkins]
    );

    const openForm = (checkin = null) => {
        setEditId(checkin?.id ?? null);
        setFormData(
            checkin
                ? {
                      level: option(levels.find((l) => l.id === checkin.student?.class?.level?.id)),
                      class: option(classes.find((c) => c.id === checkin.student?.class?.id)),
                      student: option(students.find((s) => s.id === checkin.student?.id)),
                      activity:
                          option(activities.find((a) => a.id === checkin.activity_id)) ??
                          checkin.other_activity ??
                          null,
                      checkin_time: checkin.checkin_time ? new Date(checkin.checkin_time) : null,
                      checkout_time: checkin.checkout_time ? new Date(checkin.checkout_time) : null,
                      hasReason: !!checkin.reason,
                      reason: checkin.reason || "",
                  }
                : EMPTY
        );
        setError("");
        setVisible(true);
    };

    const handleChange = (e) => {
        const { name, value } = e.target ? e.target : e;
        setFormData((prev) => {
            const newData = { ...prev, [name]: value };
            if (name === "level") {
                newData.class = null;
                newData.student = null;
            } else if (name === "class") {
                newData.student = null;
            }
            return newData;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const isCustomActivity =
            typeof formData.activity === "string" || !formData.activity?.id;
        const saved = await save(editId, {
            student_id: formData.student?.id,
            activity_id: isCustomActivity ? null : formData.activity?.id,
            other_activity:
                isCustomActivity && formData.activity ? formData.activity : null,
            checkin_time: formatDateTimeForMySQL(formData.checkin_time),
            checkout_time: formatDateTimeForMySQL(formData.checkout_time),
            reason: formData.hasReason ? formData.reason : null,
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
    const activityOptions = activities.map(option);

    const isDataReady = [checkinQuery, levelQuery, classQuery, studentQuery, activityQuery].every(
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
                                type="checkin"
                                identifier="id"
                                collection={rows}
                                onFetch={() => {}} // filters drive the query
                                onAdd={() => openForm()}
                                onEdit={(id) => openForm(checkins.find((c) => c.id === id))}
                                onDelete={remove}
                                onDeleteMany={removeMany}
                                title="Check In"
                                timeFilter={timeFilter}
                                setTimeFilter={setTimeFilter}
                                dateFilter={dateFilter}
                                setDateFilter={setDateFilter}
                                rangeFilter={rangeFilter}
                                setRangeFilter={setRangeFilter}
                            />
                            <Dialog
                                header={
editId ? "Edit Check In" : "Add Check In"
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
                                                name="activity"
                                                value={formData.activity}
                                                options={activityOptions}
                                                onChange={handleChange}
                                                filter
                                                editable
                                                optionLabel="label"
                                                style={{ width: "100%" }}
                                                disabled={loading}
                                                placeholder="Select or type an activity"
                                            />
                                            <label htmlFor="activity">
                                                Activity
                                            </label>
                                        </FloatLabel>
                                    </div>
                                    <div style={{ marginBottom: "2rem" }}>
                                        <FloatLabel>
                                            <Calendar
                                                name="checkin_time"
                                                value={formData.checkin_time}
                                                onChange={handleChange}
                                                showTime
                                                hourFormat="24"
                                                dateFormat="yy-mm-dd"
                                                style={{ width: "100%" }}
                                                required
                                                disabled={loading}
                                                placeholder="Select check-in time"
                                            />
                                            <label htmlFor="checkin_time">
                                                Check-In Time
                                            </label>
                                        </FloatLabel>
                                    </div>
                                    <div style={{ marginBottom: "2rem" }}>
                                        <FloatLabel>
                                            <Calendar
                                                name="checkout_time"
                                                value={formData.checkout_time}
                                                onChange={handleChange}
                                                showTime
                                                hourFormat="24"
                                                dateFormat="yy-mm-dd"
                                                style={{ width: "100%" }}
                                                disabled={loading}
                                                placeholder="Select check-out time"
                                            />
                                            <label htmlFor="checkout_time">
                                                Check-Out Time
                                            </label>
                                        </FloatLabel>
                                    </div>
                                    <div style={{ marginBottom: "2rem" }}>
                                        <Checkbox
                                            inputId="hasReason"
                                            name="hasReason"
                                            checked={formData.hasReason}
                                            onChange={(e) =>
                                                handleChange({
                                                    name: "hasReason",
                                                    value: e.checked,
                                                })
                                            }
                                            disabled={loading}
                                        />
                                        <label
                                            htmlFor="hasReason"
                                            style={{ marginLeft: "8px" }}
                                        >
                                            Add Reason
                                        </label>
                                    </div>
                                    {formData.hasReason && (
                                        <div style={{ marginBottom: "2rem" }}>
                                            <FloatLabel>
                                                <InputText
                                                    name="reason"
                                                    value={formData.reason}
                                                    onChange={handleChange}
                                                    style={{ width: "100%" }}
                                                    required={
                                                        formData.hasReason
                                                    }
                                                    disabled={loading}
                                                    placeholder="Enter reason"
                                                />
                                                <label htmlFor="reason">
                                                    Reason
                                                </label>
                                            </FloatLabel>
                                        </div>
                                    )}
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
editId ? "Update" : "Create"
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
                        <p>Please wait.</p>
                    )}
                </Card>
            </main>
        </div>
    );
}

export default Checkin;
