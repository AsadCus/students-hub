<?php

use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\CheckinController;
use App\Http\Controllers\Api\CounselController;
use App\Http\Controllers\Api\EquipmentLoanController;
use App\Http\Controllers\Api\MasterApiController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Auth\LoginController;
use Illuminate\Support\Facades\Route;

/**
 * References
 */
$types = config('constants.MASTER_TYPE_ARRAY');
Route::get('/app', fn () => response()->json(['status' => true, 'result' => []]));

/**
 * Authentication
 */
Route::post('/login', [LoginController::class, 'login'])->middleware('throttle:5,1');
Route::group(['middleware' => 'auth:sanctum'], function () {
    Route::post('/logout', [LoginController::class, 'logout']);
});

/**
 * Dashboard
 */
Route::group(['middleware' => 'auth:sanctum'], function () use ($types) {
    /**
     * Master data
     */
    Route::prefix('{type}')->where(['type' => implode('|', $types)])->group(function () {
        Route::get('/{id}', [MasterApiController::class, 'show']);
        Route::post('/', [MasterApiController::class, 'store']);
        Route::post('/import', [MasterApiController::class, 'import']);
        Route::put('/{id}', [MasterApiController::class, 'update']);
        Route::delete('/{id}', [MasterApiController::class, 'destroy']);
    });
});

Route::prefix('{type}')->where(['type' => implode('|', $types)])->group(function () {
    Route::get('/', [MasterApiController::class, 'index']);
});

/**
 * Check-in & out
 */
Route::post('/check-in', [CheckinController::class, 'checkin']);
Route::post('/check-out', [CheckinController::class, 'checkout']);

/**
 * Booking
 */
Route::post('/booking', [BookingController::class, 'store']);
Route::group(['middleware' => 'auth:sanctum'], function () {
    Route::put('/booking-confirm/{id}', [BookingController::class, 'confirm']);
});
Route::put('/booking-cancel/{id}', [BookingController::class, 'cancel'])->middleware('throttle:10,1');

/**
 * Equipment loans
 * CCAs, equipment and the admin loan list/create/edit/delete use the master
 * routes (/api/ccas, /api/equipment, /api/equipment_loans).
 */
Route::post('/equipment-loans', [EquipmentLoanController::class, 'store']);
Route::put('/equipment-loans-cancel/{id}', [EquipmentLoanController::class, 'cancel'])->middleware('throttle:10,1');
Route::group(['middleware' => 'auth:sanctum'], function () {
    Route::put('/equipment-loans-confirm/{id}', [EquipmentLoanController::class, 'confirm']);
    Route::put('/equipment-loans-reject/{id}', [EquipmentLoanController::class, 'reject']);
    Route::put('/equipment-loans-return/{id}', [EquipmentLoanController::class, 'markReturned']);
});

/**
 * Settings
 */
Route::get('/settings/login-required', [SettingsController::class, 'getLoginRequired']);
Route::group(['middleware' => 'auth:sanctum'], function () {
    Route::put('/settings/login-required', [SettingsController::class, 'setLoginRequired']);
});

/**
 * Ms Vi Counsellor
 */
Route::post('/counsel-submit', [CounselController::class, 'submit']);
