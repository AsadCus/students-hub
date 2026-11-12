<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public const LOGIN_REQUIRED_KEY = 'login_required';

    public function __construct()
    {
        $this->middleware('permission:settings toggle-login', ['only' => ['setLoginRequired']]);
    }

    public function getLoginRequired()
    {
        $value = Setting::where('key', self::LOGIN_REQUIRED_KEY)->value('value');
        $enabled = filter_var($value, FILTER_VALIDATE_BOOL);

        return $this->ok(['login_required' => $enabled]);
    }

    public function setLoginRequired(Request $request)
    {
        $request->validate([
            'login_required' => ['required', 'boolean'],
        ]);

        $record = Setting::updateOrCreate(
            ['key' => self::LOGIN_REQUIRED_KEY],
            ['value' => $request->boolean('login_required') ? '1' : '0']
        );

        return $this->ok(['login_required' => $record->value === '1'], 'Setting updated');
    }
}
