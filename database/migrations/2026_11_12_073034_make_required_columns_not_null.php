<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The original migrations used ->nullable('false'). The string 'false' is
 * truthy, so these required columns were created nullable. This makes them
 * NOT NULL, restating each column's type, length and default.
 */
return new class extends Migration
{
    /** @var array<string, list<string>> */
    private array $columns = [
        'levels' => ['name'],
        'classes' => ['name'],
        'students' => ['name'],
        'activities' => ['name'],
        'facilities' => ['name'],
        'support_strategies' => ['name'],
        'questions' => ['order', 'text', 'type'],
        'radio_options' => ['text'],
        'bookings' => ['start_time', 'end_time'],
        'checkins' => ['checkin_time'],
    ];

    public function up(): void
    {
        // Refuse rather than invent values for rows that are missing data.
        foreach ($this->columns as $table => $columns) {
            foreach ($columns as $column) {
                $nulls = DB::table($table)->whereNull($column)->count();
                if ($nulls > 0) {
                    throw new RuntimeException("{$table}.{$column} has {$nulls} empty value(s). Fill them in, then run the migration again.");
                }
            }
        }

        $this->apply(nullable: false);
    }

    public function down(): void
    {
        $this->apply(nullable: true);
    }

    private function apply(bool $nullable): void
    {
        foreach (['levels', 'classes', 'students', 'facilities', 'support_strategies'] as $table) {
            Schema::table($table, fn (Blueprint $t) => $t->string('name', 100)->nullable($nullable)->change());
        }
        Schema::table('activities', fn (Blueprint $t) => $t->string('name', 250)->nullable($nullable)->change());
        Schema::table('questions', function (Blueprint $t) use ($nullable) {
            $t->integer('order')->nullable($nullable)->change();
            $t->text('text')->nullable($nullable)->change();
            $t->enum('type', ['text', 'radio'])->nullable($nullable)->change();
        });
        Schema::table('radio_options', fn (Blueprint $t) => $t->text('text')->nullable($nullable)->change());
        Schema::table('bookings', function (Blueprint $t) use ($nullable) {
            $t->timestamp('start_time')->nullable($nullable)->change();
            $t->timestamp('end_time')->nullable($nullable)->change();
        });
        Schema::table('checkins', fn (Blueprint $t) => $t->timestamp('checkin_time')->useCurrent()->nullable($nullable)->change());
    }
};
