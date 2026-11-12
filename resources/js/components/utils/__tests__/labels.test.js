import { describe, expect, it } from "vitest";
import { countOf, labelOf, lowerLabelOf } from "../labels";

describe("labels", () => {
    it("names types for messages", () => {
        expect(labelOf("support_strategies")).toBe("Support strategy");
        expect(lowerLabelOf("support_strategies")).toBe("support strategy");
        expect(lowerLabelOf("ccas")).toBe("CCA");
        expect(labelOf("unknown")).toBe("Record");
    });

    it("counts with the right plural", () => {
        expect(countOf(1, "class")).toBe("1 class");
        expect(countOf(3, "class")).toBe("3 classes");
        expect(countOf(2, "levels")).toBe("2 levels");
        expect(countOf(2, "activities")).toBe("2 activities");
        expect(countOf(2, "ccas")).toBe("2 CCAs");
        expect(countOf(4, "equipment")).toBe("4 equipment");
    });
});
