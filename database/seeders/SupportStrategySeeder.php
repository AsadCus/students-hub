<?php

namespace Database\Seeders;

use App\Models\SupportStrategy;
use Illuminate\Database\Seeder;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;

class SupportStrategySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $supportStrategies = [
            ['name' => 'Perspective'],
            ['name' => 'Solution'],
            ['name' => 'Listening Ear']
        ];

        foreach ($supportStrategies as $strategy) {
            SupportStrategy::firstOrCreate(['name' => $strategy['name']], $strategy);
        }
    }
}
