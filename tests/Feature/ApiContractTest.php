<?php

namespace Tests\Feature;

use App\Models\BlockedDate;
use App\Models\DataClass;
use App\Models\Level;
use App\Models\Question;
use App\Models\Student;
use App\Models\SupportStrategy;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Phase 3: one response shape, and the validation fixes (H1, M2, M3, M4, M7). */
class ApiContractTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::create(['name' => 'Admin', 'email' => 'admin@test.local', 'password' => 'secret123']);
        $this->admin->assignRole('Superadmin');
    }

    private function asAdmin(): void
    {
        Sanctum::actingAs($this->admin, ['*']);
    }

    // The envelope

    public function test_empty_list_has_an_empty_result(): void
    {
        $this->getJson('/api/levels')->assertOk()->assertExactJson([
            'status' => true, 'message' => 'No records found', 'result' => [],
        ]);
    }

    public function test_missing_record_is_404(): void
    {
        $this->asAdmin();

        $this->getJson('/api/levels/999')->assertNotFound()->assertJson([
            'status' => false, 'message' => "That level doesn't exist. It may have been deleted.",
        ]);
        $this->putJson('/api/booking-cancel/999')->assertNotFound()->assertJsonPath('status', false);
    }

    public function test_validation_errors_lead_with_the_field_message(): void
    {
        $this->asAdmin();

        $this->postJson('/api/levels', [])->assertUnprocessable()->assertJson([
            'status' => false,
            'message' => 'The name field is required.',
            'errors' => ['name' => ['The name field is required.']],
        ]);
    }

    public function test_auth_permission_and_rate_limit_errors_share_the_shape(): void
    {
        $this->getJson('/api/users')->assertUnauthorized()->assertExactJson(['status' => false, 'message' => 'Log in to continue.']);

        $clerk = User::create(['name' => 'Clerk', 'email' => 'clerk@test.local', 'password' => 'secret123']);
        $clerk->assignRole('Checkin');
        Sanctum::actingAs($clerk, ['*']);
        $this->getJson('/api/users')->assertForbidden()->assertExactJson(['status' => false, 'message' => "You don't have permission to do that."]);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/login', ['email' => 'x@test.local', 'password' => 'wrong']);
        }
        $this->postJson('/api/login', ['email' => 'x@test.local', 'password' => 'wrong'])
            ->assertTooManyRequests()
            ->assertJson(['status' => false, 'message' => 'Too many attempts. Wait a minute and try again.']);
    }

    public function test_a_duplicate_caught_by_the_database_is_a_readable_422(): void
    {
        Route::get('/api/_test/duplicate', function () {
            throw new UniqueConstraintViolationException('sqlite', 'insert', [], new \Exception('UNIQUE constraint failed'));
        });

        $this->getJson('/api/_test/duplicate')->assertUnprocessable()->assertExactJson([
            'status' => false, 'message' => 'That record already exists.',
        ]);
    }

    public function test_blocking_the_same_date_twice_is_refused(): void
    {
        $this->asAdmin();
        BlockedDate::create(['date' => '2026-12-25', 'reason' => 'Christmas']);

        $this->postJson('/api/blocked_dates', ['date' => '2026-12-25', 'reason' => 'Again'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('date');
    }

    // Login

    public function test_login_returns_token_and_user_in_result(): void
    {
        $this->postJson('/api/login', ['email' => 'admin@test.local', 'password' => 'wrong'])
            ->assertUnauthorized()
            ->assertExactJson(['status' => false, 'message' => 'Email or password is wrong.']);

        $this->postJson('/api/login', ['email' => 'admin@test.local', 'password' => 'secret123'])
            ->assertOk()
            ->assertJsonPath('status', true)
            ->assertJsonPath('result.user.email', 'admin@test.local')
            ->assertJsonStructure(['result' => ['token', 'user' => ['id', 'name', 'role', 'permissions']]]);
    }

    // H1: users

    public function test_editing_a_user_without_a_password_keeps_it(): void
    {
        $this->asAdmin();
        $clerk = User::create(['name' => 'Clerk', 'email' => 'clerk@test.local', 'password' => 'secret123']);
        $clerk->assignRole('Checkin');

        $this->putJson("/api/users/{$clerk->id}", [
            'name' => 'Clerk Renamed', 'email' => 'clerk@test.local', 'password' => '', 'access' => 'Booking',
        ])->assertOk();

        $clerk->refresh();
        $this->assertSame('Clerk Renamed', $clerk->name);
        $this->assertTrue(Hash::check('secret123', $clerk->password));
        $this->assertTrue($clerk->hasRole('Booking'));
    }

    public function test_new_users_need_a_password_and_a_real_role(): void
    {
        $this->asAdmin();

        $this->postJson('/api/users', ['name' => 'New', 'email' => 'new@test.local', 'access' => 'Checkin'])
            ->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->postJson('/api/users', ['name' => 'New', 'email' => 'new@test.local', 'password' => 'secret123', 'access' => 'Wizard'])
            ->assertUnprocessable()->assertJsonValidationErrors('access');
    }

    // M2: unique rules ignore the record being edited

    public function test_records_can_be_saved_without_changing_their_name(): void
    {
        $this->asAdmin();
        $strategy = SupportStrategy::create(['name' => 'Peer support']);
        $level = Level::create(['name' => 'Primary 1']);
        $blocked = BlockedDate::create(['date' => '2026-12-25', 'reason' => 'Christmas']);

        $this->putJson("/api/support_strategies/{$strategy->id}", ['name' => 'Peer support'])->assertOk();
        $this->putJson("/api/levels/{$level->id}", ['name' => 'Primary 1'])->assertOk();
        $this->putJson("/api/blocked_dates/{$blocked->id}", ['date' => '2026-12-25', 'reason' => 'Christmas Day'])->assertOk();
        $this->putJson("/api/support_strategies/{$strategy->id}", ['name' => SupportStrategy::create(['name' => 'Mentoring'])->name])
            ->assertUnprocessable()->assertJsonValidationErrors('name');
    }

    // M3: admin counsel create

    public function test_admin_can_create_a_counsel_record(): void
    {
        $this->asAdmin();
        $level = Level::create(['name' => 'Primary 1']);
        $student = Student::create(['class_id' => DataClass::create(['level_id' => $level->id, 'name' => 'Bright'])->id, 'name' => 'Siti']);
        $strategy = SupportStrategy::create(['name' => 'Peer support']);
        $question = Question::create(['support_strategy_id' => $strategy->id, 'order' => 1, 'text' => 'How are you?', 'type' => 'text']);

        $this->postJson('/api/counsels', [
            'student_id' => $student->id,
            'support_strategy_id' => $strategy->id,
            'question_id' => [$question->id],
            'answer' => ['Fine'],
        ])->assertCreated()->assertJsonPath('result.answers.0.text', 'Fine');
    }

    // M4: missing rules no longer reach the database as a 500

    public function test_invalid_input_is_a_422_not_a_database_error(): void
    {
        $this->asAdmin();
        Level::create(['name' => 'Primary 1']);

        $this->postJson('/api/levels', ['name' => 'Primary 1'])->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->postJson('/api/levels', ['name' => str_repeat('x', 101)])->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->postJson('/api/class', ['name' => 'Bright', 'level_id' => 999])->assertUnprocessable()->assertJsonValidationErrors('level_id');
        $this->postJson('/api/facilities', ['name' => ''])->assertUnprocessable()->assertJsonValidationErrors('name');
    }

    // M7: required columns are NOT NULL

    public function test_required_columns_reject_null(): void
    {
        $this->expectException(QueryException::class);

        DB::table('levels')->insert(['name' => null]);
    }
}
