import React, { useMemo, useState } from "react";
import { useListQuery } from "../store/hub-api";
import { useSaveRecord } from "../store/use-save-record";
import Header from "../shared/layout/Header";
import DataTable from "../shared/misc/DataTable";
import { Card } from "primereact/card";
import { Dialog } from "primereact/dialog";
import { FloatLabel } from "primereact/floatlabel";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";

const EMPTY_QUESTION = {
    support_strategy_id: null,
    order: "",
    text: "",
    type: "text",
    radio_options: [],
};

const questionTypes = [
    { label: "Text", value: "text" },
    { label: "Multiple Choices", value: "radio" },
];

/** "Ask Ms Vi" support strategies, each expanding to its questions. */
function ManageSupportAndQuestions() {
    const strategyQuery = useListQuery({ type: "support_strategies" });
    const questionQuery = useListQuery({ type: "questions" });
    const strategyRecords = useSaveRecord("support_strategies");
    const questionRecords = useSaveRecord("questions");

    const [strategyDialog, setStrategyDialog] = useState(false);
    const [questionDialog, setQuestionDialog] = useState(false);
    const [editId, setEditId] = useState(null);
    const [strategyFormData, setStrategyFormData] = useState({ name: "" });
    const [questionFormData, setQuestionFormData] = useState(EMPTY_QUESTION);
    const [radioOptionInput, setRadioOptionInput] = useState("");
    const mode = editId ? "edit" : "create";

    const supportStrategies = useMemo(
        () =>
            (strategyQuery.data ?? []).map((s) => ({
                id: s.id,
                name: s.name,
                created_at: s.created_at,
                updated_at: s.updated_at,
            })),
        [strategyQuery.data]
    );
    const questions = useMemo(
        () =>
            (questionQuery.data ?? []).map((q) => ({
                id: q.id,
                support_strategy_id: q.support_strategy_id,
                order: q.order,
                text: q.text,
                type: q.type,
                radio_options: Array.isArray(q.radio_options) ? q.radio_options.map((o) => o.text) : [],
                created_at: q.created_at,
                updated_at: q.updated_at,
            })),
        [questionQuery.data]
    );

    const isDataReady = !strategyQuery.isLoading && !questionQuery.isLoading;
    const loading = strategyRecords.saving || questionRecords.saving;
    const error = strategyDialog ? strategyRecords.error : questionRecords.error;
    const fetchSupportStrategies = () => {
        strategyQuery.refetch();
        questionQuery.refetch();
    };

    const handleAddStrategy = () => {
        setEditId(null);
        setStrategyFormData({ name: "" });
        strategyRecords.setError("");
        setStrategyDialog(true);
    };

    const handleEditStrategy = (id) => {
        const strategy = supportStrategies.find((s) => s.id === id);
        if (!strategy) return;
        setEditId(id);
        setStrategyFormData({ name: strategy.name });
        strategyRecords.setError("");
        setStrategyDialog(true);
    };

    const handleAddQuestion = (supportStrategyId) => {
        setEditId(null);
        setQuestionFormData({ ...EMPTY_QUESTION, support_strategy_id: supportStrategyId });
        setRadioOptionInput("");
        questionRecords.setError("");
        setQuestionDialog(true);
    };

    const handleEditQuestion = (id) => {
        const question = questions.find((q) => q.id === id);
        if (!question) return;
        setEditId(id);
        setQuestionFormData({
            support_strategy_id: question.support_strategy_id,
            order: question.order,
            text: question.text,
            type: question.type,
            radio_options: question.radio_options || [],
        });
        setRadioOptionInput("");
        questionRecords.setError("");
        setQuestionDialog(true);
    };

    const handleDeleteQuestion = (id) => questionRecords.remove(id);

    const handleStrategyChange = (e) => {
        const { name, value } = e.target;
        setStrategyFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleQuestionChange = (e) => {
        const { name, value } = e.target;
        setQuestionFormData((prev) => ({
            ...prev,
            [name]: value,
            ...(name === "type" && value === "text" ? { radio_options: [] } : {}),
        }));
    };

    const addRadioOption = () => {
        if (radioOptionInput.trim()) {
            setQuestionFormData((prev) => ({
                ...prev,
                radio_options: [...prev.radio_options, radioOptionInput.trim()],
            }));
            setRadioOptionInput("");
        }
    };

    const removeRadioOption = (index) => {
        setQuestionFormData((prev) => ({
            ...prev,
            radio_options: prev.radio_options.filter((_, i) => i !== index),
        }));
    };

    // The form keeps what was typed if the save fails.
    const handleStrategySubmit = async (e) => {
        e.preventDefault();
        if (await strategyRecords.save(editId, strategyFormData)) setStrategyDialog(false);
    };

    const handleQuestionSubmit = async (e) => {
        e.preventDefault();
        const data = {
            support_strategy_id: questionFormData.support_strategy_id,
            order: questionFormData.order,
            text: questionFormData.text,
            type: questionFormData.type,
            ...(questionFormData.type === "radio" ? { radio_options: questionFormData.radio_options } : {}),
        };
        if (await questionRecords.save(editId, data)) setQuestionDialog(false);
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
                                type="support_strategies"
                                identifier="id"
                                hasImport={true}
                                collection={supportStrategies}
                                onFetch={fetchSupportStrategies}
                                onAdd={handleAddStrategy}
                                onEdit={handleEditStrategy}
                                onDelete={strategyRecords.remove}
                                onDeleteMany={strategyRecords.removeMany}
                                onAddQuestion={handleAddQuestion}
                                onEditQuestion={handleEditQuestion}
                                onDeleteQuestion={handleDeleteQuestion}
                                title="Form Ask Ms Vi"
                                questions={questions}
                                hasExpand={true}
                            />
                            <Dialog
                                header={
                                    mode === "create"
                                        ? "Add Support Strategy"
                                        : "Edit Support Strategy"
                                }
                                visible={strategyDialog}
                                style={{ width: "400px" }}
                                onHide={() => setStrategyDialog(false)}
                            >
                                <form
                                    onSubmit={handleStrategySubmit}
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
                                                name="name"
                                                value={strategyFormData.name}
                                                onChange={handleStrategyChange}
                                                style={{ width: "100%" }}
                                                required
                                                disabled={loading}
                                                tooltip="Enter support strategy name"
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
                                                setStrategyDialog(false)
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
                                        ? "Add Question"
                                        : "Edit Question"
                                }
                                visible={questionDialog}
                                style={{ width: "500px" }}
                                onHide={() => setQuestionDialog(false)}
                            >
                                <form
                                    onSubmit={handleQuestionSubmit}
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
                                                name="order"
                                                value={questionFormData.order}
                                                onChange={handleQuestionChange}
                                                style={{ width: "100%" }}
                                                required
                                                disabled={loading}
                                                type="number"
                                                tooltip="Enter question order"
                                            />
                                            <label htmlFor="order">Order</label>
                                        </FloatLabel>
                                    </div>
                                    <div style={{ marginBottom: "2rem" }}>
                                        <FloatLabel>
                                            <InputTextarea
                                                name="text"
                                                value={questionFormData.text}
                                                onChange={handleQuestionChange}
                                                style={{ width: "100%" }}
                                                required
                                                disabled={loading}
                                                rows={4}
                                                tooltip="Enter question text"
                                            />
                                            <label htmlFor="text">
                                                Question Text
                                            </label>
                                        </FloatLabel>
                                    </div>
                                    <div style={{ marginBottom: "2rem" }}>
                                        <FloatLabel>
                                            <Dropdown
                                                name="type"
                                                value={questionFormData.type}
                                                options={questionTypes}
                                                onChange={handleQuestionChange}
                                                style={{ width: "100%" }}
                                                required
                                                disabled={loading}
                                                tooltip="Select question type"
                                            />
                                            <label htmlFor="type">Type</label>
                                        </FloatLabel>
                                    </div>
                                    {questionFormData.type === "radio" && (
                                        <div style={{ marginBottom: "2rem" }}>
                                            <FloatLabel>
                                                <InputText
                                                    value={radioOptionInput}
                                                    onChange={(e) =>
                                                        setRadioOptionInput(
                                                            e.target.value
                                                        )
                                                    }
                                                    style={{ width: "70%" }}
                                                    disabled={loading}
                                                    tooltip="Enter a answer"
                                                />
                                                <Button
                                                    label="Add"
                                                    icon="pi pi-plus"
                                                    type="button"
                                                    onClick={addRadioOption}
                                                    style={{
                                                        marginLeft: "10px",
                                                        width: "25%",
                                                    }}
                                                    disabled={
                                                        loading ||
                                                        !radioOptionInput.trim()
                                                    }
                                                />
                                                <label htmlFor="radioOption">
                                                    Answer
                                                </label>
                                            </FloatLabel>
                                            <div style={{ marginTop: "1rem" }}>
                                                {questionFormData.radio_options.map(
                                                    (option, index) => (
                                                        <div
                                                            key={index}
                                                            style={{
                                                                display: "flex",
                                                                alignItems:
                                                                    "center",
                                                                marginBottom:
                                                                    "0.5rem",
                                                            }}
                                                        >
                                                            <span
                                                                style={{
                                                                    flex: 1,
                                                                }}
                                                            >
                                                                {option}
                                                            </span>
                                                            <Button
                                                                icon="pi pi-trash"
                                                                className="p-button-text p-button-danger"
                                                                onClick={() =>
                                                                    removeRadioOption(
                                                                        index
                                                                    )
                                                                }
                                                                disabled={
                                                                    loading
                                                                }
                                                            />
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                            {questionFormData.radio_options
                                                .length < 2 && (
                                                <p
                                                    style={{
                                                        color: "red",
                                                        fontSize: "0.9rem",
                                                    }}
                                                >
                                                    At least 2 answers are
                                                    required.
                                                </p>
                                            )}
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
                                            onClick={() =>
                                                setQuestionDialog(false)
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
                                            disabled={
                                                loading ||
                                                (questionFormData.type ===
                                                    "radio" &&
                                                    questionFormData
                                                        .radio_options.length <
                                                        2)
                                            }
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

export default ManageSupportAndQuestions;
