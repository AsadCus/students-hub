<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\DataClass;
use App\Models\Facility;
use App\Models\Level;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Phase 1: who can read and change what (issues C2, M1, M6). */
class AccessControlTest extends TestCase
{
    use RefreshDatabase;

    private Student $student;

    private Facility $room;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-12 09:00:00');

        $level = Level::create(['name' => 'Primary 1']);
        $class = DataClass::create(['level_id' => $level->id, 'name' => 'Bright']);
        $this->student = Student::create(['class_id' => $class->id, 'name' => 'Siti']);
        $parent = Facility::create(['name' => 'Classrooms']);
        $this->room = Facility::create(['name' => 'C01', 'parent_id' => $parent->id]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function actingAsRole(string $role): User
    {
        $user = User::create(['name' => $role, 'email' => strtolower($role).'@test.local', 'password' => 'secret123']);
        $user->assignRole($role);
        Sanctum::actingAs($user, ['*']);

        return $user;
    }

    /** Inserted without model events: the booking observer would queue (and, on the sync queue, run) the close job. */
    private function booking(string $start): Booking
    {
        return Booking::withoutEvents(fn () => Booking::create([
            'student_id' => $this->student->id,
            'facility_id' => $this->room->id,
            'start_time' => $start,
            'end_time' => Carbon::parse($start)->addMinutes(30),
            'status' => 'reserved',
        ]));
    }

    public function test_private_lists_need_login(): void
    {
        foreach (['users', 'roles', 'permissions', 'counsels', 'radio_options', 'equipment_loans'] as $type) {
            $this->getJson("/api/{$type}")->assertUnauthorized();
        }
    }

    public function test_private_lists_need_the_view_permission(): void
    {
        $this->actingAsRole('Checkin');
        $this->getJson('/api/users')->assertForbidden();
        $this->getJson('/api/counsels')->assertForbidden();
        $this->getJson('/api/users/1')->assertForbidden();

        $this->actingAsRole('Superadmin');
        $this->getJson('/api/users')->assertOk();
        $this->getJson('/api/counsels')->assertOk();
    }

    public function test_kiosk_lists_stay_public(): void
    {
        foreach (config('constants.PUBLIC_MASTER_TYPES') as $type) {
            $this->getJson("/api/{$type}")->assertOk();
        }
    }

    public function test_guests_get_bookings_without_student_names(): void
    {
        $this->booking('2026-11-13 07:00:00');

        $guest = $this->getJson('/api/bookings')->assertOk()->json('result.0');
        $this->assertSame($this->student->id, $guest['student_id']);
        $this->assertArrayNotHasKey('student', $guest);

        $this->actingAsRole('Booking');
        $this->getJson('/api/bookings')->assertOk()->assertJsonPath('result.0.student.name', 'Siti');
    }

    public function test_kiosk_can_only_cancel_its_own_upcoming_booking(): void
    {
        $upcoming = $this->booking('2026-11-13 07:00:00');
        $started = $this->booking('2026-11-12 08:30:00');
        $own = ['student_id' => $this->student->id];

        $this->putJson("/api/booking-cancel/{$upcoming->id}")->assertForbidden();
        $this->putJson("/api/booking-cancel/{$upcoming->id}", ['student_id' => $this->student->id + 1])->assertForbidden();
        $this->putJson("/api/booking-cancel/{$started->id}", $own)->assertUnprocessable();
        $this->putJson("/api/booking-cancel/{$upcoming->id}", $own)->assertOk()->assertJsonPath('result.status', 'cancelled');
    }

    public function test_staff_can_cancel_any_booking(): void
    {
        $started = $this->booking('2026-11-12 08:30:00');

        $this->actingAsRole('Booking');
        $this->putJson("/api/booking-cancel/{$started->id}")->assertOk();
    }

    public function test_login_is_rate_limited(): void
    {
        $attempt = fn () => $this->postJson('/api/login', ['email' => 'nobody@test.local', 'password' => 'wrong']);

        for ($i = 0; $i < 5; $i++) {
            $attempt()->assertUnauthorized();
        }
        $attempt()->assertTooManyRequests();
    }
}
