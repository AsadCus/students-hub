import React, { useMemo, useState } from "react";
import { useAuthUser } from "react-auth-kit";
import { useListQuery } from "../store/hub-api";
import { useSaveRecord } from "../store/use-save-record";
import Header from "../shared/layout/Header";
import { Tree } from "primereact/tree";
import { Badge } from "primereact/badge";
import { Card } from "primereact/card";
import { Calendar } from "primereact/calendar";
import { Dropdown } from "primereact/dropdown";
import { DateTime } from "luxon";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";

/** Local calendar date ("YYYY-MM-DD"), which is how blocked dates are stored. */
const formatDateForMySQL = (date) =>
    date instanceof Date && !isNaN(date.getTime()) ? DateTime.fromJSDate(date).toISODate() : null;

function Dashboard() {
    const auth = useAuthUser();
    const permissions = auth()?.permissions || [];
    const canViewStudents = permissions.includes("dashboard view");
    const canViewBookings = canViewStudents || permissions.includes("dashboard-bookings view");
    const [date, setDate] = useState(new Date());
    const [selectedFacility, setSelectedFacility] = useState(null);
    const [showBlockDialog, setShowBlockDialog] = useState(false);
    const [blockReason, setBlockReason] = useState("");

    const { data: levels = [] } = useListQuery({ type: "levels" }, { skip: !canViewStudents });
    const { data: classes = [] } = useListQuery({ type: "class" }, { skip: !canViewStudents });
    const { data: students = [] } = useListQuery({ type: "students" }, { skip: !canViewStudents });
    const { data: facilities = [] } = useListQuery({ type: "facilities" }, { skip: !canViewBookings });
    const { data: blockedDate = [] } = useListQuery(
        { type: "blocked_dates" },
        { skip: !canViewBookings }
    );
    // The selected local day, as UTC instants.
    const dayRange = date && {
        start: DateTime.fromJSDate(date).startOf("day").toUTC().toISO(),
        end: DateTime.fromJSDate(date).endOf("day").toUTC().toISO(),
    };
    const bookingQuery = useListQuery(
        { type: "bookings", params: { range_time: dayRange } },
        { skip: !canViewBookings || !date }
    );
    const bookings = bookingQuery.data ?? [];
    // Toasts ("Blocked date created/deleted") come from api-toasts.
    const { save, remove, saving, error, setError } = useSaveRecord("blocked_dates");
    const loading = saving || bookingQuery.isFetching;

    const nodes = useMemo(
        () =>
            levels.map((level) => ({
                key: `level-${level.id}`,
                label: level.name,
                data: { name: level.name },
                children: classes
                    .filter((cls) => cls.level_id === level.id)
                    .map((cls) => ({
                        key: `cls-${cls.id}`,
                        label: cls.name,
                        data: { name: cls.name },
                        children: students
                            .filter((student) => student.class_id === cls.id)
                            .map((student) => ({
                                key: `student-${student.id}`,
                                label: student.name,
                                data: { name: student.name },
                                leaf: true,
                            })),
                    })),
            })),
        [levels, classes, students]
    );

    const nodeTemplate = (node) => {
        return <span>{node.label}</span>;
    };

    const facilityOptions = [
        { label: "All Facilities", value: 0 },
        ...facilities
            .filter((i) => i.parent_id)
            .map((facility) => ({
                label: `${facility.parent?.name} (${facility.name})`,
                value: facility.id,
            })),
    ];

    const closeBlockDialog = () => {
        setShowBlockDialog(false);
        setBlockReason("");
        setError("");
    };

    const handleBlockDate = async () => {
        const saved = await save(null, { date: formatDateForMySQL(date), reason: blockReason });
        if (saved) closeBlockDialog();
    };

    const getBookingStyle = (duration) => {
        const minHeight = 40;
        const height = Math.max(minHeight, (duration / 30) * minHeight);
        return {
            backgroundColor: "#e3f2fd",
            borderLeft: "4px solid #1976d2",
            padding: "8px",
            margin: "2px 0",
            borderRadius: "4px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            fontSize: "14px",
            overflow: "hidden",
            position: "relative",
        };
    };

    const populateBookings = () => {
        const bookingsList = [];
        if (Array.isArray(bookings) && bookings.length > 0) {
            bookings
                .filter((booking) =>
                    selectedFacility
                        ? booking.facility_id === selectedFacility
                        : true
                )
                .forEach((booking) => {
                    const start = DateTime.fromISO(booking.start_time);
                    const endTime = DateTime.fromISO(booking.end_time);
                    bookingsList.push({
                        ...booking,
                        duration: endTime.diff(start, "minutes").minutes,
                        startTime: start.toFormat("HH:mm"),
                        endTime: endTime.toFormat("HH:mm"),
                    });
                });
        }
        return bookingsList;
    };

    const bookingsList = populateBookings();

    const dateTemplate = (date) => {
        const dateStr = `${date.year}-${String(date.month + 1).padStart(
            2,
            "0"
        )}-${String(date.day).padStart(2, "0")}`;

        if (blockedDate.length > 0) {
            const blocked = blockedDate?.find((bd) => bd.date === dateStr);
            if (blocked) {
                return (
                    <div className="relative flex flex-col items-center">
                        <Badge
                            value="!"
                            severity="danger"
                            className="absolute text-xs p-1"
                        />
                        <span className="text-gray-400">{date.day}</span>
                    </div>
                );
            }
        }

        return date.day;
    };

    const isDateBlocked =
        formatDateForMySQL(date) &&
        blockedDate.length > 0 &&
        blockedDate.find((bd) => bd.date === formatDateForMySQL(date));

    const handleUnblockDate = () => {
        if (isDateBlocked) remove(isDateBlocked.id);
    };

    return (
        <div>
            <Header />
            <main
                className="admin-container with-color"
                style={{ padding: "20px" }}
            >
                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                    {canViewStudents && (
                        <Card title="Student Overview">
                            <Tree
                                value={nodes}
                                filter
                                filterBy="label"
                                filterMode="lenient"
                                filterPlaceholder="Search"
                                nodeTemplate={nodeTemplate}
                                className="overflow-auto max-h-120"
                            />
                        </Card>
                    )}
                    {canViewBookings && (
                        <Card title="Reservation for Admin">
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="md:w-1/2">
                                    <div className="flex flex-row gap-2 mb-4">
                                        <Dropdown
                                            value={selectedFacility}
                                            options={facilityOptions}
                                            onChange={(e) =>
                                                setSelectedFacility(e.value)
                                            }
                                            placeholder="Select Facility"
                                            style={{ width: "100%" }}
                                            showClear
                                        />
                                        <Button
                                            label={
                                                isDateBlocked
                                                    ? "Unblock Date"
                                                    : "Block Date"
                                            }
                                            icon={
                                                isDateBlocked
                                                    ? "pi pi-unlock"
                                                    : "pi pi-ban"
                                            }
                                            severity={
                                                isDateBlocked
                                                    ? "success"
                                                    : "warning"
                                            }
                                            onClick={() =>
                                                isDateBlocked
                                                    ? handleUnblockDate()
                                                    : setShowBlockDialog(true)
                                            }
                                            disabled={loading}
                                            className="min-w-fit"
                                        />
                                    </div>
                                    <Calendar
                                        value={date}
                                        onChange={(e) => setDate(e.value)}
                                        // disabledDates={blockedDate.map(
                                        //     (bd) => new Date(bd.date)
                                        // )}
                                        dateTemplate={dateTemplate}
                                        inline
                                        style={{ width: "100%" }}
                                    />
                                </div>
                                <div className="md:w-1/2">
                                    {loading ? (
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "center",
                                                alignItems: "center",
                                                height: "480px",
                                            }}
                                        >
                                            <span>Loading...</span>
                                        </div>
                                    ) : isDateBlocked ? (
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "center",
                                                alignItems: "center",
                                                height: "480px",
                                                color: "#666",
                                            }}
                                        >
                                            <span>
                                                This date is blocked because:{" "}
                                                {isDateBlocked.reason}
                                            </span>
                                        </div>
                                    ) : bookingsList.length === 0 ? (
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "center",
                                                alignItems: "center",
                                                height: "480px",
                                                color: "#666",
                                            }}
                                        >
                                            <span>
                                                No bookings for this date and
                                                this facility.
                                            </span>
                                        </div>
                                    ) : (
                                        <div
                                            style={{
                                                padding: "10px",
                                                maxHeight: "480px",
                                                overflowY: "auto",
                                            }}
                                        >
                                            {bookingsList.map(
                                                (booking, index) => (
                                                    <div
                                                        key={index}
                                                        style={getBookingStyle(
                                                            booking.duration
                                                        )}
                                                    >
                                                        <strong>
                                                            {booking.facility
                                                                ?.name ||
                                                                "Unknown Facility"}
                                                        </strong>
                                                        <br />
                                                        {booking.student
                                                            ?.name ||
                                                            "Unknown Student"}{" "}
                                                        ({booking.startTime} -{" "}
                                                        {booking.endTime})
                                                        <br />
                                                        Status:{" "}
                                                        {booking.status.toUpperCase() ||
                                                            "N/A"}
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    )}
                </div>
                <Dialog
                    header="Block Date"
                    visible={showBlockDialog}
                    onHide={closeBlockDialog}
                    style={{ width: "30vw" }}
                    breakpoints={{ "960px": "75vw", "640px": "90vw" }}
                >
                    <div className="flex flex-col gap-4">
                        {error && <p style={{ color: "red" }}>{error}</p>}
                        <div>
                            <label
                                htmlFor="blockReason"
                                className="block mb-2 font-semibold"
                            >
                                Reason for Blocking
                            </label>
                            <InputText
                                id="blockReason"
                                value={blockReason}
                                onChange={(e) => setBlockReason(e.target.value)}
                                placeholder="Enter reason"
                                className="w-full"
                                maxLength={100}
                            />
                        </div>
                        <Button
                            label="Submit"
                            icon="pi pi-check"
                            onClick={handleBlockDate}
                            disabled={!blockReason.trim() || loading}
                        />
                    </div>
                </Dialog>
            </main>
        </div>
    );
}

export default Dashboard;
