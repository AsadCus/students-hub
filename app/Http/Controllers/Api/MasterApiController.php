<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Answer;
use App\Models\BlockedDate;
use App\Models\EquipmentLoan;
use App\Models\Question;
use App\Models\RadioOption;
use App\Services\CounselService;
use App\Services\EquipmentLoanService;
use App\Services\MasterService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;
use Spatie\Permission\Models\Role;

class MasterApiController extends Controller
{
    protected $masterService;

    public function __construct(MasterService $masterService, RadioOption $radioOption, Question $question)
    {
        $this->masterService = $masterService;
        $this->radioOption = $radioOption;
        $this->question = $question;

        $urlMasterType = request()->segment(2);

        if (! in_array($urlMasterType, config('constants.MASTER_TYPE_ARRAY'))) {
            return $this->fail('Master Type not found', Response::HTTP_NOT_FOUND);
        }

        if (! in_array($urlMasterType, config('constants.PUBLIC_MASTER_TYPES'))) {
            $this->middleware(['auth:sanctum', 'permission:'.$urlMasterType.' view'], ['only' => ['index', 'show']]);
        }
        $this->middleware('permission:'.$urlMasterType.' create', ['only' => ['store', 'import']]);
        $this->middleware('permission:'.$urlMasterType.' edit', ['only' => ['update']]);
        $this->middleware('permission:'.$urlMasterType.' delete', ['only' => ['destroy']]);
    }

    private function getRuleValidationByType($type, $id = null)
    {
        $rules = [];
        if ($type === config('constants.MASTER_TYPE_ARRAY.USER_MASTER_TYPE')) {
            $rules = [
                'name' => ['required', 'string', 'max:100'],
                'email' => [
                    'required',
                    'email',
                    Rule::unique('users', 'email')->ignore($id)->whereNull('deleted_at'),
                ],
                'password' => [$id === null ? 'required' : 'nullable', 'string', 'min:8'],
                'access' => ['required', 'exists:roles,name'],
            ];
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.LEVEL_MASTER_TYPE')) {
            $rules = config('constants.MASTER_VALIDATION_ARRAY.LEVEL_MASTER_VALIDATION');
            $rules['name'][] = Rule::unique('levels', 'name')->ignore($id);
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.CLASS_MASTER_TYPE')) {
            $rules = config('constants.MASTER_VALIDATION_ARRAY.CLASS_MASTER_VALIDATION');
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.STUDENT_MASTER_TYPE')) {
            $rules = config('constants.MASTER_VALIDATION_ARRAY.STUDENT_MASTER_VALIDATION');
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.ACTIVITY_MASTER_TYPE')) {
            $rules = config('constants.MASTER_VALIDATION_ARRAY.ACTIVITY_MASTER_VALIDATION');
            $rules['name'][] = Rule::unique('activities', 'name')->ignore($id);
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.ROLE_MASTER_TYPE')) {
            $rules = config('constants.MASTER_VALIDATION_ARRAY.ROLE_MASTER_VALIDATION');
            $rules['name'][] = Rule::unique('roles', 'name')->ignore($id);
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.CHECKIN_MASTER_TYPE')) {
            $rules = config('constants.MASTER_VALIDATION_ARRAY.CHECKIN_MASTER_VALIDATION');
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.BOOKING_MASTER_TYPE')) {
            $rules = config('constants.MASTER_VALIDATION_ARRAY.BOOKING_MASTER_VALIDATION');
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.SUPPORT_STRATEGY_MASTER_TYPE')) {
            $rules = config('constants.MASTER_VALIDATION_ARRAY.SUPPORT_STRATEGY_VALIDATION');
            $rules['name'][] = Rule::unique('support_strategies', 'name')->ignore($id);
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.QUESTION_MASTER_TYPE')) {
            $rules = config('constants.MASTER_VALIDATION_ARRAY.QUESTION_VALIDATION');
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.COUNSEL_MASTER_TYPE')) {
            $rules = config('constants.MASTER_VALIDATION_ARRAY.COUNSEL_VALIDATION');
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.BLOCKED_DATE_MASTER_TYPE')) {
            $rules = config('constants.MASTER_VALIDATION_ARRAY.BLOCKED_DATE_VALIDATION');
            $rules['date'][] = Rule::unique('blocked_dates', 'date')->ignore($id);
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.FACILITY_MASTER_TYPE')) {
            $rules = config('constants.MASTER_VALIDATION_ARRAY.FACILITY_VALIDATION');
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.CCA_MASTER_TYPE')) {
            $rules = config('constants.MASTER_VALIDATION_ARRAY.CCA_VALIDATION');
            $rules['name'][] = Rule::unique('ccas', 'name')->ignore($id);
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.EQUIPMENT_MASTER_TYPE')) {
            $rules = config('constants.MASTER_VALIDATION_ARRAY.EQUIPMENT_VALIDATION');
        }
        if ($type === config('constants.MASTER_TYPE_ARRAY.EQUIPMENT_LOAN_MASTER_TYPE')) {
            $rules = config('constants.MASTER_VALIDATION_ARRAY.EQUIPMENT_LOAN_VALIDATION');
            if ($id !== null) {
                // An existing loan may keep a start date that's already passed.
                $rules['start_date'] = ['required', 'date_format:Y-m-d'];
            }
        }

        return $rules;
    }

    private function doRequestValidation(Request $request, $type, $id = null)
    {
        if ($id === null) {
            $rules = $this->getRuleValidationByType($type);
        } else {
            $rules = $this->getRuleValidationByType($type, $id);
        }

        // Throws on failure; bootstrap/app.php renders it as 422 with the first
        // field message and all field errors.
        Validator::make($request->all(), $rules)->validate();

        return true;
    }

    public function index(Request $request, $type)
    {
        $data = $this->masterService->getAll($type, $request);

        return $this->ok($data, $data->isNotEmpty() ? 'Records found' : 'No records found');
    }

    public function show(Request $request, $type, $id)
    {
        $item = $this->masterService->getById($type, $id);

        return $item
            ? $this->ok($item, 'Record found')
            : $this->fail("That {$this->label($type, lower: true)} doesn't exist. It may have been deleted.", Response::HTTP_NOT_FOUND);
    }

    public function store(Request $request, $type)
    {
        $validation = $this->doRequestValidation($request, $type);
        if ($validation !== true) {
            return $validation;
        }

        if ($type === 'questions') {
            $data = $request->only(['support_strategy_id', 'order', 'text', 'type']);
            $radioOptions = $request->input('radio_options', []);
            try {
                $storedQuestion = DB::transaction(function () use ($type, $data, $radioOptions) {
                    $question = $this->masterService->create($type, $data);
                    if ($data['type'] === 'radio') {
                        $this->syncRadioOptions($question->id, $radioOptions);
                    }

                    return $question;
                });

                return $this->ok($storedQuestion->load('radioOptions'), $this->label($type).' created', Response::HTTP_CREATED);
            } catch (\Exception $e) {
                return $this->fail('Failed to create question: '.$e->getMessage(), Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }
        if ($type === 'counsels') {
            $counsel = app(CounselService::class)->submit(
                $request->only(['student_id', 'support_strategy_id', 'question_id', 'answer'])
            );

            return $this->ok($counsel, 'Counsel record created', Response::HTTP_CREATED);
        }
        if ($type === 'bookings' && ($blocked = BlockedDate::firstBetween($request->start_time, $request->end_time))) {
            return $this->fail($blocked->bookingClosedMessage(), Response::HTTP_UNPROCESSABLE_ENTITY);
        }
        if ($type === 'equipment_loans') {
            // Created by staff, so it's approved straight away.
            $loan = app(EquipmentLoanService::class)->create(
                $request->only(['equipment_id', 'student_id', 'start_date', 'end_date', 'notes']),
                EquipmentLoan::RESERVED,
                $request->user()?->id
            );

            return $this->ok($loan->load('equipment.cca', 'student.class.level'), 'Loan created', Response::HTTP_CREATED);
        }
        if ($type === 'users') {
            $result = $this->masterService->create($type, $request->only(['name', 'email', 'password']));
            $result->assignRole($request->access);

            return $this->ok($result, $this->label($type).' created', Response::HTTP_CREATED);
        }

        $data = $request->all();
        $result = $this->masterService->create($type, $data);

        return $this->ok($result, $this->label($type).' created', Response::HTTP_CREATED);
    }

    public function update(Request $request, $type, $id)
    {
        $validation = $this->doRequestValidation($request, $type, $id);
        if ($validation !== true) {
            return $validation;
        }

        if ($type === 'questions') {
            $data = $request->only(['support_strategy_id', 'order', 'text', 'type']);
            $radioOptions = $request->input('radio_options', []);

            try {
                $updatedQuestion = DB::transaction(function () use ($type, $id, $data, $radioOptions) {
                    $question = $this->masterService->update($type, $id, $data);
                    $this->syncRadioOptions($id, $data['type'] === 'radio' ? $radioOptions : []);

                    return $question;
                });

                return $this->ok($updatedQuestion->load('radioOptions'), $this->label($type).' updated', Response::HTTP_OK);
            } catch (\Exception $e) {
                return $this->fail('Failed to update question: '.$e->getMessage(), Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }
        if ($type === 'bookings' && ($blocked = BlockedDate::firstBetween($request->start_time, $request->end_time))) {
            return $this->fail($blocked->bookingClosedMessage(), Response::HTTP_UNPROCESSABLE_ENTITY);
        }
        if ($type === 'equipment_loans') {
            $loan = app(EquipmentLoanService::class)->update(
                EquipmentLoan::findOrFail($id),
                $request->only(['equipment_id', 'student_id', 'start_date', 'end_date', 'notes'])
            );

            return $this->ok($loan->load('equipment.cca', 'student.class.level'), 'Loan updated', Response::HTTP_OK);
        }
        if ($type === 'users') {
            // A blank password on edit keeps the current one.
            $data = $request->only(['name', 'email']);
            if ($request->filled('password')) {
                $data['password'] = $request->password;
            }
            $result = $this->masterService->update($type, $id, $data);
            $result->syncRoles($request->access);

            return $this->ok($result, $this->label($type).' updated', Response::HTTP_OK);
        }

        $data = $request->all();
        $result = $this->masterService->update($type, $id, $data);

        return $this->ok($result, $this->label($type).' updated', Response::HTTP_OK);
    }

    public function import(Request $request, $type)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,xlsx|max:10240',
        ]);

        $file = $request->file('file');

        try {
            $data = Excel::toArray([], $file)[0];
            $headers = array_shift($data);
            $rows = $data;
            $rows = array_filter($rows, function ($row) {
                return collect($row)->filter(function ($cell) {
                    return trim($cell) !== '';
                })->isNotEmpty();
            });

            if (empty($rows)) {
                return $this->fail('File is empty', Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            if ($request->has_expand && $type === 'levels') {
                $expectedHeaders = ['Level', 'Class', 'Student'];
                $normalizedHeaders = array_map('strtolower', $headers);
                $expectedNormalized = array_map('strtolower', $expectedHeaders);
                if (! empty(array_diff($expectedNormalized, $normalizedHeaders))) {
                    return $this->fail('Invalid file format. Expected columns: '.implode(', ', $expectedHeaders), Response::HTTP_UNPROCESSABLE_ENTITY);
                }

                $imported = [];
                DB::beginTransaction();

                $levelValidationRules = $this->withoutUniqueRules($this->getRuleValidationByType('levels'));
                $classValidationRules = $this->getRuleValidationByType('class');
                $studentValidationRules = $this->getRuleValidationByType('students');

                // Existing levels, classes and students are matched by name and kept, so
                // their check-ins, bookings and counsel records survive a re-import.
                foreach ($rows as $index => $row) {
                    $rowData = array_combine(array_map('strtolower', $headers), $row);
                    $rowData = array_change_key_case($rowData, CASE_LOWER);

                    // Validate Level
                    $levelData = ['name' => trim($rowData['level'])];
                    $levelValidator = Validator::make($levelData, $levelValidationRules);
                    if ($levelValidator->fails()) {
                        throw new \Exception('Level validation failed at row '.($index + 2).': '.implode(', ', $levelValidator->errors()->all()));
                    }

                    // Find or create Level
                    $level = $this->masterService->getByName('levels', $levelData['name']);
                    if (! $level) {
                        $level = $this->masterService->create('levels', $levelData);
                        $imported[] = ['type' => 'level', 'data' => $level];
                    }

                    // Validate and process Class (if provided)
                    $class = null;
                    if (! empty(trim($rowData['class']))) {
                        $classData = [
                            'level_id' => $level->id,
                            'name' => trim($rowData['class']),
                        ];
                        $classValidator = Validator::make($classData, $classValidationRules);
                        if ($classValidator->fails()) {
                            throw new \Exception('Class validation failed at row '.($index + 2).': '.implode(', ', $classValidator->errors()->all()));
                        }

                        // Find or create Class
                        $classRequest = new Request($classData);
                        $class = $this->masterService->getAll('class', $classRequest)->first();
                        if (! $class) {
                            $class = $this->masterService->create('class', $classData);
                            $imported[] = ['type' => 'class', 'data' => $class];
                        }
                    }

                    // Validate and process Student (if provided)
                    if (! empty(trim($rowData['student']))) {
                        if (! $class) {
                            throw new \Exception('Student specified without a Class at row '.($index + 2));
                        }
                        $studentData = [
                            'name' => trim($rowData['student']),
                            'class_id' => $class->id,
                        ];
                        $studentValidator = Validator::make($studentData, $studentValidationRules);
                        if ($studentValidator->fails()) {
                            throw new \Exception('Student validation failed at row '.($index + 2).': '.implode(', ', $studentValidator->errors()->all()));
                        }

                        // Find or create Student
                        $studentRequest = new Request($studentData);
                        $student = $this->masterService->getAll('students', $studentRequest)->first();
                        if (! $student) {
                            $student = $this->masterService->create('students', $studentData);
                            $imported[] = ['type' => 'student', 'data' => $student];
                        }
                    }
                }

                DB::commit();

                return $this->ok($imported, count($imported).' records imported successfully', Response::HTTP_CREATED);
            } else {
                $headerMapping = $this->changeImportHeader($type);
                $transformedHeaders = array_map(function ($header) use ($headerMapping) {
                    return $headerMapping[strtolower($header)] ?? strtolower($header);
                }, $headers);

                $foreignKeys = $this->getForeignKeys($type);

                $imported = [];
                DB::beginTransaction();

                // Types with a natural key are updated in place instead of wiped and
                // recreated, so history that points at them (check-ins, bookings,
                // questions and counsel answers) is kept.
                $importKeys = $this->importKeys($type);
                $updated = 0;

                foreach ($rows as $index => $row) {
                    $rowData = array_combine($transformedHeaders, $row);

                    // Prepare role/imported access for users (if provided)
                    $importedAccess = null;
                    if ($type === 'users') {
                        $importedAccess = $rowData['access'] ?? ($rowData['role'] ?? null);
                        // Remove non-fillable fields before validation and creation
                        unset($rowData['access'], $rowData['role']);
                    }

                    if ($type === 'facilities' && isset($rowData['parent_id'])) {
                        $parentName = trim($rowData['parent_id']);
                        if ($parentName !== '') {
                            $parent = $this->masterService->getByName('facilities', $parentName);
                            if ($parent) {
                                $rowData['parent_id'] = $parent->id;
                            } else {
                                throw new \Exception("Invalid parent: '$parentName' not found at row ".($index + 2));
                            }
                        } else {
                            $rowData['parent_id'] = null;
                        }
                    }

                    foreach ($foreignKeys as $fk => $relatedType) {
                        if ($type !== 'facilities' && isset($rowData[$fk]) && ! is_numeric($rowData[$fk])) {
                            $relatedModel = $this->masterService->getByName($relatedType, $rowData[$fk]);
                            if ($relatedModel) {
                                $rowData[$fk] = $relatedModel->id;
                            } else {
                                throw new \Exception("Invalid $fk: '{$rowData[$fk]}' not found at row ".($index + 2));
                            }
                        }
                    }

                    $validationRules = $this->getRuleValidationByType($type);
                    if ($importKeys) {
                        // Matching on the key replaces the "must be unique" check.
                        $validationRules = $this->withoutUniqueRules($validationRules);
                    }
                    $validator = Validator::make($rowData, $validationRules);

                    if ($validator->fails()) {
                        throw new \Exception('Validation failed at row '.($index + 2).': '.implode(', ', $validator->errors()->all()));
                    }

                    try {
                        if ($importKeys) {
                            $result = $this->masterService->upsert($type, Arr::only($rowData, $importKeys), $rowData);
                            $updated += $result->wasRecentlyCreated ? 0 : 1;
                        } else {
                            $result = $this->masterService->create($type, $rowData);
                        }

                        // Assign role for users if provided
                        if ($type === 'users' && $importedAccess) {
                            // try {
                            //     // ensure the role exists
                            //     Role::findByName($importedAccess);
                            // } catch (\Throwable $e) {
                            //     throw new \Exception("Invalid role: '" . $importedAccess . "' not found at row " . ($index + 2));
                            // }
                            $result->assignRole($importedAccess);
                        }

                        $imported[] = $result;
                    } catch (\Illuminate\Database\QueryException $e) {
                        if ($e->getCode() === '23000') {
                            $field = $this->extractFieldFromUniqueError($e->getMessage(), $type);
                            throw new \Exception("Duplicate entry for $field: '{$rowData[$field]}' at row ".($index + 2));
                        }
                        throw new \Exception('Error at row '.($index + 2).': Unable to save record');
                    }
                }

                DB::commit();

                return $this->ok($imported, $importKeys
                    ? (count($imported) - $updated).' added, '.$updated.' updated'
                    : count($imported).' records imported', Response::HTTP_CREATED);
            }
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->fail('Import failed: '.$e->getMessage(), Response::HTTP_UNPROCESSABLE_ENTITY);
        }
    }

    public function destroy(Request $request, $type, $id)
    {
        $this->masterService->delete($type, $id);

        return $this->ok(null, $this->label($type).' deleted');
    }

    /** Human name for a master type in messages ("Support strategy created"). */
    private function label(string $type, bool $lower = false): string
    {
        $label = [
            'roles' => 'Role', 'permissions' => 'Permission', 'users' => 'User',
            'class' => 'Class', 'levels' => 'Level', 'students' => 'Student',
            'activities' => 'Activity', 'facilities' => 'Facility', 'checkin' => 'Check-in',
            'bookings' => 'Booking', 'counsels' => 'Counsel record',
            'support_strategies' => 'Support strategy', 'questions' => 'Question',
            'radio_options' => 'Option', 'blocked_dates' => 'Blocked date',
            'ccas' => 'CCA', 'equipment' => 'Equipment', 'equipment_loans' => 'Loan',
        ][$type] ?? 'Record';

        return $lower && $label !== 'CCA' ? strtolower($label) : $label;
    }

    /**
     * Make a question's radio options match $texts without breaking answers.
     *
     * Options whose text is unchanged keep their id (and their answers), even
     * if reordered. Remaining old options take the remaining new texts in
     * order (typo fixes), extra texts become new options, and leftover options
     * are deleted only if nobody chose them.
     *
     * @param  list<string>  $texts
     */
    private function syncRadioOptions(int $questionId, array $texts): void
    {
        $existing = $this->radioOption->where('question_id', $questionId)->orderBy('id')->get();
        $unmatchedTexts = [];

        foreach ($texts as $text) {
            $index = $existing->search(fn ($option) => $option->text === $text);
            if ($index === false) {
                $unmatchedTexts[] = $text;
            } else {
                $existing->forget($index);
            }
        }

        foreach ($existing->values() as $i => $option) {
            if (isset($unmatchedTexts[$i])) {
                $option->update(['text' => $unmatchedTexts[$i]]);

                continue;
            }
            if (Answer::where('radio_option_id', $option->id)->exists()) {
                throw ValidationException::withMessages([
                    'radio_options' => "Option \"{$option->text}\" has already been chosen in answers, so it can't be removed. Edit its text instead.",
                ]);
            }
            $option->delete();
        }

        foreach (array_slice($unmatchedTexts, $existing->count()) as $text) {
            $this->radioOption->create(['question_id' => $questionId, 'text' => $text]);
        }
    }

    /**
     * Columns that identify an existing record during import, for types that are
     * updated in place rather than duplicated.
     *
     * @return list<string>
     */
    private function importKeys(string $type): array
    {
        return [
            'activities' => ['name'],
            'support_strategies' => ['name'],
            'facilities' => ['name', 'parent_id'],
        ][$type] ?? [];
    }

    /**
     * @param  array<string, mixed>  $rules
     * @return array<string, mixed>
     */
    private function withoutUniqueRules(array $rules): array
    {
        return array_map(function ($fieldRules) {
            $list = is_string($fieldRules) ? explode('|', $fieldRules) : $fieldRules;

            return array_values(array_filter(
                $list,
                fn ($rule) => ! (is_string($rule) && str_starts_with($rule, 'unique:')) && ! $rule instanceof \Illuminate\Validation\Rules\Unique
            ));
        }, $rules);
    }

    private function changeImportHeader($type)
    {
        return [
            'class' => ['level' => 'level_id'],
            'students' => ['class' => 'class_id'],
            'checkins' => ['student' => 'student_id', 'activity' => 'activity_id'],
            'questions' => ['support_strategy' => 'support_strategy_id'],
            'facilities' => ['facility' => 'name', 'parent' => 'parent_id'],
            'users' => ['role' => 'access'],
        ][$type] ?? [];
    }

    private function getForeignKeys($type)
    {
        return [
            'class' => ['level_id' => 'levels'],
            'students' => ['class_id' => 'class'],
            'checkins' => ['student_id' => 'students', 'activity_id' => 'activities'],
            'questions' => ['support_strategy_id' => 'support_strategies'],
            'facilities' => ['parent_id' => 'facilities'],
        ][$type] ?? [];
    }

    private function extractFieldFromUniqueError($errorMessage, $type)
    {
        $uniqueFields = [
            'class' => 'name',
            'levels' => 'name',
            'activities' => 'name',
            'support_strategies' => 'name',
            'facilities' => 'name',
        ];

        $field = $uniqueFields[$type] ?? 'name';

        if (preg_match("/for key '.*\.([^.]+)_unique'/", $errorMessage, $matches)) {
            $field = $matches[1];
        }

        return $field;
    }
}
