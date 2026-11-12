import React, { useMemo, useState } from "react";
import { useListQuery } from "../store/hub-api";
import { useSaveRecord } from "../store/use-save-record";
import Header from "../shared/layout/Header";
import DataTable from "../shared/misc/DataTable";
import { Card } from "primereact/card";
import { Dialog } from "primereact/dialog";
import { FloatLabel } from "primereact/floatlabel";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";

/** Levels that expand to their classes, which expand to their students. */
function ManageLevelClassStudent() {
    const levelQuery = useListQuery({ type: "levels" });
    const classQuery = useListQuery({ type: "class" });
    const studentQuery = useListQuery({ type: "students" });
    const levelRecords = useSaveRecord("levels");
    const classRecords = useSaveRecord("class");
    const studentRecords = useSaveRecord("students");

    const [levelDialog, setLevelDialog] = useState(false);
    const [classDialog, setClassDialog] = useState(false);
    const [studentDialog, setStudentDialog] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({ name: "" });
    const [classFormData, setClassFormData] = useState({ name: "", level_id: null });
    const [studentFormData, setStudentFormData] = useState({ name: "", class_id: null });
    const mode = editId ? "edit" : "create";

    const levels = useMemo(
        () => (levelQuery.data ?? []).map((l) => ({ id: l.id, name: l.name })),
        [levelQuery.data]
    );
    const classes = useMemo(
        () =>
            (classQuery.data ?? []).map((c) => ({
                id: c.id,
                level_id: c.level_id,
                name: c.name,
                student_count: c.students?.length ?? 0,
            })),
        [classQuery.data]
    );
    const students = useMemo(
        () => (studentQuery.data ?? []).map((s) => ({ id: s.id, name: s.name, class_id: s.class_id })),
        [studentQuery.data]
    );

    const isDataReady = !levelQuery.isLoading && !classQuery.isLoading && !studentQuery.isLoading;
    const loading = levelRecords.saving || classRecords.saving || studentRecords.saving;
    const error = levelDialog ? levelRecords.error : classDialog ? classRecords.error : studentRecords.error;
    // DataTable calls this after an import; lists otherwise refresh through hubApi tags.
    const myFetch = () => {
        levelQuery.refetch();
        classQuery.refetch();
        studentQuery.refetch();
    };

    const open = (setDialog, setForm, records, form, id = null) => {
        setForm(form);
        setEditId(id);
        records.setError("");
        setDialog(true);
    };

    const handleAddLevel = () => open(setLevelDialog, setFormData, levelRecords, { name: "" });
    const handleEditLevel = (id) => {
        const level = levels.find((l) => l.id === id);
        if (level) open(setLevelDialog, setFormData, levelRecords, { name: level.name }, id);
    };
    const handleAddClass = (levelId) =>
        open(setClassDialog, setClassFormData, classRecords, { name: "", level_id: levelId });
    const handleEditClass = (id) => {
        const item = classes.find((c) => c.id === id);
        if (item) open(setClassDialog, setClassFormData, classRecords, { name: item.name, level_id: item.level_id }, id);
    };
    const handleAddStudent = (classId) =>
        open(setStudentDialog, setStudentFormData, studentRecords, { name: "", class_id: classId });
    const handleEditStudent = (id) => {
        const student = students.find((s) => s.id === id);
        if (student) open(setStudentDialog, setStudentFormData, studentRecords, { name: student.name, class_id: student.class_id }, id);
    };
    const handleDeleteClass = (id) => classRecords.remove(id);
    const handleDeleteStudent = (id) => studentRecords.remove(id);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };
    const handleClassChange = (e) => {
        const { name, value } = e.target;
        setClassFormData((prev) => ({ ...prev, [name]: value }));
    };
    const handleStudentChange = (e) => {
        const { name, value } = e.target;
        setStudentFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e, formType) => {
        e.preventDefault();
        const [records, data, close] = {
            levels: [levelRecords, formData, () => setLevelDialog(false)],
            class: [classRecords, classFormData, () => setClassDialog(false)],
            students: [studentRecords, studentFormData, () => setStudentDialog(false)],
        }[formType];
        if (await records.save(editId, data)) close();
    };

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
                                type="levels"
                                identifier="id"
                                hasImport={true}
                                hasExpand={true}
                                collection={levels}
                                onFetch={myFetch}
                                onAdd={handleAddLevel}
                                onEdit={handleEditLevel}
                                onDelete={levelRecords.remove}
                                onDeleteMany={levelRecords.removeMany}
                                onAddClass={handleAddClass}
                                onEditClass={handleEditClass}
                                onDeleteClass={handleDeleteClass}
                                onAddStudent={handleAddStudent}
                                onEditStudent={handleEditStudent}
                                onDeleteStudent={handleDeleteStudent}
                                title="Student"
                                classes={classes}
                                students={students}
                            />
                            <Dialog
                                header={
                                    mode === "create"
                                        ? "Add Level"
                                        : "Edit Level"
                                }
                                visible={levelDialog}
                                style={{ width: "400px" }}
                                onHide={() => setLevelDialog(false)}
                            >
                                <form
                                    onSubmit={(e) => handleSubmit(e, "levels")}
                                    className="mt-8"
                                >
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
                                                onChange={handleChange}
                                                style={{ width: "100%" }}
                                                required
                                                disabled={loading}
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
                                            onClick={() =>
                                                setLevelDialog(false)
                                            }
                                            className="p-button-text"
                                            disabled={loading}
                                        />
                                        <Button
                                            label={
                                                mode === "create"
                                                    ? "Create"
                                                    : "Update"
                                            }
                                            icon="pi pi-check"
                                            type="submit"
                                            disabled={loading}
                                            autoFocus
                                        />
                                    </div>
                                </form>
                            </Dialog>
                            <Dialog
                                header={
                                    mode === "create"
                                        ? "Add Class"
                                        : "Edit Class"
                                }
                                visible={classDialog}
                                style={{ width: "400px" }}
                                onHide={() => setClassDialog(false)}
                            >
                                <form
                                    onSubmit={(e) => handleSubmit(e, "class")}
                                    className="mt-8"
                                >
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
                                                value={classFormData.name}
                                                onChange={handleClassChange}
                                                style={{ width: "100%" }}
                                                required
                                                disabled={loading}
                                                tooltip="Enter class name"
                                                tooltipOptions={{
                                                    position: "bottom",
                                                    mouseTrack: true,
                                                    mouseTrackTop: 15,
                                                }}
                                            />
                                            <label htmlFor="name">Name</label>
                                        </FloatLabel>
                                    </div>
                                    <div style={{ marginBottom: "2rem" }}>
                                        <FloatLabel>
                                            <Dropdown
                                                id="level_id"
                                                name="level_id"
                                                value={classFormData.level_id}
                                                options={
                                                    Array.isArray(levels)
                                                        ? levels.map(
                                                              (level) => ({
                                                                  label: level.name,
                                                                  value: level.id,
                                                              })
                                                          )
                                                        : []
                                                }
                                                onChange={handleClassChange}
                                                style={{ width: "100%" }}
                                                required
                                                disabled={loading}
                                                placeholder={
                                                    Array.isArray(levels) &&
                                                    levels.length > 0
                                                        ? "Select a level"
                                                        : "No levels available"
                                                }
                                                tooltip="Select level for the class"
                                                tooltipOptions={{
                                                    position: "bottom",
                                                    mouseTrack: true,
                                                    mouseTrackTop: 15,
                                                }}
                                            />
                                            <label htmlFor="level_id">
                                                Level
                                            </label>
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
                                            onClick={() =>
                                                setClassDialog(false)
                                            }
                                            className="p-button-text"
                                            disabled={loading}
                                        />
                                        <Button
                                            label={
                                                mode === "create"
                                                    ? "Create"
                                                    : "Update"
                                            }
                                            icon="pi pi-check"
                                            type="submit"
                                            disabled={loading}
                                            autoFocus
                                        />
                                    </div>
                                </form>
                            </Dialog>
                            <Dialog
                                header={
                                    mode === "create"
                                        ? "Add Student"
                                        : "Edit Student"
                                }
                                visible={studentDialog}
                                style={{ width: "400px" }}
                                onHide={() => setStudentDialog(false)}
                            >
                                <form
                                    onSubmit={(e) =>
                                        handleSubmit(e, "students")
                                    }
                                    className="mt-8"
                                >
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
                                                value={studentFormData.name}
                                                onChange={handleStudentChange}
                                                style={{ width: "100%" }}
                                                required
                                                disabled={loading}
                                                tooltip="Enter student name"
                                                tooltipOptions={{
                                                    position: "bottom",
                                                    mouseTrack: true,
                                                    mouseTrackTop: 15,
                                                }}
                                            />
                                            <label htmlFor="name">Name</label>
                                        </FloatLabel>
                                    </div>
                                    <div style={{ marginBottom: "2rem" }}>
                                        <FloatLabel>
                                            <Dropdown
                                                id="class_id"
                                                name="class_id"
                                                value={studentFormData.class_id}
                                                options={
                                                    Array.isArray(classes)
                                                        ? classes.map(
                                                              (cls) => ({
                                                                  label: cls.name,
                                                                  value: cls.id,
                                                              })
                                                          )
                                                        : []
                                                }
                                                onChange={handleStudentChange}
                                                style={{ width: "100%" }}
                                                required
                                                disabled={loading}
                                                placeholder={
                                                    Array.isArray(classes) &&
                                                    classes.length > 0
                                                        ? "Select a class"
                                                        : "No classes available"
                                                }
                                                tooltip="Select class for the student"
                                                tooltipOptions={{
                                                    position: "bottom",
                                                    mouseTrack: true,
                                                    mouseTrackTop: 15,
                                                }}
                                            />
                                            <label htmlFor="class_id">
                                                Class
                                            </label>
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
                                            onClick={() =>
                                                setStudentDialog(false)
                                            }
                                            className="p-button-text"
                                            disabled={loading}
                                        />
                                        <Button
                                            label={
                                                mode === "create"
                                                    ? "Create"
                                                    : "Update"
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

export default ManageLevelClassStudent;
