<?php

namespace App\Services;

use App\Models\Equipment;
use App\Models\EquipmentLoan;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Rules for equipment loans, shared by the kiosk request endpoint and the
 * admin master routes so neither can bypass them.
 *
 * Lifecycle: requested -> reserved (approved) | rejected; reserved -> returned;
 * requested or not-yet-started reserved -> cancelled.
 */
class EquipmentLoanService
{
    /** Longest loan, in calendar days, counting both the start and end day. */
    public const MAX_DAYS = 2;

    public function create(array $data, string $status, ?int $userId = null): EquipmentLoan
    {
        return DB::transaction(function () use ($data, $status, $userId) {
            $equipment = Equipment::with('cca')->lockForUpdate()->findOrFail($data['equipment_id']);
            [$start, $end] = $this->dates($data);
            $this->assertBorrowable($equipment, $start, $end);

            return EquipmentLoan::create([
                'equipment_id' => $equipment->id,
                'student_id' => $data['student_id'],
                'user_id' => $userId,
                'start_date' => $start->toDateString(),
                'end_date' => $end->toDateString(),
                'status' => $status,
                'notes' => $data['notes'] ?? null,
            ]);
        });
    }

    /** Admin edit of dates, equipment, student or notes. Status changes go through the transition methods. */
    public function update(EquipmentLoan $loan, array $data): EquipmentLoan
    {
        if (! in_array($loan->status, EquipmentLoan::HOLDS_STOCK)) {
            throw ValidationException::withMessages([
                'status' => "Only requested or reserved loans can be edited. This one is {$loan->status}.",
            ]);
        }

        return DB::transaction(function () use ($loan, $data) {
            $equipment = Equipment::with('cca')->lockForUpdate()->findOrFail($data['equipment_id']);
            [$start, $end] = $this->dates($data);
            $this->assertBorrowable($equipment, $start, $end, ignoreLoanId: $loan->id);

            $loan->update([
                'equipment_id' => $equipment->id,
                'student_id' => $data['student_id'],
                'start_date' => $start->toDateString(),
                'end_date' => $end->toDateString(),
                'notes' => $data['notes'] ?? null,
            ]);

            return $loan;
        });
    }

    public function approve(EquipmentLoan $loan): EquipmentLoan
    {
        return $this->transition($loan, [EquipmentLoan::REQUESTED], EquipmentLoan::RESERVED, 'approved');
    }

    public function reject(EquipmentLoan $loan): EquipmentLoan
    {
        return $this->transition($loan, [EquipmentLoan::REQUESTED], EquipmentLoan::REJECTED, 'rejected');
    }

    public function markReturned(EquipmentLoan $loan): EquipmentLoan
    {
        return $this->transition($loan, [EquipmentLoan::RESERVED], EquipmentLoan::RETURNED, 'marked as returned');
    }

    /** A request can be withdrawn any time; an approved loan only before its start date. */
    public function cancel(EquipmentLoan $loan): EquipmentLoan
    {
        if ($loan->status === EquipmentLoan::RESERVED && ! $loan->start_date->isAfter(today())) {
            throw ValidationException::withMessages([
                'status' => 'This loan has already started. Mark it as returned instead.',
            ]);
        }

        return $this->transition(
            $loan,
            [EquipmentLoan::REQUESTED, EquipmentLoan::RESERVED],
            EquipmentLoan::CANCELLED,
            'cancelled'
        );
    }

    /** Units of this equipment already held by requested or reserved loans that overlap the dates. */
    public function unitsInUse(Equipment $equipment, Carbon $start, Carbon $end, ?int $ignoreLoanId = null): int
    {
        return EquipmentLoan::where('equipment_id', $equipment->id)
            ->whereIn('status', EquipmentLoan::HOLDS_STOCK)
            ->whereDate('start_date', '<=', $end->toDateString())
            ->whereDate('end_date', '>=', $start->toDateString())
            ->when($ignoreLoanId, fn ($q) => $q->where('id', '!=', $ignoreLoanId))
            ->count();
    }

    private function dates(array $data): array
    {
        $start = Carbon::parse($data['start_date'])->startOfDay();
        $end = Carbon::parse($data['end_date'])->startOfDay();

        if ($start->diffInDays($end) + 1 > self::MAX_DAYS) {
            throw ValidationException::withMessages([
                'end_date' => 'A loan can last at most '.self::MAX_DAYS.' days.',
            ]);
        }

        return [$start, $end];
    }

    private function assertBorrowable(Equipment $equipment, Carbon $start, Carbon $end, ?int $ignoreLoanId = null): void
    {
        if (! $equipment->active || ! $equipment->cca?->active) {
            throw ValidationException::withMessages([
                'equipment_id' => "{$equipment->name} isn't available for loan right now.",
            ]);
        }

        if ($this->unitsInUse($equipment, $start, $end, $ignoreLoanId) >= $equipment->quantity) {
            throw ValidationException::withMessages([
                'equipment_id' => "All {$equipment->quantity} of {$equipment->name} are taken for those dates. Try other dates.",
            ]);
        }
    }

    private function transition(EquipmentLoan $loan, array $from, string $to, string $verb): EquipmentLoan
    {
        if (! in_array($loan->status, $from)) {
            throw ValidationException::withMessages([
                'status' => "A {$loan->status} loan can't be {$verb}.",
            ]);
        }

        $loan->update(['status' => $to]);

        return $loan;
    }
}
