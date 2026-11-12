export const EQUIPMENT_LOAN_STATE = {
    data: [],
    spinner: { show: false, text: "" },
    toastMessage: null,
    alert: {},
    endPoints: {
        collection: "/api/equipment_loans/",
        store: "/api/equipment_loans/",
        update: "/api/equipment_loans/",
        get: "/api/equipment_loans/",
        delete: "/api/equipment_loans/",
        request: "/api/equipment-loans/",
        confirm: "/api/equipment-loans-confirm/",
        reject: "/api/equipment-loans-reject/",
        cancel: "/api/equipment-loans-cancel/",
        return: "/api/equipment-loans-return/",
    },
};
