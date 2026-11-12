<?php

namespace App\Http\Controllers;

use App\Support\ApiResponse;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller as BaseController;

class Controller extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    protected function ok(mixed $result = null, string $message = 'OK', int $status = 200): JsonResponse
    {
        return ApiResponse::ok($result, $message, $status);
    }

    /**
     * @param  array<string, list<string>>  $errors
     */
    protected function fail(string $message, int $status = 422, array $errors = []): JsonResponse
    {
        return ApiResponse::fail($message, $status, $errors);
    }
}
