<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Answer;
use App\Models\BlockedDate;
use App\Models\Booking;
use App\Models\Checkin;
use App\Models\DataClass;
use App\Models\Facility;
use App\Models\Level;
use App\Models\Question;
use App\Models\RadioOption;
use App\Models\Result;
use App\Models\Student;
use App\Models\SupportStrategy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Phase 2: nothing in the app silently deletes history (issues H2, H3, H4). */
class DataSafetyTest extends TestCase
{
    use RefreshDatabase;

    private Student $student;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-12 03:00:00');

        $level = Level::create(['name' => 'Primary 1']);
        $class = DataClass::create(['level_id' => $level->id, 'name' => 'Bright']);
        $this->student = Student::create(['class_id' => $class->id, 'name' => 'Siti']);

        $admin = User::create(['name' => 'Admin', 'email' => 'admin@test.local', 'password' => 'secret123']);
        $admin->assignRole('Superadmin');
        Sanctum::actingAs($admin, ['*']);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function import(string $type, string $csv, array $extra = [])
    {
        return $this->post("/api/{$type}/import", ['file' => UploadedFile::fake()->createWithContent("{$type}.csv", $csv)] + $extra, ['Accept' => 'application/json']);
    }

    private function bookingFor(Facility $facility): Booking
    {
        return Booking::withoutEvents(fn () => Booking::create([
            'student_id' => $this->student->id,
            'facility_id' => $facility->id,
            'start_time' => '2026-11-10 07:00:00',
            'end_time' => '2026-11-10 07:30:00',
            'status' => 'closed',
        ]));
    }

    // H2: imports

    public function test_reimporting_students_keeps_their_history(): void
    {
        $activity = Activity::create(['name' => 'Soccer']);
        $checkin = Checkin::withoutEvents(fn () => Checkin::create(['student_id' => $this->student->id, 'activity_id' => $activity->id, 'checkin_time' => now()]));
        $booking = $this->bookingFor(Facility::create(['name' => 'C01']));

        $this->import('levels', "Level,Class,Student\nPrimary 1,Bright,Siti\nPrimary 1,Bright,Ali\n", ['has_expand' => '1'])
            ->assertCreated();

        $this->assertModelExists($this->student);
        $this->assertModelExists($checkin);
        $this->assertModelExists($booking);
        $this->assertSame(2, Student::count());
    }

    public function test_activity_import_updates_in_place_and_keeps_checkins(): void
    {
        $soccer = Activity::create(['name' => 'Soccer', 'description' => 'old']);
        $checkin = Checkin::withoutEvents(fn () => Checkin::create(['student_id' => $this->student->id, 'activity_id' => $soccer->id, 'checkin_time' => now()]));

        $this->import('activities', "name,description\nSoccer,Training on Fridays\nChoir,Singing\n")
            ->assertCreated()
            ->assertJsonPath('message', '1 added, 1 updated');

        $this->assertSame('Training on Fridays', $soccer->fresh()->description);
        $this->assertModelExists($checkin);
    }

    public function test_support_strategy_import_keeps_questions_and_answers(): void
    {
        $strategy = SupportStrategy::create(['name' => 'Peer support']);
        $question = Question::create(['support_strategy_id' => $strategy->id, 'order' => 1, 'text' => 'How are you?', 'type' => 'text']);
        $result = Result::create(['student_id' => $this->student->id, 'support_strategy_id' => $strategy->id]);
        $answer = Answer::create(['result_id' => $result->id, 'question_id' => $question->id, 'text' => 'Fine']);

        $this->import('support_strategies', "name\nPeer support\nMentoring\n")->assertCreated();

        $this->assertModelExists($question);
        $this->assertModelExists($answer);
        $this->assertSame(2, SupportStrategy::count());
    }

    public function test_facility_import_keeps_bookings(): void
    {
        $parent = Facility::create(['name' => 'Classrooms']);
        $room = Facility::create(['name' => 'C01', 'parent_id' => $parent->id]);
        $booking = $this->bookingFor($room);

        $this->import('facilities', "facility,parent\nClassrooms,\nC01,Classrooms\nC02,Classrooms\n")
            ->assertCreated()
            ->assertJsonPath('message', '1 added, 2 updated');

        $this->assertModelExists($booking);
        $this->assertSame($room->id, $booking->fresh()->facility_id);
    }

    // H3: editing radio questions that have answers

    private function answeredRadioQuestion(): array
    {
        $strategy = SupportStrategy::create(['name' => 'Peer support']);
        $question = Question::create(['support_strategy_id' => $strategy->id, 'order' => 1, 'text' => 'How do you feel?', 'type' => 'radio']);
        $good = RadioOption::create(['question_id' => $question->id, 'text' => 'Good']);
        $bad = RadioOption::create(['question_id' => $question->id, 'text' => 'Bad']);
        $result = Result::create(['student_id' => $this->student->id, 'support_strategy_id' => $strategy->id]);
        $answer = Answer::create(['result_id' => $result->id, 'question_id' => $question->id, 'radio_option_id' => $good->id]);

        return [$question, $good, $bad, $answer];
    }

    private function updateQuestion(Question $question, array $options, string $type = 'radio', string $text = 'How do you feel today?')
    {
        return $this->putJson("/api/questions/{$question->id}", [
            'support_strategy_id' => $question->support_strategy_id,
            'order' => 1,
            'text' => $text,
            'type' => $type,
            'radio_options' => $options,
        ]);
    }

    public function test_answered_question_can_be_edited_and_answers_keep_their_option(): void
    {
        [$question, $good, $bad, $answer] = $this->answeredRadioQuestion();

        // Reordered, one inserted, and the unanswered one renamed.
        $this->updateQuestion($question, ['Okay', 'Good', 'Not great'])->assertOk();

        $this->assertSame('How do you feel today?', $question->fresh()->text);
        $this->assertSame('Good', $good->fresh()->text);
        $this->assertSame($good->id, $answer->fresh()->radio_option_id);
        $this->assertSame('Okay', $bad->fresh()->text);
        $this->assertSame(['Good', 'Okay', 'Not great'], RadioOption::where('question_id', $question->id)->orderBy('id')->pluck('text')->all());
    }

    public function test_answered_option_cannot_be_removed(): void
    {
        [$question, $good] = $this->answeredRadioQuestion();

        $this->updateQuestion($question, ['Bad'])->assertUnprocessable();
        $this->updateQuestion($question, ['Bad', 'Fine'], 'text')->assertUnprocessable();

        // Nothing was half-applied.
        $this->assertModelExists($good);
        $this->assertSame('How do you feel?', $question->fresh()->text);
        $this->assertSame('radio', $question->fresh()->type);
    }

    // H4: blocked dates

    public function test_bookings_are_refused_on_blocked_dates(): void
    {
        BlockedDate::create(['date' => '2026-11-13', 'reason' => 'Sports day']);
        $room = Facility::create(['name' => 'C01']);
        $payload = fn (string $day) => [
            'student_id' => $this->student->id,
            'facility_id' => $room->id,
            'start_time' => "{$day} 07:00:00",
            'end_time' => "{$day} 07:30:00",
        ];

        $this->postJson('/api/booking', $payload('2026-11-13'))
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Bookings are closed on 2026-11-13: Sports day.');
        $this->postJson('/api/bookings', $payload('2026-11-13'))->assertUnprocessable();

        $this->postJson('/api/booking', $payload('2026-11-16'))->assertOk();
    }
}
