<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;

use Illuminate\Database\Seeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UserSeeder;
use Database\Seeders\ClassSeeder;
use Database\Seeders\StudentSeeder;
use Database\Seeders\ActivitySeeder;
use Database\Seeders\FacilitySeeder;
use Database\Seeders\QuestionSeeder;
use Database\Seeders\RadioOptionSeeder;
use Database\Seeders\SupportStrategySeeder;
use Database\Seeders\CcaSeeder;
use Database\Seeders\EquipmentSeeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        $this->call(RoleSeeder::class);
        $this->call(UserSeeder::class);
        $this->call(LevelSeeder::class);
        $this->call(ClassSeeder::class);
        $this->call(StudentSeeder::class);
        $this->call(ActivitySeeder::class);
        $this->call(FacilitySeeder::class);
        $this->call(CcaSeeder::class);
        $this->call(EquipmentSeeder::class);
        $this->call(SupportStrategySeeder::class);
        $this->call(QuestionSeeder::class);
        $this->call(RadioOptionSeeder::class);
    }
}
