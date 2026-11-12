import { describe, expect, it } from "vitest";
import { reportParams } from "../report-filters";

const day = new Date("2026-03-10T00:00:00.000Z");

describe("reportParams", () => {
    it("sends the preset when no date is picked", () => {
        expect(reportParams({ timeFilter: "today" })).toEqual({ time: "today" });
        expect(reportParams({})).toEqual({});
    });

    it("turns a single date into a one-day range", () => {
        expect(reportParams({ timeFilter: "today", dateFilter: day })).toEqual({
            range_time: { start: "2026-03-10T00:00:00.000Z", end: "2026-03-11T00:00:00.000Z" },
        });
    });

    it("ends a range the day after its last date, and handles a half-picked range", () => {
        const end = new Date("2026-03-12T00:00:00.000Z");
        expect(reportParams({ rangeFilter: [day, end] }).range_time.end).toBe(
            "2026-03-13T00:00:00.000Z"
        );
        expect(reportParams({ rangeFilter: [day, null] }).range_time.end).toBe(
            "2026-03-11T00:00:00.000Z"
        );
    });
});
