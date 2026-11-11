<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EquipmentLoan extends Model
{
    use HasFactory;

    public const REQUESTED = 'requested';
    public const RESERVED = 'reserved';
    public const REJECTED = 'rejected';
    public const CANCELLED = 'cancelled';
    public const RETURNED = 'returned';

    /** Statuses that hold a unit of stock for their dates. */
    public const HOLDS_STOCK = [self::REQUESTED, self::RESERVED];

    protected $fillable = [
        'equipment_id',
        'student_id',
        'user_id',
        'start_date',
        'end_date',
        'status',
        'notes',
    ];

    protected $casts = [
        'start_date' => 'date:Y-m-d',
        'end_date' => 'date:Y-m-d',
    ];

    protected $appends = ['is_overdue'];

    /** A reserved loan whose end date has passed and that hasn't been returned. */
    protected function isOverdue(): Attribute
    {
        return Attribute::get(
            fn () => $this->status === self::RESERVED && $this->end_date?->lt(today())
        );
    }

    public function equipment()
    {
        return $this->belongsTo(Equipment::class);
    }

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    /** The staff member who created the loan from the admin page, if any. */
    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
