<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

class BlockedDate extends Model
{
    protected $table        = "blocked_dates";
    protected $primaryKey   = "id";
    protected $keyType      = "int";

    public $timestamps      = true;
    public $incrementing    = true;

    protected $fillable = [
        'date',
        'reason'
    ];

    /** The first blocked date that falls between two moments (inclusive, by calendar date). */
    public static function firstBetween(string $start, string $end): ?self
    {
        return static::whereBetween('date', [
            Carbon::parse($start)->toDateString(),
            Carbon::parse($end)->toDateString(),
        ])->orderBy('date')->first();
    }

    public function bookingClosedMessage(): string
    {
        return "Bookings are closed on {$this->date}: {$this->reason}.";
    }
}
