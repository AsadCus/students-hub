import React, { useEffect, useRef, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAuthUser } from "react-auth-kit";
import { Button } from "primereact/button";
import { SplitButton } from "primereact/splitbutton";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { ProgressSpinner } from "primereact/progressspinner";
import { ConfirmPopup, confirmPopup } from "primereact/confirmpopup";
import { Dialog } from "primereact/dialog";
import { Toolbar } from "primereact/toolbar";
import { InputText } from "primereact/inputtext";
import { IconField } from "primereact/iconfield";
import { InputIcon } from "primereact/inputicon";
import { MultiSelect } from "primereact/multiselect";
import { OverlayPanel } from "primereact/overlaypanel";
import { FileUpload } from "primereact/fileupload";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import {
    deleteRecord,
    setToastMessage,
} from "../../store/global-slice";
import { Badge } from "primereact/badge";
import PropTypes from "prop-types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { DateTime } from "luxon";
import { useImportRecordsMutation } from "../../store/hub-api";

const CustomDataTable = ({
    title,
    type,
    identifier = "id",
    hasImport,
    hasExpand,
    onFetch = () => {},
    onAdd = () => {},
    onEdit = () => {},
    onConfirm = () => {},
    onCancel = () => {},
    onDelete = null,
    onDeleteMany = null,
    onAddQuestion = () => {},
    onEditQuestion = () => {},
    onDeleteQuestion = () => {},
    onAddClass = () => {},
    onEditClass = () => {},
    onDeleteClass = () => {},
    onAddStudent = () => {},
    onEditStudent = () => {},
    onDeleteStudent = () => {},
    onEditSubFacility = () => {},
    onReject = () => {},
    onReturn = () => {},
    onAddEquipment = () => {},
    onEditEquipment = () => {},
    onDeleteEquipment = () => {},
    equipment = [],
    timeFilter,
    setTimeFilter = () => {},
    dateFilter,
    setDateFilter = () => {},
    rangeFilter,
    setRangeFilter = () => {},
    questions = [],
    classes = [],
    students = [],
    subFacilities = [],
    collection: propCollection,
    supportStrategies = [],
    isGrouped = false,
}) => {
    const auth = useAuthUser();
    const dispatch = useDispatch();
    const dt = useRef(null);
    const overlayPanelRef = useRef(null);
    const prevRangeTimeRef = useRef(null);
    const {
        [type]: {
            data: reduxCollection = [],
            spinner,
            endPoints: dataEndPoints,
        } = {},
        support_strategies: { data: reduxSupportStrategies = [] } = {},
    } = useSelector((state) => state.global);
    const collection = propCollection || reduxCollection;
    const [importRecords] = useImportRecordsMutation();
    const supportStrategiesData =
        supportStrategies.length > 0
            ? supportStrategies
            : reduxSupportStrategies;
    const [selectedRecords, setSelectedRecords] = useState(null);
    const [deleteRecordsDialog, setDeleteRecordsDialog] = useState(false);
    const [globalFilter, setGlobalFilter] = useState("");
    const [visibleColumns, setVisibleColumns] = useState([]);
    const [userTimezone, setUserTimezone] = useState(null);
    const [filters] = useState({
        student: { value: null },
        level: { value: null },
        class: { value: null },
        activity: { value: null },
        facility: { value: null },
        support_strategies: { value: null },
        ...((type === "bookings" || type === "equipment_loans") && {
            status: { value: null },
        }),
    });
    const [filteredDataState, setFilteredDataState] = useState([]);
    const [expandedRows, setExpandedRows] = useState([]);
    const [questionExpandedRows, setQuestionExpandedRows] = useState([]);
    const [classExpandedRows, setClassExpandedRows] = useState([]);
    const [size, setSize] = useState("small");
    const [studentFilter, setStudentFilter] = useState("");
    const [strategyFilter, setStrategyFilter] = useState(null);
    const [filterType, setFilterType] = useState("range");
    const sizeOptions = [
        { label: "Small", value: "small" },
        { label: "Normal", value: "normal" },
        { label: "Large", value: "large" },
    ];

    useEffect(() => {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setUserTimezone(timezone);

        if (
            Array.isArray(collection) &&
            collection.length > 0 &&
            collection.every(
                (item) =>
                    typeof item === "object" &&
                    item !== null &&
                    Object.keys(item).length > 0 &&
                    (type === "counsels" && !isGrouped
                        ? Object.values(item).every(
                              (value) =>
                                  !Array.isArray(value) ||
                                  value === null ||
                                  value === item.answers
                          )
                        : isGrouped
                        ? Object.keys(item).includes("date") &&
                          Array.isArray(item.counsels)
                        : Object.values(item).every(
                              (value) =>
                                  !Array.isArray(value) &&
                                  (typeof value !== "object" || value === null)
                          ))
            )
        ) {
            const allColumns = generateColumns();
            const defaultHidden = [
                "id",
                "reason",
                "email_verified_at",
                "created_at",
                "updated_at",
                "answers",
                ...(type === "counsels" && isGrouped
                    ? ["date", "counsels"]
                    : []),
            ];
            const isHiddenField = (field) => {
                if (defaultHidden.includes(field)) return true;
                return field.endsWith("_id");
            };
            const initialVisible = allColumns.filter(
                (col) => !isHiddenField(col.field) && col.field !== "actions"
            );
            setVisibleColumns(initialVisible);
        }
    }, [collection, isGrouped, type]);

    const formatDateToLocal = (utcDate, format = null) => {
        if (!utcDate || !userTimezone) return "";
        const dt = DateTime.fromISO(utcDate, { zone: "utc" });
        if (!dt.isValid) {
            return "";
        }
        if (format === "date") {
            return dt.setZone(userTimezone).toFormat("dd MMMM yyyy");
        } else {
            return dt
                .setZone(userTimezone)
                .toFormat("dd MMMM yyyy, HH:mm:ss z");
        }
    };

    const capitalize = (str) => {
        if (!str) return str;
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    };

    const handleDelete = (event, id) => {
        confirmPopup({
            target: event.currentTarget,
            message: `Do you want to delete this ${
                type === "support_strategies" ? "support strategy" : type
            }?`,
            icon: "pi pi-info-circle",
            acceptClassName: "p-button-danger",
            accept: () => {
                if (onDelete) {
                    onDelete(id);
                } else {
                    dispatch(
                        deleteRecord({
                            endPoint: `${dataEndPoints.delete}${id}`,
                        })
                    ).then((success) => {
                        if (success) {
                            dispatch(
                                setToastMessage({
                                    severity: "success",
                                    summary: "Success",
                                    detail: `${capitalize(type)} deleted`,
                                    life: 3000,
                                })
                            );
                            onFetch();
                        }
                    });
                }
            },
        });
    };

    const handleQuestionDelete = (event, id) => {
        confirmPopup({
            target: event.currentTarget,
            message: `Do you want to delete this question?`,
            icon: "pi pi-info-circle",
            acceptClassName: "p-button-danger",
            accept: () => {
                onDeleteQuestion(id);
            },
        });
    };

    const handleReject = (event, id) => {
        confirmPopup({
            target: event.currentTarget,
            message: `Do you want to reject this loan request?`,
            icon: "pi pi-info-circle",
            acceptClassName: "p-button-danger",
            accept: () => onReject(id),
        });
    };

    const handleReturn = (event, id) => {
        confirmPopup({
            target: event.currentTarget,
            message: `Mark this loan as returned?`,
            icon: "pi pi-info-circle",
            acceptClassName: "p-button-success",
            accept: () => onReturn(id),
        });
    };

    const handleEquipmentDelete = (event, id) => {
        confirmPopup({
            target: event.currentTarget,
            message: `Do you want to delete this equipment?`,
            icon: "pi pi-info-circle",
            acceptClassName: "p-button-danger",
            accept: () => onDeleteEquipment(id),
        });
    };

    const handleClassDelete = (event, id) => {
        confirmPopup({
            target: event.currentTarget,
            message: `Do you want to delete this class?`,
            icon: "pi pi-info-circle",
            acceptClassName: "p-button-danger",
            accept: () => {
                onDeleteClass(id);
            },
        });
    };

    const handleStudentDelete = (event, id) => {
        confirmPopup({
            target: event.currentTarget,
            message: `Do you want to delete this student?`,
            icon: "pi pi-info-circle",
            acceptClassName: "p-button-danger",
            accept: () => {
                onDeleteStudent(id);
            },
        });
    };

    const recordNoun = type === "equipment_loans" ? "loan" : "booking";

    const handleConfirm = (event, id) => {
        confirmPopup({
            target: event.currentTarget,
            message: `Do you want to ${
                type === "equipment_loans" ? "approve" : "confirm"
            } this ${recordNoun}?`,
            icon: "pi pi-info-circle",
            acceptClassName: "p-button-success",
            accept: () => {
                onConfirm(id);
            },
        });
    };

    const handleCancel = (event, id) => {
        confirmPopup({
            target: event.currentTarget,
            message: `Do you want to cancel this ${recordNoun}?`,
            icon: "pi pi-info-circle",
            acceptClassName: "p-button-danger",
            accept: () => {
                onCancel(id);
            },
        });
    };

    const confirmDeleteSelected = () => {
        if (selectedRecords && selectedRecords.length > 0) {
            setDeleteRecordsDialog(true);
        }
    };

    const deleteSelectedRecords = () => {
        if (onDeleteMany) {
            onDeleteMany(selectedRecords.map((record) => record[identifier]));
        } else if (onDelete) {
            selectedRecords.forEach((record) => onDelete(record[identifier]));
        } else {
            Promise.all(
                selectedRecords.map((record) =>
                    dispatch(
                        deleteRecord({
                            endPoint: `${dataEndPoints.delete}${record[identifier]}`,
                        })
                    )
                )
            ).then((results) => {
                if (results.every((success) => success)) {
                    dispatch(
                        setToastMessage({
                            severity: "success",
                            summary: "Success",
                            detail: `${selectedRecords.length} ${type} deleted`,
                            life: 3000,
                        })
                    );
                    onFetch();
                }
            });
        }
        setDeleteRecordsDialog(false);
        setSelectedRecords(null);
    };

    const formatAnswersForExport = (item) => {
        if (type !== "counsels" || !item.answers) return "";
        const strategyIds = [
            ...new Set(item.answers.map((a) => a.question.support_strategy_id)),
        ];
        return strategyIds
            .map((strategyId) => {
                const strategy = supportStrategiesData.find(
                    (s) => s.id === strategyId
                );
                const strategyName = strategy
                    ? strategy.name
                    : `Strategy ${strategyId}`;
                const strategyAnswers = item.answers.filter(
                    (a) => a.question.support_strategy_id === strategyId
                );
                return (
                    `Section: ${strategyName}\n` +
                    strategyAnswers
                        .map(
                            (a) =>
                                `- ${a.question.text} Answer: ${
                                    a.question.type === "radio"
                                        ? a.radio_option?.text || "N/A"
                                        : a.text || "N/A"
                                }`
                        )
                        .join("\n")
                );
            })
            .join("\n\n");
    };

    const generateLevelClassStudentData = () => {
        const data = [];
        if (hasExpand && type === "levels" && !isGrouped) {
            collection.forEach((level) => {
                const levelClasses = classes.filter(
                    (cls) => cls.level_id === level.id
                );
                if (levelClasses.length === 0) {
                    data.push({
                        Level: level.name,
                        Class: "",
                        Student: "",
                    });
                } else {
                    levelClasses.forEach((cls) => {
                        const classStudents = students.filter(
                            (stu) => stu.class_id === cls.id
                        );
                        if (classStudents.length === 0) {
                            data.push({
                                Level: level.name,
                                Class: cls.name,
                                Student: "",
                            });
                        } else {
                            classStudents.forEach((stu) => {
                                data.push({
                                    Level: level.name,
                                    Class: cls.name,
                                    Student: stu.name,
                                });
                            });
                        }
                    });
                }
            });
        }
        return data;
    };

    const generateFacilitySubfacilityData = () => {
        const data = [];

        collection.forEach((facility) => {
            data.push({
                Facility: facility.name,
                Parent: "",
            });

            const relatedSubs = subFacilities.filter(
                (sub) => sub.parent_id === facility.id
            );

            relatedSubs.forEach((sub) => {
                data.push({
                    Facility: sub.name,
                    Parent: facility.name,
                });
            });
        });

        return data;
    };

    const exportExcel = () => {
        if (hasExpand && type === "levels" && !isGrouped) {
            const dataToExport = generateLevelClassStudentData();
            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(
                workbook,
                worksheet,
                "Level-Class-Student"
            );
            XLSX.writeFile(workbook, "level_class_student_data.xlsx");
        } else if (hasExpand && type === "facilities" && !isGrouped) {
            const dataToExport = generateFacilitySubfacilityData();
            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Facility");
            XLSX.writeFile(workbook, "facility_and_subfacility_data.xlsx");
        } else if (type === "counsels" && isGrouped) {
            const dataToExport = [];
            filteredDataState.forEach((group) => {
                group.counsels.forEach((counsel) => {
                    dataToExport.push({
                        Date: formatDateToLocal(counsel.created_at, "date"),
                        Level: counsel.level || "N/A",
                        Class: counsel.class || "N/A",
                        Student: counsel.student || "N/A",
                        "Support Strategies": counsel.support_strategies || "",
                        "Questions and Answers":
                            formatAnswersForExport(counsel),
                    });
                });
            });
            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Counsels");
            XLSX.writeFile(workbook, "counsels_data.xlsx");
        } else {
            const dataToExport = filteredDataState.map((item) => {
                const rowData = {};
                visibleColumns.forEach((col) => {
                    rowData[col.header] = item[col.field] || "";
                });
                if (type === "counsels") {
                    rowData["Date"] = formatDateToLocal(
                        item.created_at,
                        "datetime"
                    );
                    rowData["Questions and Answers"] =
                        formatAnswersForExport(item);
                }
                return rowData;
            });
            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
            XLSX.writeFile(workbook, `${type}_data.xlsx`);
        }
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        if (hasExpand && type === "levels" && !isGrouped) {
            const columns = ["Level", "Class", "Student"];
            const body = generateLevelClassStudentData().map((item) => [
                item.Level,
                item.Class,
                item.Student,
            ]);
            autoTable(doc, {
                head: [columns],
                body,
                styles: { fontSize: 10 },
                margin: { top: 10 },
            });
            doc.save("level_class_student_data.pdf");
        } else if (hasExpand && type === "facilities" && !isGrouped) {
            const columns = ["Facility", "Parent"];
            const body = generateFacilitySubfacilityData().map((item) => [
                item.Facility,
                item.Parent,
            ]);
            autoTable(doc, {
                head: [columns],
                body,
                styles: { fontSize: 10 },
                margin: { top: 10 },
            });
            doc.save("facility_data.pdf");
        } else if (type === "counsels" && isGrouped) {
            const columns = [
                "Date",
                "Level",
                "Class",
                "Student",
                "Support Strategies",
                "Questions and Answers",
            ];
            const body = [];
            filteredDataState.forEach((group) => {
                group.counsels.forEach((counsel) => {
                    body.push([
                        formatDateToLocal(counsel.created_at, "date"),
                        counsel.level || "N/A",
                        counsel.class || "N/A",
                        counsel.student || "N/A",
                        counsel.support_strategies || "",
                        formatAnswersForExport(counsel),
                    ]);
                });
            });
            autoTable(doc, {
                head: [columns],
                body,
                styles: { fontSize: 10 },
                margin: { top: 10 },
            });
            doc.save("counsels_data.pdf");
        } else {
            const columns = [
                ...visibleColumns.map((col) => col.header),
                ...(type === "counsels"
                    ? ["Date", "Questions and Answers"]
                    : []),
            ];
            const body = filteredDataState.map((item) => [
                ...visibleColumns.map((col) => item[col.field] || ""),
                ...(type === "counsels"
                    ? [
                          formatDateToLocal(item.created_at, "date"),
                          formatAnswersForExport(item),
                      ]
                    : []),
            ]);
            autoTable(doc, {
                head: [columns],
                body,
                styles: { fontSize: 10 },
                margin: { top: 10 },
                columnStyles:
                    type === "counsels"
                        ? { [columns.length - 1]: { cellWidth: 100 } }
                        : {},
            });
            doc.save(`${type}_data.pdf`);
        }
    };

    const handleFileUpload = (event) => {
        const file = event.files[0];
        if (!file) return;

        // Lists refresh through hubApi tags; onFetch also covers legacy pages.
        // The result ("2 added, 3 updated") or the error is toasted by api-toasts.
        importRecords({ type, file, hasExpand: type === "levels" && !!hasExpand })
            .unwrap()
            .then(() => onFetch())
            .catch(() => {})
            .finally(() => overlayPanelRef.current?.hide());
    };

    const getUniqueStrategies = () => {
        const strategies = new Set();
        collection.forEach((group) =>
            group.counsels.forEach((counsel) => {
                if (counsel.support_strategies) {
                    counsel.support_strategies
                        .split(", ")
                        .forEach((strategy) => {
                            if (strategy) strategies.add(strategy);
                        });
                }
            })
        );
        return Array.from(strategies).map((strategy) => ({
            label: strategy,
            value: strategy,
        }));
    };

    const leftToolbarTemplate = () => {
        const permissions = auth()?.permissions || [];
        const canCreate = permissions.includes(`${type} create`);
        const canDelete = permissions.includes(`${type} delete`);

        return (
            <div className="flex flex-wrap gap-2">
                {type !== "counsels" && canCreate && (
                    <Button
                        label="Add"
                        icon="pi pi-plus"
                        severity="success"
                        onClick={onAdd}
                    />
                )}
                {type !== "counsels" && canDelete && (
                    <Button
                        label="Delete"
                        icon="pi pi-trash"
                        severity="danger"
                        onClick={confirmDeleteSelected}
                        disabled={!selectedRecords || !selectedRecords.length}
                    />
                )}
                {type === "counsels" && (
                    <>
                        <IconField className="flex items-center w-32">
                            <InputIcon className="pi pi-search" />
                            <InputText
                                type="search"
                                value={studentFilter}
                                onChange={(e) =>
                                    setStudentFilter(e.target.value)
                                }
                                placeholder="Search Student"
                                className="w-full"
                                tooltip="Search student"
                                tooltipOptions={{ position: "top" }}
                            />
                        </IconField>
                        <Dropdown
                            value={strategyFilter}
                            options={getUniqueStrategies()}
                            onChange={(e) => setStrategyFilter(e.value)}
                            placeholder="Select Support"
                            showClear
                            tooltip="Select support"
                            tooltipOptions={{ position: "top" }}
                        />
                    </>
                )}
                <Dropdown
                    value={size}
                    options={sizeOptions}
                    onChange={(e) => setSize(e.value)}
                    placeholder="Select Size"
                    style={{ width: "150px" }}
                    tooltip="Select size"
                    tooltipOptions={{ position: "top" }}
                />
            </div>
        );
    };

    const filterItems = [
        {
            label: "Time Period",
            command: () => setFilterType("time"),
            type: "time",
        },
        {
            label: "Date Range",
            command: () => setFilterType("range"),
            type: "range",
        },
    ];

    const handleFilter = () => {
        if (filterType === "time" && timeFilter) {
            onFetch({
                timeFilter,
                dateFilter: null,
                rangeFilter: null,
            });
        } else if (filterType === "date" && dateFilter) {
            onFetch({
                timeFilter: null,
                dateFilter,
                rangeFilter: null,
            });
        } else if (
            filterType === "range" &&
            rangeFilter &&
            rangeFilter[0] &&
            rangeFilter[1]
        ) {
            onFetch({
                timeFilter: null,
                dateFilter: null,
                rangeFilter,
            });
        } else {
            onFetch({
                timeFilter: null,
                dateFilter: null,
                rangeFilter: null,
            });
        }
    };

    const rightToolbarTemplate = () => {
        const timeOptions = [
            { label: "Today", value: "today" },
            { label: "This Week", value: "week" },
            { label: "This Month", value: "month" },
            { label: "This Year", value: "year" },
            { label: "Last Year", value: "last-year" },
        ];

        return (
            <div className="flex flex-wrap gap-2">
                <Button
                    label="Excel"
                    icon="pi pi-file-excel"
                    severity="success"
                    onClick={exportExcel}
                />
                <Button
                    label="PDF"
                    icon="pi pi-file-pdf"
                    severity="warning"
                    onClick={exportPDF}
                />
                {hasImport && (
                    <Button
                        label="Import"
                        icon="pi pi-upload"
                        severity="info"
                        onClick={(e) => overlayPanelRef.current.toggle(e)}
                    />
                )}
                {(type === "checkin" ||
                    type === "bookings" ||
                    type === "equipment_loans" ||
                    type === "counsels") && (
                    <>
                        {/* <Dropdown
                            value={filterItems.find(
                                (item) => item.type === filterType
                            )}
                            options={filterItems}
                            onChange={(e) => setFilterType(e.value.type)}
                            optionLabel="label"
                            placeholder="Select filter type"
                            tooltip="Select filter type"
                            tooltipOptions={{ position: "top" }}
                        /> */}
                        {/* {filterType === "time" && (
                            <Dropdown
                                value={timeFilter}
                                options={timeOptions}
                                onChange={(e) => {
                                    const value = e.value;

                                    if (value === undefined || value === null) {
                                        setTimeFilter(null);
                                        setDateFilter(null);
                                        setRangeFilter(null);

                                        onFetch({
                                            timeFilter: null,
                                            dateFilter: null,
                                            rangeFilter: null,
                                        });
                                    } else {
                                        setTimeFilter(value);
                                        setDateFilter(null);
                                        setRangeFilter(null);

                                        onFetch({
                                            timeFilter: value,
                                            dateFilter: null,
                                            rangeFilter: null,
                                        });
                                    }
                                }}
                                placeholder="Select Date Period"
                                style={{ width: "180px" }}
                                showClear
                                tooltip="Select date period"
                                tooltipOptions={{ position: "top" }}
                            />
                        )} */}
                        {filterType === "range" && (
                            <Calendar
                                value={rangeFilter}
                                selectionMode="range"
                                dateFormat="yy-mm-dd"
                                placeholder="Select Date"
                                className="w-fit"
                                showButtonBar
                                onChange={(e) => {
                                    const value = e.value;
                                    setRangeFilter(value);
                                    setDateFilter(null);
                                    setTimeFilter(null);

                                    const wasCleared =
                                        prevRangeTimeRef.current &&
                                        value === null;
                                    prevRangeTimeRef.current = value;

                                    if (wasCleared) {
                                        setRangeFilter(null);
                                        setDateFilter(null);
                                        setTimeFilter(null);
                                    }
                                }}
                                onHide={() => {
                                    const value = rangeFilter;

                                    const wasCleared =
                                        prevRangeTimeRef.current &&
                                        value === null;
                                    prevRangeTimeRef.current = value;

                                    if (wasCleared) {
                                        setRangeFilter(null);
                                        setDateFilter(null);
                                        setTimeFilter(null);

                                        onFetch({
                                            timeFilter: null,
                                            dateFilter: null,
                                            rangeFilter: null,
                                        });
                                    } else {
                                        setRangeFilter(value);
                                        setDateFilter(null);
                                        setTimeFilter(null);

                                        onFetch({
                                            timeFilter: null,
                                            dateFilter: null,
                                            rangeFilter: value,
                                        });
                                    }
                                }}
                                tooltip="Select date"
                                tooltipOptions={{ position: "top" }}
                            />
                        )}
                    </>
                )}
            </div>
        );
    };

    const actionsTemplate = (rowData) => {
        if (type === "counsels") return null;

        const permissions = auth()?.permissions || [];
        const canEdit = permissions.includes(`${type} edit`);
        const canDelete = permissions.includes(`${type} delete`);

        const actions = [
            ...(canEdit
                ? [
                      {
                          label: "Edit",
                          icon: "pi pi-pencil",
                          command: () => onEdit(rowData[identifier]),
                      },
                  ]
                : []),
            ...(canDelete
                ? [
                      {
                          label: "Delete",
                          icon: "pi pi-trash",
                          command: (event) =>
                              handleDelete(
                                  event.originalEvent,
                                  rowData[identifier]
                              ),
                      },
                  ]
                : []),
            ...(type === "support_strategies"
                ? [
                      {
                          label: "Add Question",
                          icon: "pi pi-plus",
                          command: () => onAddQuestion(rowData[identifier]),
                      },
                  ]
                : []),
            ...(type === "levels"
                ? [
                      {
                          label: "Add Class",
                          icon: "pi pi-plus",
                          command: () => onAddClass(rowData[identifier]),
                      },
                  ]
                : []),
            ...(type === "ccas" && permissions.includes("equipment create")
                ? [
                      {
                          label: "Add Equipment",
                          icon: "pi pi-plus",
                          command: () => onAddEquipment(rowData[identifier]),
                      },
                  ]
                : []),
        ];

        if (type === "equipment_loans") {
            // "overdue" is a reserved loan past its end date.
            const status =
                rowData.status === "overdue" ? "reserved" : rowData.status;
            const canConfirm = permissions.includes("equipment_loans confirm");
            const id = rowData[identifier];
            // Edit only makes sense while the loan still holds stock.
            if (status !== "requested" && status !== "reserved") {
                const editIndex = actions.findIndex((a) => a.label === "Edit");
                if (editIndex !== -1) actions.splice(editIndex, 1);
            }
            if (canConfirm && status === "requested") {
                actions.push(
                    {
                        label: "Approve",
                        icon: "pi pi-check",
                        command: (event) => handleConfirm(event.originalEvent, id),
                    },
                    {
                        label: "Reject",
                        icon: "pi pi-ban",
                        command: (event) => handleReject(event.originalEvent, id),
                    }
                );
            }
            if (canConfirm && status === "reserved") {
                actions.push({
                    label: "Mark returned",
                    icon: "pi pi-replay",
                    command: (event) => handleReturn(event.originalEvent, id),
                });
            }
            if (
                canEdit &&
                (status === "requested" ||
                    (status === "reserved" &&
                        rowData.start_date > DateTime.now().toISODate()))
            ) {
                actions.push({
                    label: "Cancel",
                    icon: "pi pi-times",
                    command: (event) => handleCancel(event.originalEvent, id),
                });
            }
        }

        if (type === "bookings") {
            if (rowData.status === "requested") {
                actions.push({
                    label: "Confirm",
                    icon: "pi pi-check",
                    command: (event) =>
                        handleConfirm(event.originalEvent, rowData[identifier]),
                });
            }
            if (
                rowData.status === "requested" ||
                rowData.status === "reserved"
            ) {
                actions.push({
                    label: "Cancel",
                    icon: "pi pi-times",
                    command: (event) =>
                        handleCancel(event.originalEvent, rowData[identifier]),
                });
            }
        }

        return actions.length > 0 ? (
            <SplitButton
                label=""
                size={size}
                icon="pi pi-search"
                dropdownIcon="pi pi-cog"
                model={actions}
                outlined
            />
        ) : null;
    };

    const questionActionsTemplate = (rowData) => {
        const permissions = auth()?.permissions || [];
        const canEdit = permissions.includes("questions edit");
        const canDelete = permissions.includes("questions delete");

        const actions = [
            ...(canEdit
                ? [
                      {
                          label: "Edit",
                          icon: "pi pi-pencil",
                          command: () => onEditQuestion(rowData.id),
                      },
                  ]
                : []),
            ...(canDelete
                ? [
                      {
                          label: "Delete",
                          icon: "pi pi-trash",
                          command: (event) =>
                              handleQuestionDelete(
                                  event.originalEvent,
                                  rowData.id
                              ),
                      },
                  ]
                : []),
        ];

        return (
            <SplitButton
                label=""
                size={size}
                icon="pi pi-search"
                dropdownIcon="pi pi-cog"
                model={actions}
                outlined
            />
        );
    };

    const classActionsTemplate = (rowData) => {
        const permissions = auth()?.permissions || [];
        const canEdit = permissions.includes("class edit");
        const canDelete = permissions.includes("class delete");

        const actions = [
            ...(canEdit
                ? [
                      {
                          label: "Edit",
                          icon: "pi pi-pencil",
                          command: () => onEditClass(rowData.id),
                      },
                  ]
                : []),
            ...(canDelete
                ? [
                      {
                          label: "Delete",
                          icon: "pi pi-trash",
                          command: (event) =>
                              handleClassDelete(
                                  event.originalEvent,
                                  rowData.id
                              ),
                      },
                  ]
                : []),
            {
                label: "Add Student",
                icon: "pi pi-plus",
                command: () => onAddStudent(rowData.id),
            },
        ];

        return (
            <SplitButton
                label=""
                size={size}
                icon="pi pi-search"
                dropdownIcon="pi pi-cog"
                model={actions}
                outlined
            />
        );
    };

    const studentActionsTemplate = (rowData) => {
        const permissions = auth()?.permissions || [];
        const canEdit = permissions.includes("students edit");
        const canDelete = permissions.includes("students delete");

        const actions = [
            ...(canEdit
                ? [
                      {
                          label: "Edit",
                          icon: "pi pi-pencil",
                          command: () => onEditStudent(rowData.id),
                      },
                  ]
                : []),
            ...(canDelete
                ? [
                      {
                          label: "Delete",
                          icon: "pi pi-trash",
                          command: (event) =>
                              handleStudentDelete(
                                  event.originalEvent,
                                  rowData.id
                              ),
                      },
                  ]
                : []),
        ];

        return (
            <SplitButton
                label=""
                size={size}
                icon="pi pi-search"
                dropdownIcon="pi pi-cog"
                model={actions}
                outlined
            />
        );
    };

    const equipmentActionsTemplate = (rowData) => {
        const permissions = auth()?.permissions || [];
        const actions = [
            ...(permissions.includes("equipment edit")
                ? [
                      {
                          label: "Edit",
                          icon: "pi pi-pencil",
                          command: () => onEditEquipment(rowData.id),
                      },
                  ]
                : []),
            ...(permissions.includes("equipment delete")
                ? [
                      {
                          label: "Delete",
                          icon: "pi pi-trash",
                          command: (event) =>
                              handleEquipmentDelete(
                                  event.originalEvent,
                                  rowData.id
                              ),
                      },
                  ]
                : []),
        ];

        return actions.length > 0 ? (
            <SplitButton
                label=""
                size={size}
                icon="pi pi-search"
                dropdownIcon="pi pi-cog"
                model={actions}
                outlined
            />
        ) : null;
    };

    const subFacilityActionsTemplate = (rowData) => {
        const permissions = auth()?.permissions || [];
        const canEdit = permissions.includes("facilities edit");
        const canDelete = permissions.includes("facilities delete");

        const actions = [
            ...(canEdit
                ? [
                      {
                          label: "Edit",
                          icon: "pi pi-pencil",
                          command: () => onEditSubFacility(rowData.id),
                      },
                  ]
                : []),
            ...(canDelete
                ? [
                      {
                          label: "Delete",
                          icon: "pi pi-trash",
                          command: (event) =>
                              handleDelete(event.originalEvent, rowData.id),
                      },
                  ]
                : []),
        ];

        return (
            <SplitButton
                label=""
                size={size}
                icon="pi pi-search"
                dropdownIcon="pi pi-cog"
                model={actions}
                outlined
            />
        );
    };

    const formattedData = useMemo(() => {
        if (!Array.isArray(collection)) return [];

        return isGrouped
            ? collection.map((group) => ({
                  ...group,
                  counsels: group.counsels.filter((counsel) => {
                      const matchesStudent =
                          !studentFilter ||
                          (counsel.student &&
                              counsel.student
                                  .toLowerCase()
                                  .includes(studentFilter.toLowerCase()));
                      const matchesStrategy =
                          !strategyFilter ||
                          counsel.support_strategies.includes(strategyFilter);
                      return matchesStudent && matchesStrategy;
                  }),
              }))
            : collection.map((item) => ({
                  ...item,
                  checkin_time: item.checkin_time
                      ? formatDateToLocal(item.checkin_time)
                      : "",
                  checkout_time: item.checkout_time
                      ? formatDateToLocal(item.checkout_time)
                      : "",
                  start_time: item.start_time
                      ? formatDateToLocal(item.start_time)
                      : "",
                  end_time: item.end_time
                      ? formatDateToLocal(item.end_time)
                      : "",
                  created_at: item.created_at
                      ? formatDateToLocal(item.created_at)
                      : "",
                  updated_at: item.updated_at
                      ? formatDateToLocal(item.updated_at)
                      : "",
              }));
    }, [collection, studentFilter, strategyFilter, userTimezone]);

    // f, worst decision using this
    useEffect(() => {
        setFilteredDataState(formattedData);
    }, [formattedData, studentFilter, strategyFilter]);

    const questionRowExpansionTemplate = (question) => {
        if (question.type !== "radio") return null;

        const radioOptions = Array.isArray(question.radio_options)
            ? question.radio_options
            : [];

        return (
            <div className="p-3">
                <h5 className="font-bold mb-2">Answers from {question.text}</h5>
                <DataTable
                    value={radioOptions.map((opt, index) => ({
                        id: index,
                        text: opt,
                    }))}
                    size={size}
                    dataKey="id"
                    tableStyle={{ minWidth: "30rem" }}
                    emptyMessage="No answers found."
                >
                    <Column
                        field="text"
                        header="Answer"
                        sortable
                        style={{ width: "100%" }}
                    />
                </DataTable>
            </div>
        );
    };

    const classRowExpansionTemplate = (item) => {
        const classStudents = Array.isArray(students)
            ? students.filter((q) => q.class_id === item.id)
            : [];

        return (
            <div className="p-3">
                {/* <h5 className="font-bold mb-2">Students from {item.name}</h5> */}
                <DataTable
                    value={classStudents}
                    size={size}
                    dataKey="id"
                    tableStyle={{ minWidth: "50rem" }}
                    emptyMessage="No students found."
                >
                    <Column
                        header="#"
                        body={indexTemplate}
                        style={{ width: "3rem" }}
                        exportable={false}
                    />
                    <Column field="name" header="Student" sortable />
                    <Column header="Actions" body={studentActionsTemplate} />
                </DataTable>
            </div>
        );
    };

    const rowExpansionTemplate = (data) => {
        if (isGrouped) {
            return (
                <div className="p-3">
                    <h5 className="font-bold mb-2">
                        Counsels for {data.formattedDate}
                    </h5>
                    <DataTable
                        value={data.counsels}
                        size={size}
                        dataKey="id"
                        tableStyle={{ minWidth: "50rem" }}
                        emptyMessage="No counsels found."
                        expandedRows={expandedRows}
                        onRowToggle={(e) => setExpandedRows(e.data)}
                        rowExpansionTemplate={counselRowExpansionTemplate}
                    >
                        <Column
                            expander={(rowData) => rowData?.answers?.length > 0}
                            style={{ width: "3rem" }}
                            exportable={false}
                        />
                        <Column
                            header="#"
                            body={indexTemplate}
                            style={{ width: "3rem" }}
                            exportable={false}
                        />
                        <Column field="level" header="Level" sortable />
                        <Column field="class" header="Class" sortable />
                        <Column field="student" header="Student" sortable />
                        <Column
                            field="support_strategies"
                            header="Support Strategies"
                            sortable
                        />
                    </DataTable>
                </div>
            );
        }

        if (type === "counsels") {
            return counselRowExpansionTemplate(data);
        }
        if (type === "support_strategies") {
            const strategyQuestions = Array.isArray(questions)
                ? questions.filter((q) => q.support_strategy_id === data.id)
                : [];

            const allowExpansionForSupportStrategy = (rowData) => {
                return rowData?.radio_options?.length > 0;
            };

            return (
                <div className="p-3">
                    <h5 className="font-bold mb-2">
                        Questions from {data.name}
                    </h5>
                    <DataTable
                        value={strategyQuestions}
                        size={size}
                        dataKey="id"
                        tableStyle={{ minWidth: "50rem" }}
                        emptyMessage="No questions found."
                        expandedRows={questionExpandedRows}
                        onRowToggle={(e) => setQuestionExpandedRows(e.data)}
                        rowExpansionTemplate={questionRowExpansionTemplate}
                    >
                        <Column
                            expander={allowExpansionForSupportStrategy}
                            style={{ width: "3rem" }}
                            exportable={false}
                        />
                        <Column
                            field="order"
                            header="Order"
                            sortable
                            style={{ width: "3rem" }}
                        />
                        <Column
                            field="text"
                            header="Question Text"
                            sortable
                            style={{ minWidth: "50%" }}
                        />
                        <Column
                            field="type"
                            header="Type"
                            sortable
                            body={(rowData) =>
                                rowData.type === "radio"
                                    ? "Multiple Choices"
                                    : capitalize(rowData.type)
                            }
                        />
                        <Column
                            header="Actions"
                            body={questionActionsTemplate}
                        />
                    </DataTable>
                </div>
            );
        }
        if (type === "levels") {
            const levelClasses = Array.isArray(classes)
                ? classes.filter((q) => q.level_id === data.id)
                : [];

            return (
                <div className="p-3">
                    {/* <h5 className="font-bold mb-2">Classes from {data.name}</h5> */}
                    <DataTable
                        value={levelClasses}
                        size={size}
                        dataKey="id"
                        tableStyle={{ minWidth: "50rem" }}
                        emptyMessage="No classes found."
                        expandedRows={classExpandedRows}
                        onRowToggle={(e) => setClassExpandedRows(e.data)}
                        rowExpansionTemplate={classRowExpansionTemplate}
                    >
                        <Column
                            expander={(rowData) => {
                                const classStudents = Array.isArray(students)
                                    ? students.filter(
                                          (q) => q.class_id === rowData?.id
                                      )
                                    : [];
                                return classStudents.length > 0;
                            }}
                            style={{ width: "3rem" }}
                            exportable={false}
                        />
                        <Column
                            header="#"
                            body={indexTemplate}
                            style={{ width: "3rem" }}
                            exportable={false}
                        />
                        <Column field="name" header="Class" sortable />
                        <Column
                            field="student_count"
                            header="Total Number of Student"
                            sortable
                        />
                        <Column header="Actions" body={classActionsTemplate} />
                    </DataTable>
                </div>
            );
        }
        if (type === "ccas") {
            const listEquipment = equipment.filter((e) => e.cca_id === data.id);

            return (
                <div className="p-3">
                    <DataTable
                        value={listEquipment}
                        size={size}
                        dataKey="id"
                        tableStyle={{ minWidth: "50rem" }}
                        emptyMessage="No equipment in this CCA yet."
                    >
                        <Column
                            header="#"
                            body={indexTemplate}
                            style={{ width: "3rem" }}
                            exportable={false}
                        />
                        <Column field="name" header="Equipment" sortable />
                        <Column field="code" header="Code" sortable />
                        <Column field="quantity" header="Quantity" sortable />
                        <Column
                            field="active"
                            header="Available"
                            body={(row) => (
                                <Badge
                                    value={row.active ? "Yes" : "No"}
                                    severity={row.active ? "success" : "secondary"}
                                />
                            )}
                        />
                        <Column header="Actions" body={equipmentActionsTemplate} />
                    </DataTable>
                </div>
            );
        }
        if (type === "facilities") {
            const listSubFacilites = Array.isArray(subFacilities)
                ? subFacilities.filter((q) => q.parent_id === data.id)
                : [];

            return (
                <div className="p-3">
                    <DataTable
                        value={listSubFacilites}
                        size={size}
                        dataKey="id"
                        tableStyle={{ minWidth: "50rem" }}
                        emptyMessage="No sub facilities found."
                    >
                        <Column
                            header="#"
                            body={indexTemplate}
                            style={{ width: "3rem" }}
                            exportable={false}
                        />
                        <Column field="name" header="Sub Facility" sortable />
                        <Column
                            header="Actions"
                            body={subFacilityActionsTemplate}
                        />
                    </DataTable>
                </div>
            );
        }

        return null;
    };

    const counselRowExpansionTemplate = (data) => {
        const strategyIds = [
            ...new Set(data.answers.map((a) => a.question.support_strategy_id)),
        ];
        return (
            <div className="p-3">
                {strategyIds.map((strategyId) => {
                    const strategy = supportStrategiesData.find(
                        (s) => s.id === strategyId
                    );
                    const strategyName = strategy
                        ? strategy.name
                        : `Strategy ${strategyId}`;
                    const strategyAnswers = data.answers.filter(
                        (a) => a.question.support_strategy_id === strategyId
                    );
                    return (
                        <div key={strategyId}>
                            <h5 className="mb-4">Section: {strategyName}</h5>
                            <ul>
                                {strategyAnswers.map((answer) => {
                                    const isRadio =
                                        answer.question.type === "radio";
                                    const displayAnswer = isRadio
                                        ? answer.radio_option?.text || "N/A"
                                        : answer.text || "N/A";
                                    return (
                                        <li key={answer.id} className="mb-2">
                                            <strong>
                                                {answer.question.text}
                                            </strong>
                                            <br />
                                            Answer: {displayAnswer}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    );
                })}
            </div>
        );
    };

    const bookingStatusBodyTemplate = (rowData) => {
        const status = rowData.status;
        const badgeValue = capitalize(status || "");
        let badgeSeverity;

        switch (status) {
            case "reserved":
                badgeSeverity = "success";
                break;
            case "cancelled":
                badgeSeverity = "danger";
                break;
            case "closed":
                badgeSeverity = "secondary";
                break;
            case "requested":
                badgeSeverity = "info";
                break;
            default:
                badgeSeverity = "info";
        }

        return (
            <div style={{ display: "flex", alignItems: "center" }}>
                {/* <Checkbox
                    inputId={`confirm-${rowData[identifier]}`}
                    checked={status === "reserved"}
                    disabled={status !== "requested"}
                    onChange={(e) => {
                        if (status === "requested" && e.checked) {
                            onConfirm(rowData[identifier]);
                        }
                    }}
                    className="mr-2"
                    tooltip={
                        status === "requested" ? "Confirm reservation" : null
                    }
                    tooltipOptions={{ position: "top" }}
                /> */}
                <Badge value={badgeValue} severity={badgeSeverity} />
            </div>
        );
    };

    const loanStatusBodyTemplate = (rowData) => {
        const severity = {
            requested: "info",
            reserved: "success",
            overdue: "warning",
            rejected: "danger",
            cancelled: "secondary",
            returned: "secondary",
        }[rowData.status];

        return (
            <Badge
                value={capitalize(rowData.status || "")}
                severity={severity || "info"}
            />
        );
    };

    const generateColumns = () => {
        if (!collection.length) return [];

        if (isGrouped) {
            return [
                {
                    field: "formattedDate",
                    header: "Date",
                    sortable: true,
                },
                {
                    field: "counselCount",
                    header: "Counsel Count",
                    sortable: true,
                },
            ];
        }

        const firstItem = collection[0];
        const properties = Object.keys(firstItem).filter(
            (prop) => prop !== "answers"
        );

        const dynamicColumns = properties.map((prop) => {
            const column = {
                field: prop,
                header:
                    prop === "cca"
                        ? "CCA"
                        : prop
                              .split("_")
                              .map((word) => capitalize(word))
                              .join(" "),
                sortable: true,
            };

            if (type === "bookings" && prop === "status") {
                column.body = bookingStatusBodyTemplate;
            } else if (type === "equipment_loans" && prop === "status") {
                column.body = loanStatusBodyTemplate;
            } else if (prop === "created_at" || prop === "updated_at") {
                column.body = (rowData) => formatDateToLocal(rowData[prop]);
            }

            if (type === "checkin") {
                if (prop === "student") {
                    column.filter = true;
                } else if (prop === "level") {
                    column.filter = true;
                } else if (prop === "class") {
                    column.filter = true;
                } else if (prop === "activity") {
                    column.filter = true;
                }
            } else if (type === "equipment_loans") {
                column.filter = [
                    "student",
                    "class",
                    "cca",
                    "equipment",
                    "status",
                ].includes(prop);
            } else if (type === "bookings") {
                if (prop === "student") {
                    column.filter = true;
                } else if (prop === "level") {
                    column.filter = true;
                } else if (prop === "class") {
                    column.filter = true;
                } else if (prop === "facility") {
                    column.filter = true;
                } else if (prop === "status") {
                    column.filter = true;
                }
            }

            if (prop === "created_at" || prop === "updated_at") {
                column.body = (rowData) => formatDateToLocal(rowData[prop]);
            }

            return column;
        });

        return [
            ...dynamicColumns,
            ...(type !== "counsels" && !isGrouped
                ? [
                      {
                          field: "actions",
                          header: "Actions",
                          body: actionsTemplate,
                          exportable: false,
                      },
                  ]
                : []),
        ];
    };

    const indexTemplate = (rowData, column) => column.rowIndex + 1;

    const onColumnToggle = (event) => {
        const selectedColumns = event.value;
        const allColumns = generateColumns().filter(
            (col) => col.field !== "actions"
        );
        const orderedSelectedColumns = allColumns.filter((col) =>
            selectedColumns.some((sCol) => sCol.field === col.field)
        );
        setVisibleColumns(orderedSelectedColumns);
    };

    if (spinner?.show) {
        return (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "200px",
                }}
            >
                <ProgressSpinner />
                <span style={{ marginTop: "10px" }}>{spinner.text}</span>
            </div>
        );
    }

    const header = (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between w-full">
            <h4 className="m-0">Manage {title}</h4>
            <div className="flex items-center gap-4">
                <MultiSelect
                    value={visibleColumns}
                    options={generateColumns().filter(
                        (col) => col.field !== "actions"
                    )}
                    optionLabel="header"
                    onChange={onColumnToggle}
                    className="w-full sm:w-20rem"
                    display="chip"
                    placeholder="Select Columns"
                />
                {/* <IconField className="flex items-center w-64">
                    <InputIcon className="pi pi-search" />
                    <InputText
                        type="search"
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        placeholder="Search..."
                        className="w-full"
                    />
                </IconField> */}
            </div>
        </div>
    );

    const allowExpansion = (rowData) => {
        if (isGrouped) {
            return rowData?.counsels?.length > 0;
        }
        return true;
    };

    return (
        <div>
            <ConfirmPopup />
            <Toolbar
                className="mb-4"
                left={leftToolbarTemplate}
                right={rightToolbarTemplate}
            />
            <DataTable
                ref={dt}
                value={filteredDataState}
                size={size}
                selection={
                    type !== "counsels" && !isGrouped ? selectedRecords : null
                }
                onSelectionChange={
                    type !== "counsels" && !isGrouped
                        ? (e) => setSelectedRecords(e.value)
                        : undefined
                }
                globalFilter={globalFilter}
                filters={filters}
                filterDisplay="row"
                paginator
                rows={10}
                rowsPerPageOptions={[10, 20, 50, 100]}
                tableStyle={{ minWidth: "50rem" }}
                dataKey={identifier}
                stripedRows
                scrollable
                scrollHeight="720px"
                emptyMessage={`No ${
                    type === "support_strategies" ? "support strategy" : type
                } found.`}
                header={header}
                onValueChange={(filteredData) =>
                    setFilteredDataState(filteredData)
                }
                expandedRows={hasExpand || isGrouped ? expandedRows : null}
                onRowToggle={
                    hasExpand || isGrouped
                        ? (e) => setExpandedRows(e.data)
                        : undefined
                }
                rowExpansionTemplate={rowExpansionTemplate}
            >
                {(hasExpand || isGrouped) && (
                    <Column
                        expander={allowExpansion}
                        style={{ width: "3rem" }}
                        exportable={false}
                    />
                )}
                {type !== "counsels" && !isGrouped ? (
                    <Column
                        selectionMode="multiple"
                        headerStyle={{ width: "3rem" }}
                        exportable={false}
                    />
                ) : null}
                <Column
                    header="#"
                    body={indexTemplate}
                    style={{ width: "3rem" }}
                    exportable={false}
                />
                {visibleColumns.map((col) => {
                    let headerName;
                    if (hasExpand && col.field === "name") {
                        switch (type) {
                            case "levels":
                                headerName = "Level";
                                break;
                            case "facilities":
                                headerName = "Facility";
                                break;
                            default:
                                headerName = null;
                        }
                    }
                    return (
                        <Column
                            key={col.field}
                            field={col.field}
                            header={headerName ? headerName : col.header}
                            sortable={col.sortable}
                            body={col.body}
                            exportable={col.exportable !== false}
                            headerStyle={col.headerStyle}
                            filter={col.filter}
                            filterElement={col.filterElement}
                        />
                    );
                })}
                {type !== "counsels" && !isGrouped ? (
                    <Column
                        field="actions"
                        header="Actions"
                        body={actionsTemplate}
                        exportable={false}
                    />
                ) : null}
            </DataTable>
            {type !== "counsels" && !isGrouped ? (
                <Dialog
                    visible={deleteRecordsDialog}
                    style={{ width: "32rem" }}
                    header="Confirm"
                    modal
                    onHide={() => setDeleteRecordsDialog(false)}
                >
                    <div className="mt-8">
                        <div style={{ marginBottom: "2rem" }}>
                            <p>
                                Are you sure you want to delete the selected{" "}
                                {type}?
                            </p>
                        </div>
                        <div
                            style={{
                                display: "flex",
                                gap: "10px",
                                justifyContent: "flex-end",
                            }}
                        >
                            <Button
                                label="No"
                                icon="pi pi-times"
                                severity="secondary"
                                outlined
                                onClick={() => setDeleteRecordsDialog(false)}
                            />
                            <Button
                                label="Yes"
                                icon="pi pi-check"
                                severity="danger"
                                onClick={deleteSelectedRecords}
                            />
                        </div>
                    </div>
                </Dialog>
            ) : null}
            <OverlayPanel
                ref={overlayPanelRef}
                showCloseIcon
                style={{ width: "600px" }}
            >
                <FileUpload
                    name="file"
                    accept=".csv, .xlsx"
                    maxFileSize={10000000}
                    emptyTemplate={
                        <p className="m-0">
                            Drag and drop files (csv/excel) here to upload (Max
                            10Mb).
                        </p>
                    }
                    customUpload
                    uploadHandler={handleFileUpload}
                />
            </OverlayPanel>
        </div>
    );
};

CustomDataTable.propTypes = {
    title: PropTypes.string,
    type: PropTypes.string.isRequired,
    identifier: PropTypes.string,
    hasImport: PropTypes.bool,
    hasExpand: PropTypes.bool,
    onFetch: PropTypes.func,
    onAdd: PropTypes.func,
    onEdit: PropTypes.func,
    onConfirm: PropTypes.func,
    onCancel: PropTypes.func,
    onDelete: PropTypes.func,
    onDeleteMany: PropTypes.func,
    onAddQuestion: PropTypes.func,
    onEditQuestion: PropTypes.func,
    onDeleteQuestion: PropTypes.func,
    onAddClass: PropTypes.func,
    onEditClass: PropTypes.func,
    onDeleteClass: PropTypes.func,
    onAddStudent: PropTypes.func,
    onEditStudent: PropTypes.func,
    onDeleteStudent: PropTypes.func,
    onEditSubFacility: PropTypes.func,
    onReject: PropTypes.func,
    onReturn: PropTypes.func,
    onAddEquipment: PropTypes.func,
    onEditEquipment: PropTypes.func,
    onDeleteEquipment: PropTypes.func,
    equipment: PropTypes.array,
    timeFilter: PropTypes.string,
    setTimeFilter: PropTypes.func,
    dateFilter: PropTypes.object,
    setDateFilter: PropTypes.func,
    rangeFilter: PropTypes.array,
    setRangeFilter: PropTypes.func,
    classes: PropTypes.array,
    students: PropTypes.array,
    subFacilities: PropTypes.array,
    questions: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.number,
            support_strategy_id: PropTypes.number,
            order: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
            text: PropTypes.string,
            type: PropTypes.string,
            radio_options: PropTypes.arrayOf(PropTypes.string),
        })
    ),
    collection: PropTypes.array,
    supportStrategies: PropTypes.array,
    isGrouped: PropTypes.bool,
};

export default CustomDataTable;
