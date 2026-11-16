<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AuthController extends Controller
{
    public function show(): Response
    {
        return Inertia::render('Auth/Login');
    }

    public function login(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'max:120'],
            'password' => ['required', 'string', 'max:255'],
        ], [], ['username' => 'usuario', 'password' => 'contraseña']);

        $username = mb_strtolower(trim($data['username']));
        $key = 'login:'.$username.'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($key, 6)) {
            throw ValidationException::withMessages([
                'username' => 'Demasiados intentos. Espera '.RateLimiter::availableIn($key).' segundos.',
            ]);
        }

        // «remember» siempre: la sesión no caduca hasta que la persona cierre sesión.
        if (! Auth::attempt(['username' => $username, 'password' => $data['password']], true)) {
            RateLimiter::hit($key, 60);

            throw ValidationException::withMessages(['username' => 'Usuario o contraseña incorrectos.']);
        }

        RateLimiter::clear($key);
        $request->session()->regenerate();

        return redirect()->intended('/');
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/login');
    }
}
