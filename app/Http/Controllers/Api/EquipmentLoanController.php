<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EquipmentLoan;
use App\Services\EquipmentLoanService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Kiosk request endpoint and the status transitions, mirroring BookingController.
 * Listing, admin create/edit and delete go through the master routes
 * (/api/equipment_loans), which use the same EquipmentLoanService rules.
 */
class EquipmentLoanController extends Controller
{
    public function __construct(private EquipmentLoanService $loans)
    {
        $this->middleware('permission:equipment_loans confirm', ['only' => ['confirm', 'reject', 'markReturned']]);
    }

    /** Kiosk: a student requests a loan; it waits for approval. */
    public function store(Request $request)
    {
        $data = $request->validate(config('constants.MASTER_VALIDATION_ARRAY.EQUIPMENT_LOAN_VALIDATION'));

        $loan = $this->loans->create($data, EquipmentLoan::REQUESTED);

        return response()->json([
            'status' => true,
            'message' => 'Loan requested. A teacher will approve it.',
            'result' => $loan->load('equipment.cca', 'student.class.level'),
        ], Response::HTTP_CREATED);
    }

    public function confirm(int $id)
    {
        return $this->respond($this->loans->approve(EquipmentLoan::findOrFail($id)), 'Loan approved');
    }

    public function reject(int $id)
    {
        return $this->respond($this->loans->reject(EquipmentLoan::findOrFail($id)), 'Loan rejected');
    }

    /** Staff with "equipment_loans edit" can cancel any loan; at the kiosk only the student's own. */
    public function cancel(Request $request, int $id)
    {
        $loan = EquipmentLoan::findOrFail($id);

        if (! $request->user('sanctum')?->can('equipment_loans edit')
            && (int) $request->input('student_id') !== $loan->student_id) {
            return response()->json([
                'status' => false,
                'message' => 'You can only cancel your own loan.',
            ], Response::HTTP_FORBIDDEN);
        }

        return $this->respond($this->loans->cancel($loan), 'Loan cancelled');
    }

    public function markReturned(int $id)
    {
        return $this->respond($this->loans->markReturned(EquipmentLoan::findOrFail($id)), 'Loan marked as returned');
    }

    private function respond(EquipmentLoan $loan, string $message)
    {
        return response()->json([
            'status' => true,
            'message' => $message,
            'result' => $loan->load('equipment.cca', 'student.class.level'),
        ], Response::HTTP_OK);
    }
}
