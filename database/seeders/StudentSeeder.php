<?php

namespace Database\Seeders;

use App\Models\Student;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class StudentSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $students = [
            ['name' => 'Aaron Tan', 'class_id' => 1],
            ['name' => 'Li Jia Wei', 'class_id' => 1],
            ['name' => 'Nurul Aisyah', 'class_id' => 2],
            ['name' => 'Benjamin Lee', 'class_id' => 2],
            ['name' => 'Chen Yi Xin', 'class_id' => 3],
            ['name' => 'Siti Nur Hidayah', 'class_id' => 3],
            ['name' => 'Daniel Ong', 'class_id' => 4],
            ['name' => 'Xiao Mei', 'class_id' => 4],
            ['name' => 'Rahul Kumar', 'class_id' => 5],
            ['name' => 'Ethan Lim', 'class_id' => 5],
            ['name' => 'Mei Ling Chua', 'class_id' => 6],
            ['name' => 'Aisha bte Rahman', 'class_id' => 6],
            ['name' => 'Chloe Goh', 'class_id' => 7],
            ['name' => 'Jasmine Tan', 'class_id' => 7],
            ['name' => 'Kevin Lee', 'class_id' => 8],
            ['name' => 'Xiaolin Wong', 'class_id' => 8]
        ];

        foreach ($students as $student) {
            Student::firstOrCreate(
                ['name' => $student['name'], 'class_id' => $student['class_id']],
                $student
            );
        }
    }
}
