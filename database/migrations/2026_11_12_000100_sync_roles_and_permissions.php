<?php

use Database\Seeders\RoleSeeder;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\PermissionRegistrar;

/**
 * Brings existing databases up to the current RoleSeeder: CCA, equipment and
 * equipment loan permissions, the "settings toggle-login" permission and the
 * Student role. RoleSeeder is idempotent, so this is safe to run anywhere.
 */
return new class extends Migration
{
    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        (new RoleSeeder)->run();
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Permissions are left in place; removing them could lock users out.
    }
};
