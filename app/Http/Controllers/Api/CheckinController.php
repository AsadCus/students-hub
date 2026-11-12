<?php

namespace App\Http\Controllers\Api;

use App\Models\Checkin;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use App\Http\Controllers\Controller;

class CheckinController extends Controller
{
    public function checkin(Request $request)
    {
        $request->validate([
            'student_id'        => ['required', 'exists:students,id'],
            'activity_id'       => ['nullable', 'required_without:other_activity', 'exists:activities,id'],
            'other_activity'    => ['nullable', 'required_without:activity_id', 'string', 'max:250']
        ]);

        $isCheckedIn = Checkin::whereDate('checkin_time', Carbon::today())
            ->where([['student_id', $request->student_id], ['checkout_time', null]])
            ->first() ? true : false;

        if ($isCheckedIn) {
            return $this->fail('You have already checked in. Please check out before attempting to check in again.', Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $checkin = new Checkin;
        $checkin->student_id = $request->student_id;
        $checkin->checkin_time = now();
        $checkin->timezone = $request->timezone ?? 'UTC';

        if ($request->activity_id) {
            $checkin->activity_id = $request->activity_id;
        }

        if ($request->other_activity) {
            $checkin->other_activity = $request->other_activity;
        }

        $checkin->save();

        return $this->ok($checkin->load('student.class.level', 'activity'), 'Check-in successful!', Response::HTTP_OK);
    }

    public function checkout(Request $request)
    {
        $request->validate([
            'student_id'    => ['required', 'exists:students,id'],
            'reason'        => ['nullable', 'string']
        ]);

        $checkin = Checkin::whereDate('checkin_time', Carbon::today())
            ->where([['student_id', $request->student_id]])
            ->orderBy('checkin_time', 'desc')
            ->first();

        $isCheckedIn = $checkin ? true : false;

        if (!$isCheckedIn) {
            return $this->fail('You have not checked in yet. Please check in first.', Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if ($checkin->checkout_time) {
            return $this->fail('You have already checked out.', Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $checkin->checkout_time = now();

        if ($request->reason) {
            $checkin->reason = $request->reason;
        }

        $checkin->save();

        return $this->ok($checkin->load('student.class.level', 'activity'), 'Check-out successful!', Response::HTTP_OK);
    }
}
