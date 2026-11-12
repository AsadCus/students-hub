<?php

namespace App\Services;

use App\Models\Answer;
use App\Models\Question;
use App\Models\Result;
use Illuminate\Support\Facades\DB;

/**
 * Saves a counsel questionnaire (a Result with one Answer per question).
 * Shared by the kiosk "Ask Ms Vi" submit and the admin create.
 */
class CounselService
{
    /**
     * @param  array{student_id: int, support_strategy_id: int, question_id: list<int>, answer: list<mixed>}  $data  validated with COUNSEL_VALIDATION
     */
    public function submit(array $data): Result
    {
        return DB::transaction(function () use ($data) {
            $result = Result::create([
                'student_id' => $data['student_id'],
                'support_strategy_id' => $data['support_strategy_id'],
            ]);

            $questions = Question::whereIn('id', $data['question_id'])->get()->keyBy('id');

            foreach ($data['question_id'] as $i => $questionId) {
                $isRadio = $questions[$questionId]->type === 'radio';

                Answer::create([
                    'result_id' => $result->id,
                    'question_id' => $questionId,
                    'radio_option_id' => $isRadio ? $data['answer'][$i] : null,
                    'text' => $isRadio ? null : $data['answer'][$i],
                ]);
            }

            return $result->load('answers');
        });
    }
}
