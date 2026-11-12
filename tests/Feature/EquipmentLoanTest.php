<?php

namespace Tests\Feature;

use App\Models\Cca;
use App\Models\DataClass;
use App\Models\Equipment;
use App\Models\EquipmentLoan;
use App\Models\Level;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EquipmentLoanTest extends TestCase
{
    use RefreshDatabase; // roles and permissions come from the sync migration

    private Student $student;
    private Equipment $camera;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-12 09:00:00');

        $level = Level::create(['name' => 'Primary 1']);
        $class = DataClass::create(['level_id' => $level->id, 'name' => 'Bright']);
        $this->student = Student::create(['class_id' => $class->id, 'name' => 'Siti']);
        $cca = Cca::create(['name' => 'Photography Club', 'active' => true]);
        $this->camera = Equipment::create(['cca_id' => $cca->id, 'name' => 'DSLR A', 'quantity' => 1, 'active' => true]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function request(array $overrides = [])
    {
        return $this->postJson('/api/equipment-loans', array_merge([
            'equipment_id' => $this->camera->id,
            'student_id' => $this->student->id,
            'start_date' => '2026-11-13',
            'end_date' => '2026-11-14',
        ], $overrides));
    }

    private function actingAsRole(string $role): User
    {
        $user = User::create(['name' => $role, 'email' => strtolower($role).'@test.local', 'password' => 'secret123']);
        $user->assignRole($role);
        Sanctum::actingAs($user, ['*']);

        return $user;
    }

    private function loan(string $status, string $start = '2026-11-13', string $end = '2026-11-14'): EquipmentLoan
    {
        return EquipmentLoan::create([
            'equipment_id' => $this->camera->id,
            'student_id' => $this->student->id,
            'start_date' => $start,
            'end_date' => $end,
            'status' => $status,
        ]);
    }

    public function test_kiosk_request_waits_for_approval(): void
    {
        $this->request()->assertCreated()->assertJsonPath('result.status', 'requested');
    }

    public function test_a_pending_request_holds_stock(): void
    {
        $this->request()->assertCreated();

        $this->request(['start_date' => '2026-11-14', 'end_date' => '2026-11-14'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('equipment_id');

        // A non-overlapping day is still free.
        $this->request(['start_date' => '2026-11-16', 'end_date' => '2026-11-16'])->assertCreated();
    }

    public function test_rejected_and_cancelled_loans_free_the_stock(): void
    {
        $this->loan('rejected');
        $this->loan('cancelled');

        $this->request()->assertCreated();
    }

    public function test_loan_is_at_most_two_days_and_cannot_start_in_the_past(): void
    {
        $this->request(['start_date' => '2026-11-13', 'end_date' => '2026-11-15'])
            ->assertUnprocessable()->assertJsonValidationErrors('end_date');

        $this->request(['start_date' => '2026-11-11', 'end_date' => '2026-11-11'])
            ->assertUnprocessable()->assertJsonValidationErrors('start_date');
    }

    public function test_inactive_equipment_cannot_be_borrowed(): void
    {
        $this->camera->update(['active' => false]);

        $this->request()->assertUnprocessable()->assertJsonValidationErrors('equipment_id');
    }

    public function test_only_loan_managers_can_approve(): void
    {
        $loan = $this->loan('requested');

        $this->putJson("/api/equipment-loans-confirm/{$loan->id}")->assertUnauthorized();

        $this->actingAsRole('Checkin');
        $this->putJson("/api/equipment-loans-confirm/{$loan->id}")->assertForbidden();

        $this->actingAsRole('Booking');
        $this->putJson("/api/equipment-loans-confirm/{$loan->id}")->assertOk()->assertJsonPath('result.status', 'reserved');
    }

    public function test_reject_and_return_follow_the_lifecycle(): void
    {
        $this->actingAsRole('Superadmin');
        $pending = $this->loan('requested');
        $approved = $this->loan('reserved', '2026-11-20', '2026-11-20');

        $this->putJson("/api/equipment-loans-reject/{$pending->id}")->assertOk()->assertJsonPath('result.status', 'rejected');
        $this->putJson("/api/equipment-loans-confirm/{$pending->id}")->assertUnprocessable();

        $this->putJson("/api/equipment-loans-return/{$approved->id}")->assertOk()->assertJsonPath('result.status', 'returned');
        $this->putJson("/api/equipment-loans-return/{$approved->id}")->assertUnprocessable();
    }

    public function test_cancel_only_before_an_approved_loan_starts(): void
    {
        $startsToday = $this->loan('reserved', '2026-11-12', '2026-11-12');
        $later = $this->loan('reserved', '2026-11-20', '2026-11-20');
        $pending = $this->loan('requested', '2026-11-25', '2026-11-25');

        $this->putJson("/api/equipment-loans-cancel/{$startsToday->id}")->assertUnprocessable();
        $this->putJson("/api/equipment-loans-cancel/{$later->id}")->assertOk()->assertJsonPath('result.status', 'cancelled');
        $this->putJson("/api/equipment-loans-cancel/{$pending->id}")->assertOk();
    }

    public function test_overdue_is_computed_and_filterable(): void
    {
        $this->actingAsRole('Superadmin');
        $overdue = $this->loan('reserved', '2026-11-09', '2026-11-10');
        $this->loan('reserved', '2026-11-12', '2026-11-13');
        $this->loan('returned', '2026-11-01', '2026-11-02');

        $this->getJson('/api/equipment_loans?status=overdue')
            ->assertOk()
            ->assertJsonCount(1, 'result')
            ->assertJsonPath('result.0.id', $overdue->id)
            ->assertJsonPath('result.0.is_overdue', true);
    }

    public function test_loan_list_is_staff_only(): void
    {
        $this->loan('requested');

        $this->getJson('/api/equipment_loans')->assertUnauthorized();

        $this->actingAsRole('Checkin');
        $this->getJson('/api/equipment_loans')->assertForbidden();

        $this->actingAsRole('Booking');
        $this->getJson('/api/equipment_loans')->assertOk()->assertJsonCount(1, 'result');
    }

    public function test_admin_created_loan_is_approved_and_still_checks_stock(): void
    {
        $admin = $this->actingAsRole('Booking');

        $this->postJson('/api/equipment_loans', [
            'equipment_id' => $this->camera->id,
            'student_id' => $this->student->id,
            'start_date' => '2026-11-13',
            'end_date' => '2026-11-13',
        ])->assertCreated()
            ->assertJsonPath('result.status', 'reserved')
            ->assertJsonPath('result.user_id', $admin->id);

        $this->request()->assertUnprocessable()->assertJsonValidationErrors('equipment_id');
    }

    public function test_admin_edit_rechecks_stock_but_ignores_the_loan_itself(): void
    {
        $this->actingAsRole('Booking');
        $loan = $this->loan('reserved', '2026-11-13', '2026-11-13');
        $this->loan('reserved', '2026-11-20', '2026-11-20');

        $payload = ['equipment_id' => $this->camera->id, 'student_id' => $this->student->id, 'end_date' => '2026-11-14'];

        $this->putJson("/api/equipment_loans/{$loan->id}", $payload + ['start_date' => '2026-11-13'])
            ->assertOk()->assertJsonPath('result.end_date', '2026-11-14');

        $this->putJson("/api/equipment_loans/{$loan->id}", ['start_date' => '2026-11-20', 'end_date' => '2026-11-20'] + $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('equipment_id');
    }

    public function test_equipment_with_loan_history_cannot_be_deleted(): void
    {
        $this->actingAsRole('Superadmin');
        $this->loan('returned', '2026-11-01', '2026-11-01');

        $this->deleteJson("/api/equipment/{$this->camera->id}")->assertUnprocessable();
        $this->deleteJson("/api/ccas/{$this->camera->cca_id}")->assertUnprocessable();
        $this->assertDatabaseHas('equipment', ['id' => $this->camera->id]);
    }

    public function test_kiosk_lists_only_active_ccas_and_equipment(): void
    {
        Cca::create(['name' => 'Old Club', 'active' => false]);

        $this->getJson('/api/ccas?active=1')->assertOk()->assertJsonCount(1, 'result');
        $this->getJson('/api/ccas')->assertOk()->assertJsonCount(2, 'result');
        $this->getJson("/api/equipment?active=1&cca_id={$this->camera->cca_id}")
            ->assertOk()->assertJsonPath('result.0.name', 'DSLR A');
    }
}
