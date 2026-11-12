import { useState } from "react";
import { useCreateMutation, useRemoveMutation, useUpdateMutation } from "./hub-api";
import { notify } from "../utils/notify";
import { countOf } from "../utils/labels";

/**
 * Create/update/delete for one master type, for admin forms.
 *
 * `save(id, data)` creates when id is null and updates otherwise; it resolves
 * to true on success and false on failure, with the server's message in
 * `error` for the form to show (validation errors are not toasted). Success
 * toasts and list refreshes happen in hubApi / api-toasts.
 */
export function useSaveRecord(type) {
    const [create, createState] = useCreateMutation();
    const [update, updateState] = useUpdateMutation();
    const [removeRecord] = useRemoveMutation();
    const [error, setError] = useState("");

    const save = async (id, data) => {
        setError("");
        try {
            await (id ? update({ type, id, data }) : create({ type, data })).unwrap();
            return true;
        } catch (e) {
            setError(e.message);
            return false;
        }
    };

    // Failures toast through api-toasts; nothing to show inline.
    const remove = (id) => removeRecord({ type, id });

    /** Delete several records with one toast for the whole batch. */
    const removeMany = async (ids) => {
        const results = await Promise.allSettled(
            ids.map((id) => removeRecord({ type, id, silent: true }).unwrap())
        );
        const failed = results.filter((r) => r.status === "rejected");
        if (failed.length === 0) {
            notify.success(`${countOf(ids.length, type)} deleted`);
        } else {
            notify.error(
                `Couldn't delete ${failed.length} of ${countOf(ids.length, type)}`,
                failed[0].reason?.message
            );
        }
    };

    return {
        save,
        remove,
        removeMany,
        saving: createState.isLoading || updateState.isLoading,
        error,
        setError,
    };
}
