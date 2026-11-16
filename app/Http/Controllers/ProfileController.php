<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function show(): Response
    {
        return Inertia::render('Perfil/Show');
    }

    public function password(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'confirmed', Password::min(10)],
        ], ['current_password.current_password' => 'La contraseña actual no coincide.'], ['current_password' => 'contraseña actual', 'password' => 'contraseña nueva']);

        $request->user()->update(['password' => $data['password']]);

        return back()->with('success', 'Contraseña actualizada.');
    }
}
