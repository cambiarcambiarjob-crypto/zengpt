<?php

namespace App\Http\Middleware;

use App\Models\Account;
use App\Support\Hoy;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    /** @return array<string, mixed> */
    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user ? ['id' => $user->id, 'name' => $user->name, 'username' => $user->username, 'role' => $user->role, 'is_admin' => $user->isAdmin()] : null,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
            'negocio' => [
                'hoy' => Hoy::fecha(),
                'capacidad' => Account::capacity(),
                'precios' => config('zengpt.precios'),
                'porcentaje_socio' => (float) config('zengpt.porcentaje_socio'),
                'porcentaje_vendedor' => (float) config('zengpt.porcentaje_vendedor'),
                'meses_cuenta' => (int) config('zengpt.meses_cuenta'),
            ],
        ];
    }
}
