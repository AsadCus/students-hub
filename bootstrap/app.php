<?php

use App\Support\ApiResponse;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Every API error uses the same shape as successful responses
        // ({status: false, message, errors?}); see App\Support\ApiResponse.
        $api = fn ($request) => $request->is('api/*') || $request->expectsJson();

        $exceptions->render(function (\Illuminate\Validation\ValidationException $e, $request) use ($api) {
            if ($api($request)) {
                return ApiResponse::fail($e->validator->errors()->first(), 422, $e->errors());
            }
        });

        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, $request) use ($api) {
            if ($api($request)) {
                return ApiResponse::fail('Log in to continue.', 401);
            }
        });

        // A unique index caught a duplicate that validation didn't.
        $exceptions->render(function (\Illuminate\Database\UniqueConstraintViolationException $e, $request) use ($api) {
            if ($api($request)) {
                return ApiResponse::fail('That record already exists.', 422);
            }
        });

        // Model-not-found, permission and rate-limit errors arrive here as HTTP
        // exceptions (Laravel converts them before render callbacks run).
        $exceptions->render(function (\Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $e, $request) use ($api) {
            if (! $api($request)) {
                return null;
            }

            $message = match ($e->getStatusCode()) {
                403 => "You don't have permission to do that.",
                404 => $e->getPrevious() instanceof \Illuminate\Database\Eloquent\ModelNotFoundException
                    ? "That record doesn't exist. It may have been deleted."
                    : 'Not found.',
                429 => 'Too many attempts. Wait a minute and try again.',
                default => $e->getMessage() ?: 'Something went wrong.',
            };

            return ApiResponse::fail($message, $e->getStatusCode())->withHeaders($e->getHeaders());
        });
    })->create();
