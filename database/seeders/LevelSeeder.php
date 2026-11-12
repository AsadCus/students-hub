<?php

namespace Database\Seeders;

use App\Models\Level;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class LevelSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $levels = [
            ['name' => 'Primary 1'],
            ['name' => 'Primary 2'],
            ['name' => 'Primary 3'],
            ['name' => 'Primary 4']
        ];

        foreach ($levels as $level) {
            Level::firstOrCreate(['name' => $level['name']]);
        }
    }
}
