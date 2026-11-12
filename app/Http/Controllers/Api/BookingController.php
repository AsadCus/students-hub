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

        Validator::make($request->all(), $rules)->validate();

        $now = now();
        $startTime = new DateTime($request->start_time);
        $endTime = new DateTime($request->end_time);

        if ($startTime <= $now) {
            return $this->fail('Start time must be in the future.', Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($endTime <= $startTime) {
            return $this->fail('End time must be after start time.', Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $blocked = BlockedDate::firstBetween($request->start_time, $request->end_time);
        if ($blocked) {
            return $this->fail($blocked->bookingClosedMessage(), Response::HTTP_UNPROCESSABLE_ENTITY);
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
            return $this->fail('This facility is already booked for the selected time period.', Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Lanjutkan dengan kode yang ada
        $booking = new Booking;
        $booking->student_id = $request->student_id;
        $booking->facility_id = $request->facility_id;
        $booking->start_time = $request->start_time;
        $booking->end_time = $request->end_time;
        // $booking->status = 'requested'; // Set default status to requested
        $booking->save();

        return $this->ok($booking->load('student.class.level', 'facility'), 'Booking successful!', Response::HTTP_OK);
    }

    public function confirm(int $id)
    {
        $booking = Booking::find($id);

        if (! $booking) {
            return $this->fail("That booking doesn't exist. It may have been deleted.", Response::HTTP_NOT_FOUND);
        }

        if ($booking->status === 'cancelled') {
            return $this->fail('Booking already cancelled.', Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($booking->status === 'closed') {
            return $this->fail('Booking already closed.', Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $booking->status = 'reserved';
        $booking->save();

        // $this->sendToSocket();

        return $this->ok($booking, 'Booking confirmed!', Response::HTTP_OK);
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
                return $this->fail('You can only cancel your own booking.', Response::HTTP_FORBIDDEN);
            }
            if ($booking->start_time->isPast()) {
                return $this->fail('This booking has already started and can no longer be cancelled.', Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }

        if (! $booking) {
            return $this->fail("That booking doesn't exist. It may have been deleted.", Response::HTTP_NOT_FOUND);
        }

        if ($booking->status === 'cancelled') {
            return $this->fail('Booking already cancelled.', Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($booking->status === 'closed') {
            return $this->fail('Booking already closed.', Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $booking->status = 'cancelled';
        $booking->save();

        return $this->ok($booking, 'Booking cancelled!', Response::HTTP_OK);
    }
}
