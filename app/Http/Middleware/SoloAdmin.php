<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Acciones reservadas al dueño (p. ej. capturar la publicidad del día). */
class SoloAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless($request->user()?->isAdmin(), 403, 'Solo el administrador puede hacer esto.');

        return $next($request);
    }
}
