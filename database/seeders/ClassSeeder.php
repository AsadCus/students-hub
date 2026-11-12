<?php

namespace Database\Seeders;

use App\Models\DataClass;
use Illuminate\Database\Seeder;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;

class ClassSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $classes = [
            ['name' => '1A', 'level_id' => 1],
            ['name' => '1B', 'level_id' => 1],
            ['name' => '2A', 'level_id' => 2],
            ['name' => '2B', 'level_id' => 2],
            ['name' => '3A', 'level_id' => 3],
            ['name' => '3B', 'level_id' => 3],
            ['name' => '4A', 'level_id' => 4],
            ['name' => '4B', 'level_id' => 4]
        ];

        foreach ($classes as $class) {
            DataClass::firstOrCreate(
                ['name' => $class['name'], 'level_id' => $class['level_id']],
                $class
            );
        }
    }
}
