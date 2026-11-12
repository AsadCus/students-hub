import React, { useMemo, useState } from "react";
import { DateTime } from "luxon";
import { useListQuery } from "../../store/hub-api";
import { reportParams } from "../../utils/report-filters";
import Header from "../../shared/layout/Header";
import DataTable from "../../shared/misc/DataTable";
import { Card } from "primereact/card";

/** Counsel records ("Ask Ms Vi" answers) grouped by day. */
function Counsel() {
    const [timeFilter, setTimeFilter] = useState("month");
    const [dateFilter, setDateFilter] = useState(null);
    const [rangeFilter, setRangeFilter] = useState(null);

    // Changing a filter changes the query, which refetches on its own.
    const counselQuery = useListQuery({
        type: "counsels",
        params: reportParams({ timeFilter, dateFilter, rangeFilter }),
    });
    const strategyQuery = useListQuery({ type: "support_strategies" });

    const groupedCounsels = useMemo(() => {
        const counsels = (counselQuery.data ?? []).map((c) => ({
            id: c.id,
            level: c.student?.class?.level?.name || "N/A",
            class: c.student?.class?.name || "N/A",
            student: c.student?.name || "N/A",
            support_strategies: [
                ...new Set(c.answers.map((a) => a.question.support_strategy.name)),
            ].join(", "),
            answers: c.answers,
            created_at: c.created_at,
            updated_at: c.updated_at,
        }));
        const byDay = counsels.reduce((acc, counsel) => {
            const date = DateTime.fromISO(counsel.created_at, { zone: "utc" })
                .setZone("local")
                .toFormat("yyyy-MM-dd");
            (acc[date] ??= []).push(counsel);
            return acc;
        }, {});
        return Object.entries(byDay)
            .map(([date, dayCounsels]) => ({
                date,
                formattedDate: DateTime.fromISO(date).toFormat("dd MMMM yyyy"),
                counsels: dayCounsels,
                counselCount: dayCounsels.length,
            }))
            .sort((a, b) => DateTime.fromISO(b.date) - DateTime.fromISO(a.date));
    }, [counselQuery.data]);

    const isDataReady = !counselQuery.isLoading && !strategyQuery.isLoading;

    return (
        <div>
            <Header />
            <main
                className="admin-container with-color"
                style={{ padding: "20px" }}
            >
                <Card>
                    {isDataReady ? (
                        <DataTable
                            type="counsels"
                            identifier="date"
                            onFetch={() => {}} // filters drive the query
                            title="Counsel"
                            timeFilter={timeFilter}
                            setTimeFilter={setTimeFilter}
                            dateFilter={dateFilter}
                            setDateFilter={setDateFilter}
                            rangeFilter={rangeFilter}
                            setRangeFilter={setRangeFilter}
                            hasExpand={true}
                            collection={groupedCounsels}
                            supportStrategies={strategyQuery.data ?? []}
                            isGrouped={true}
                        />
                    ) : (
                        <p>Please wait.</p>
                    )}
                </Card>
            </main>
        </div>
    );
}

export default Counsel;
