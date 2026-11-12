<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BlockedDate;
use App\Models\Booking;
use DateTime;
use GuzzleHttp\Client;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Validator;

class BookingController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:bookings confirm', ['only' => ['confirm']]);
    }

    public function store(Request $request)
    {
        $rules = config('constants.MASTER_VALIDATION_ARRAY.BOOKING_MASTER_VALIDATION');

        $rules['start_time'] = ['required', 'date', 'after:now'];
        $rules['end_time'] = ['required', 'date', 'after:start_time'];

        $validation = Validator::make($request->all(), $rules);
        if ($validation->fails()) {
            return response()->json([
                'status' => false,
                'message' => 'Validation errors',
                'errors' => $validation->errors(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $now = now();
        $startTime = new DateTime($request->start_time);
        $endTime = new DateTime($request->end_time);

        if ($startTime <= $now) {
            return response()->json([
                'status' => false,
                'message' => 'Start time must be in the future.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($endTime <= $startTime) {
            return response()->json([
                'status' => false,
                'message' => 'End time must be after start time.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $blocked = BlockedDate::firstBetween($request->start_time, $request->end_time);
        if ($blocked) {
            return response()->json([
                'status' => false,
                'message' => $blocked->bookingClosedMessage(),
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Overlapping bookings for the same facility
        $existingBooking = Booking::where('facility_id', $request->facility_id)
            ->where('status', '!=', 'cancelled')
            ->where(function ($q) use ($request) {
                $q->where(function ($q) use ($request) {
                    $q->where('start_time', '<=', $request->start_time)
                        ->where('end_time', '>', $request->start_time);
                })
                    ->orWhere(function ($q) use ($request) {
                        $q->where('start_time', '<', $request->end_time)
                            ->where('end_time', '>=', $request->end_time);
                    })
                    ->orWhere(function ($q) use ($request) {
                        $q->where('start_time', '>=', $request->start_time)
                            ->where('end_time', '<=', $request->end_time);
                    });
            })
            ->first();

        if ($existingBooking) {
            return response()->json([
                'status' => false,
                'message' => 'This facility is already booked for the selected time period.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Lanjutkan dengan kode yang ada
        $booking = new Booking;
        $booking->student_id = $request->student_id;
        $booking->facility_id = $request->facility_id;
        $booking->start_time = $request->start_time;
        $booking->end_time = $request->end_time;
        // $booking->status = 'requested'; // Set default status to requested
        $booking->save();

        return response()->json([
            'status' => true,
            'message' => 'Booking successful!',
            'result' => $booking->load('student.class.level', 'facility'),
        ], Response::HTTP_OK);
    }

    public function confirm(int $id)
    {
        $booking = Booking::find($id);

        if (! $booking) {
            return response()->json([
                'status' => false,
                'message' => 'Booking not found.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($booking->status === 'cancelled') {
            return response()->json([
                'status' => false,
                'message' => 'Booking already cancelled.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($booking->status === 'closed') {
            return response()->json([
                'status' => false,
                'message' => 'Booking already closed.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $booking->status = 'reserved';
        $booking->save();

        // $this->sendToSocket();

        return response()->json([
            'status' => true,
            'message' => 'Booking confirmed!',
            'result' => $booking,
        ], Response::HTTP_OK);
    }

    private function sendToSocket($param = null)
    {
        $client = new Client;

        $socketAddress = env('APP_SOCKET_URL').'/booking-confirmation';

        $client->post($socketAddress, [
            'json' => ['data' => $param],
        ]);
    }

    /**
     * Staff with "bookings edit" can cancel any booking. At the kiosk a
     * student can only cancel their own booking (student_id must match)
     * before it starts.
     */
    public function cancel(Request $request, int $id)
    {
        $booking = Booking::find($id);

        if ($booking && ! $request->user('sanctum')?->can('bookings edit')) {
            if ((int) $request->input('student_id') !== $booking->student_id) {
                return response()->json([
                    'status' => false,
                    'message' => 'You can only cancel your own booking.',
                ], Response::HTTP_FORBIDDEN);
            }
            if ($booking->start_time->isPast()) {
                return response()->json([
                    'status' => false,
                    'message' => 'This booking has already started and can no longer be cancelled.',
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }

        if (! $booking) {
            return response()->json([
                'status' => false,
                'message' => 'Booking not found.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($booking->status === 'cancelled') {
            return response()->json([
                'status' => false,
                'message' => 'Booking already cancelled.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($booking->status === 'closed') {
            return response()->json([
                'status' => false,
                'message' => 'Booking already closed.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $booking->status = 'cancelled';
        $booking->save();

        return response()->json([
            'status' => true,
            'message' => 'Booking cancelled!',
            'result' => $booking,
        ], Response::HTTP_OK);
    }
}
