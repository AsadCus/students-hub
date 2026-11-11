<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $roles = [
            ['name' => 'Superadmin', 'guard_name' => 'web'],
            ['name' => 'Checkin', 'guard_name' => 'web'],
            ['name' => 'Booking', 'guard_name' => 'web'],
            ['name' => 'Counsel', 'guard_name' => 'web'],
            ['name' => 'Student', 'guard_name' => 'web'],
        ];

        // Create roles idempotently
        foreach ($roles as $roleData) {
            Role::firstOrCreate([
                'name' => $roleData['name'],
                'guard_name' => $roleData['guard_name'],
            ]);
        }

        $masterTypes = config('constants.MASTER_TYPE_ARRAY');

        foreach ($masterTypes as $masterType) {
            Permission::firstOrCreate(['name' => $masterType . ' view', 'guard_name' => 'web']);
            Permission::firstOrCreate(['name' => $masterType . ' create', 'guard_name' => 'web']);
            Permission::firstOrCreate(['name' => $masterType . ' edit', 'guard_name' => 'web']);
            Permission::firstOrCreate(['name' => $masterType . ' delete', 'guard_name' => 'web']);

            if ($masterType == 'bookings') {
                Permission::firstOrCreate(['name' => $masterType . ' confirm', 'guard_name' => 'web']);
            }

            $superadminPermissions = [
                $masterType . ' view',
                $masterType . ' create',
                $masterType . ' edit',
                $masterType . ' delete',
            ];
            if ($masterType == 'bookings') {
                $superadminPermissions[] = $masterType . ' confirm';
            }
            Role::findByName('Superadmin')->givePermissionTo($superadminPermissions);
        }

        Permission::firstOrCreate(['name' => 'dashboard view', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'dashboard-checkin view', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'dashboard-bookings view', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'dashboard-counsels view', 'guard_name' => 'web']);
        Permission::firstOrCreate(['name' => 'settings toggle-login', 'guard_name' => 'web']);

        Role::findByName('Superadmin')->givePermissionTo([
            'dashboard view',
            'settings toggle-login',
        ]);

        Role::findByName('Checkin')->givePermissionTo([
            'activities view',
            'activities create',
            'activities edit',
            'activities delete',
            'checkin view',
            'checkin create',
            'checkin edit',
            'checkin delete',
            'dashboard-checkin view',
        ]);

        Role::findByName('Booking')->givePermissionTo([
            'facilities view',
            'facilities create',
            'facilities edit',
            'facilities delete',
            'ccas view',
            'ccas create',
            'ccas edit',
            'ccas delete',
            'equipment view',
            'equipment create',
            'equipment edit',
            'equipment delete',
            'bookings view',
            'bookings create',
            'bookings edit',
            'bookings delete',
            'bookings confirm',
            'blocked_dates view',
            'blocked_dates create',
            'blocked_dates edit',
            'blocked_dates delete',
            'dashboard-bookings view',
        ]);

        Role::findByName('Counsel')->givePermissionTo([
            'support_strategies view',
            'support_strategies create',
            'support_strategies edit',
            'support_strategies delete',
            'questions view',
            'questions create',
            'questions edit',
            'questions delete',
            'radio_options view',
            'radio_options create',
            'radio_options edit',
            'radio_options delete',
            'counsels view',
            'counsels create',
            'counsels edit',
            'counsels delete',
            'dashboard-counsels view',
        ]);
    }
}
