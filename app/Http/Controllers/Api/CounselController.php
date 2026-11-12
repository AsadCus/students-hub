<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CounselService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** Kiosk "Ask Ms Vi" submit. Admin creates go through MasterApiController with the same service. */
class CounselController extends Controller
{
    public function __construct(private CounselService $counsels) {}

    public function submit(Request $request): JsonResponse
    {
        $data = $request->validate(config('constants.MASTER_VALIDATION_ARRAY.COUNSEL_VALIDATION'));

        return $this->ok($this->counsels->submit($data), 'Counsel record created', Response::HTTP_CREATED);
    }
}
