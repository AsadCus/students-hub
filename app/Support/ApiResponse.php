<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;

/**
 * The one JSON shape every API response uses.
 *
 * Success: 2xx, {status: true, message, result} (result is [] when empty).
 * Failure: 4xx/5xx, {status: false, message, errors?} (errors: field => messages).
 */
class ApiResponse
{
    public static function ok(mixed $result = null, string $message = 'OK', int $status = 200): JsonResponse
    {
        return response()->json([
            'status' => true,
            'message' => $message,
            'result' => $result ?? [],
        ], $status);
    }

    /**
     * @param  array<string, list<string>>  $errors
     */
    public static function fail(string $message, int $status = 422, array $errors = []): JsonResponse
    {
        $body = ['status' => false, 'message' => $message];
        if ($errors) {
            $body['errors'] = $errors;
        }

        return response()->json($body, $status);
    }
}
