<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Loans now go requested -> reserved (approved) or rejected -> returned.
 * cancelled stays for loans withdrawn before they start.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('equipment_loans', function (Blueprint $table) {
            $table->enum('status', ['requested', 'reserved', 'rejected', 'cancelled', 'returned'])
                ->default('requested')
                ->change();
        });
    }

    public function down(): void
    {
        DB::table('equipment_loans')->where('status', 'requested')->update(['status' => 'reserved']);
        DB::table('equipment_loans')->where('status', 'rejected')->update(['status' => 'cancelled']);

        Schema::table('equipment_loans', function (Blueprint $table) {
            $table->enum('status', ['reserved', 'returned', 'cancelled'])
                ->default('reserved')
                ->change();
        });
    }
};
