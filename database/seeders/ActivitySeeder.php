<?php

namespace Database\Seeders;

use App\Models\Activity;
use Illuminate\Database\Seeder;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;

class ActivitySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $activities = [
            ['name' => 'Morning Assembly', 'description' => 'Daily morning gathering for announcements and activities.'],
            ['name' => 'Library Visit', 'description' => 'Students visit the library for reading and research.'],
            ['name' => 'Sports Training', 'description' => 'Training session for school sports teams.'],
            ['name' => 'Music Practice', 'description' => 'Practice session for the school band and choir.'],
            ['name' => 'Art Workshop', 'description' => 'Creative session for painting, drawing, and crafting.'],
            ['name' => 'Computer Lab', 'description' => 'Students work on coding and IT-related projects.'],
            ['name' => 'Extracurricular Club', 'description' => 'Various clubs such as science, drama, and debate.'],
            ['name' => 'Field Trip', 'description' => 'Educational visits to museums, parks, or companies.'],
            ['name' => 'Exam Review', 'description' => 'Preparation and discussion for upcoming exams.'],
            ['name' => 'Volunteer Program', 'description' => 'Community service and social responsibility activities.'],
        ];

        foreach ($activities as $activity) {
            Activity::firstOrCreate(['name' => $activity['name']], $activity);
        }
    }
}
