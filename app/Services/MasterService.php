<?php

namespace App\Services;

use Carbon\Carbon;
use App\Models\Level;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\App;

class MasterService
{
    protected $modelMap = [
        'roles'                 => \Spatie\Permission\Models\Role::class,
        'permissions'           => \Spatie\Permission\Models\Permission::class,
        'users'                 => \App\Models\User::class,
        'class'                 => \App\Models\DataClass::class,
        'levels'                => \App\Models\Level::class,
        'students'              => \App\Models\Student::class,
        'activities'            => \App\Models\Activity::class,
        'facilities'            => \App\Models\Facility::class,
        'checkin'               => \App\Models\Checkin::class,
        'bookings'              => \App\Models\Booking::class,
        'counsels'              => \App\Models\Result::class,
        'support_strategies'    => \App\Models\SupportStrategy::class,
        'questions'             => \App\Models\Question::class,
        'radio_options'         => \App\Models\RadioOption::class,
        'answers'               => \App\Models\Answer::class,
        'blocked_dates'         => \App\Models\BlockedDate::class,
        'ccas'                  => \App\Models\Cca::class,
        'equipment'             => \App\Models\Equipment::class,
        'equipment_loans'       => \App\Models\EquipmentLoan::class,
    ];

    protected function getModel($type)
    {
        $class = $this->modelMap[$type] ?? null;
        if (!$class || !class_exists($class)) {
            throw new \Exception("Invalid type: $type");
        }
        return new $class;
    }

    public function getAll($type, $request = null)
    {
        $q = $this->getModel($type);
        if ($type === config('constants.MASTER_TYPE_ARRAY.USER_MASTER_TYPE')) {
            return $q->with('roles')->get();
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.LEVEL_MASTER_TYPE')) {
            return $q->with('classes')->get();
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.CLASS_MASTER_TYPE')) {
            return $q->with(['level', 'students'])
                ->when($request->name, function ($q) use ($request) {
                    return $q->where('name', $request->name);
                })
                ->when($request->level_id, function ($q) use ($request) {
                    return $q->where('level_id', $request->level_id);
                })->get();
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.STUDENT_MASTER_TYPE')) {
            return $q->with('class.level')
                ->when($request->name, function ($q) use ($request) {
                    return $q->where('name', $request->name);
                })
                ->when($request->class_id, function ($q) use ($request) {
                    return $q->where('class_id', $request->class_id);
                })->get();
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.CHECKIN_MASTER_TYPE')) {
            return $q->with(['student.class.level', 'activity'])
                ->when($request->student_id, function ($q) use ($request) {
                    return $q->where('student_id', $request->student_id);
                })
                ->when($request->time, function ($q) use ($request) {
                    switch ($request->time) {
                        case 'today':
                            return $q->whereDate('checkin_time', today());
                        case 'week':
                            return $q->whereBetween('checkin_time', [
                                now()->startOfWeek(),
                                now()->endOfWeek(),
                            ]);
                        case 'month':
                            return $q->whereBetween('checkin_time', [
                                now()->startOfMonth(),
                                now()->endOfMonth(),
                            ]);
                        case 'year':
                            return $q->whereBetween('checkin_time', [
                                now()->startOfYear(),
                                now()->endOfYear(),
                            ]);
                        case 'last-year':
                            return $q->whereBetween('checkin_time', [
                                now()->subYear()->startOfYear(),
                                now()->subYear()->endOfYear(),
                            ]);
                        default:
                            return $q;
                    }
                })
                ->when($request->range_time, function ($q) use ($request) {
                    if (
                        is_array($request->range_time) &&
                        isset($request->range_time['start']) &&
                        isset($request->range_time['end'])
                    ) {
                        return $q->whereBetween('checkin_time', [
                            $request->range_time['start'],
                            $request->range_time['end'],
                        ]);
                    }
                    return $q;
                })
                ->get();
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.BOOKING_MASTER_TYPE')) {
            return $q->with(['student.class.level', 'facility.parent'])
                ->when($request->student_id, function ($q) use ($request) {
                    return $q->where('student_id', $request->student_id);
                })
                ->when($request->facility_id, function ($q) use ($request) {
                    return $q->where('facility_id', $request->facility_id);
                })
                ->when($request->facility, function ($q) use ($request) {
                    return $q->whereHas('facility', function ($query) use ($request) {
                        $query->where('name', $request->facility);
                    });
                })
                ->when($request->time, function ($q) use ($request) {
                    switch ($request->time) {
                        case 'today':
                            return $q->whereDate('start_time', today());
                        case 'week':
                            return $q->whereBetween('start_time', [
                                now()->startOfWeek(),
                                now()->endOfWeek(),
                            ]);
                        case 'month':
                            return $q->whereBetween('start_time', [
                                now()->startOfMonth(),
                                now()->endOfMonth(),
                            ]);
                        case 'year':
                            return $q->whereBetween('start_time', [
                                now()->startOfYear(),
                                now()->endOfYear(),
                            ]);
                        case 'last-year':
                            return $q->whereBetween('start_time', [
                                now()->subYear()->startOfYear(),
                                now()->subYear()->endOfYear(),
                            ]);
                        default:
                            return $q;
                    }
                })
                ->when($request->range_time, function ($q) use ($request) {
                    if (
                        is_array($request->range_time) &&
                        isset($request->range_time['start']) &&
                        isset($request->range_time['end'])
                    ) {
                        return $q->whereBetween('start_time', [
                            $request->range_time['start'],
                            $request->range_time['end'],
                        ]);
                    }
                    return $q;
                })
                ->get();
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.COUNSEL_MASTER_TYPE')) {
            return $q->with(['student.class.level', 'answers.question.supportStrategy', 'answers.radioOption'])
                ->when($request->time, function ($q) use ($request) {
                    switch ($request->time) {
                        case 'today':
                            return $q->whereDate('created_at', today());
                        case 'week':
                            return $q->whereBetween('created_at', [
                                now()->startOfWeek(),
                                now()->endOfWeek(),
                            ]);
                        case 'month':
                            return $q->whereBetween('created_at', [
                                now()->startOfMonth(),
                                now()->endOfMonth(),
                            ]);
                        case 'year':
                            return $q->whereBetween('created_at', [
                                now()->startOfYear(),
                                now()->endOfYear(),
                            ]);
                        case 'last-year':
                            return $q->whereBetween('created_at', [
                                now()->subYear()->startOfYear(),
                                now()->subYear()->endOfYear(),
                            ]);
                        default:
                            return $q;
                    }
                })
                ->when($request->range_time, function ($q) use ($request) {
                    if (
                        is_array($request->range_time) &&
                        isset($request->range_time['start']) &&
                        isset($request->range_time['end'])
                    ) {
                        return $q->whereBetween('created_at', [
                            $request->range_time['start'],
                            $request->range_time['end'],
                        ]);
                    }
                    return $q;
                })
                ->get();
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.FACILITY_MASTER_TYPE')) {
            return $q->with(['parent', 'children'])->get();
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.QUESTION_MASTER_TYPE')) {
            return $q->with(['supportStrategy', 'radioOptions'])->get();
        }
        // ?active=1 limits to what the kiosk can offer; the admin pages list everything.
        if ($type === config('constants.MASTER_TYPE_ARRAY.CCA_MASTER_TYPE')) {
            return $q->with('equipment')
                ->when($request?->filled('active'), fn ($q) => $q->where('active', $request->boolean('active')))
                ->orderBy('name')
                ->get();
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.EQUIPMENT_MASTER_TYPE')) {
            return $q->with('cca')
                ->when($request?->filled('active'), fn ($q) => $q->where('active', $request->boolean('active')))
                ->when($request?->cca_id, fn ($q) => $q->where('cca_id', $request->cca_id))
                ->orderBy('name')
                ->get();
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.EQUIPMENT_LOAN_MASTER_TYPE')) {
            return $q->with(['equipment.cca', 'student.class.level', 'user'])
                ->when($request?->status === 'overdue', fn ($q) => $q
                    ->where('status', \App\Models\EquipmentLoan::RESERVED)
                    ->whereDate('end_date', '<', today()))
                ->when($request?->status && $request->status !== 'overdue', fn ($q) => $q->where('status', $request->status))
                ->when($request?->student_id, fn ($q) => $q->where('student_id', $request->student_id))
                ->when($request?->equipment_id, fn ($q) => $q->where('equipment_id', $request->equipment_id))
                // Loans overlapping the range, not just starting in it.
                ->when(
                    is_array($request?->range_time) && isset($request->range_time['start'], $request->range_time['end']),
                    fn ($q) => $q
                        ->whereDate('start_date', '<=', \Illuminate\Support\Carbon::parse($request->range_time['end'])->toDateString())
                        ->whereDate('end_date', '>=', \Illuminate\Support\Carbon::parse($request->range_time['start'])->toDateString())
                )
                ->orderByDesc('start_date')
                ->orderByDesc('id')
                ->get();
        }
        return $q->get();
    }

    public function getById($type, $id)
    {
        return $this->getModel($type)->find($id);
    }

    public function getByName($type, $name)
    {
        $model = $this->getModel($type);
        return $model::where('name', $name)->first();
    }

    public function create($type, array $data)
    {
        return $this->getModel($type)->create($data);
    }

    public function update($type, $id, array $data)
    {
        $model = $this->getModel($type)->findOrFail($id);
        $model->update($data);
        return $model;
    }

    public function delete($type, $id)
    {
        // The DB would cascade these deletes into loan history; keep the history.
        if ($type === 'equipment' && \App\Models\EquipmentLoan::where('equipment_id', $id)->exists()) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'id' => 'This equipment has loan history. Set it to inactive instead of deleting it.',
            ]);
        }
        if ($type === 'ccas' && \App\Models\EquipmentLoan::whereHas('equipment', fn ($q) => $q->where('cca_id', $id))->exists()) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'id' => 'Equipment in this CCA has loan history. Set the CCA to inactive instead of deleting it.',
            ]);
        }

        if ($type === 'levels') {
            $classes = $this->getModel('class')->where('level_id', $id)->get();

            foreach ($classes as $class) {
                $students = $this->getModel('students')->where('class_id', $class->id)->get();

                foreach ($students as $student) {
                    $this->cascade('students', $student->id);
                }

                $this->cascade('class', $class->id);
            }

            $this->cascade($type, $id);
        }
        if ($type === 'class') {
            $students = $this->getModel('students')->where('class_id', $id)->get();

            foreach ($students as $students) {
                $this->cascade('students', $students->id);
            }

            $this->cascade($type, $id);
        }
        if ($type === 'students') {
            $this->cascade($type, $id);
        }
        if ($type === 'facilities') {
            $this->cascade($type, $id);
        }
        if ($type === 'activities') {
            $this->cascade($type, $id);
        }
        if ($type === 'support_strategies') {
            $questions = $this->getModel('questions')->where('support_strategy_id', $id)->get();

            foreach ($questions as $question) {
                $this->cascade('questions', $question->id);
            }

            $this->cascade($type, $id);
        }
        if ($type === 'questions') {
            $this->cascade($type, $id);
        }

        $model = $this->getModel($type)->findOrFail($id);
        $model->delete();
    }

    public function deleteAll($type)
    {
        $model = $this->getModel($type)->get();
        $model->each->delete();
    }

    private function cascade($type, $id)
    {
        if ($type === 'levels') {
            $this->getModel('class')->where('level_id', $id)->delete();
        }
        if ($type === 'class') {
            $this->getModel('students')->where('class_id', $id)->delete();
        }
        if ($type === 'students') {
            $counsels = $this->getModel('counsels')->where('student_id', $id)->get();
            $checkins = $this->getModel('checkin')->where('student_id', $id)->get();
            $bookings = $this->getModel('bookings')->where('student_id', $id)->get();

            if ($checkins) {
                foreach ($checkins as $checkin) {
                    DB::table('jobs')->where('id', $checkin->job_id)->delete();
                }
            }
            if ($bookings) {
                foreach ($bookings as $booking) {
                    DB::table('jobs')->where('id', $booking->job_id)->delete();
                }
            }

            $this->getModel('checkin')->where('student_id', $id)->delete();
            $this->getModel('bookings')->where('student_id', $id)->delete();

            foreach ($counsels as $counsel) {
                $this->getModel('answers')->where('result_id', $counsel->id)->delete();
            }

            $this->getModel('counsels')->where('student_id', $id)->delete();
        }
        if ($type === 'facilities') {
            $subFacilities = $this->getModel($type)->where('parent_id', $id)->get();
            foreach ($subFacilities as $subFacility) {
                $bookings = $this->getModel('bookings')->where('facility_id', $subFacility->id)->get();
                $bookings->each->delete();
            }
            $subFacilities->each->delete();
        }
        if ($type === 'activities') {
            $checkins = $this->getModel('checkin')->where('activity_id', $id)->get();

            if ($checkins) {
                foreach ($checkins as $checkin) {
                    DB::table('jobs')->where('id', $checkin->job_id)->delete();
                }
            }

            $this->getModel('checkin')->where('activity_id', $id)->delete();
        }
        if ($type === 'support_strategies') {
            $this->getModel('counsels')->where('support_strategy_id', $id)->delete();
            $this->getModel('questions')->where('support_strategy_id', $id)->delete();
        }
        if ($type === 'questions') {
            $question = $this->getModel('questions')->find($id);

            $this->getModel('answers')->where('question_id', $id)->delete();

            if ($question->type === 'radio') {
                $this->getModel('radio_options')->where('question_id', $id)->delete();
            }
        }
    }
}
