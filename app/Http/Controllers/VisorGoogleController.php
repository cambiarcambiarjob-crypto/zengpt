<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Services\GrupoGoogle;
use App\Support\Totp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use RuntimeException;

/**
 * Visor del Chrome del servidor para iniciar sesión A MANO en Google cuando la sesión se cierra: la pantalla
 * (noVNC) más los datos de la cuenta para copiarlos o pegarlos directo. Solo el administrador.
 */
class VisorGoogleController extends Controller
{
    /** nginx (auth_request) pregunta aquí antes de dejar pasar a /zenbot-visor/: solo el administrador con sesión. */
    public function autorizar(Request $request): Response
    {
        return response('', $request->user()?->isAdmin() ? 204 : 403);
    }

    public function show(Account $account): Response
    {
        abort_unless(GrupoGoogle::conectada($account), 404);

        return response()->view('visor-google', [
            'cuenta' => $account,
            'tiene2fa' => GrupoGoogle::secreto2fa($account->twofa_url) !== '',
        ])->header('Cache-Control', 'no-store');
    }

    /** Código 2FA vigente y segundos que le quedan. */
    public function codigo(Account $account): JsonResponse
    {
        abort_unless(GrupoGoogle::conectada($account), 404);
        $secreto = GrupoGoogle::secreto2fa($account->twofa_url);

        return response()->json(['codigo' => $secreto !== '' ? Totp::codigo($secreto) : null, 'restante' => Totp::restante()])->header('Cache-Control', 'no-store');
    }

    /** Deja el Chrome del servidor en la pantalla de inicio de sesión de Google. */
    public function login(Account $account, GrupoGoogle $grupo): JsonResponse
    {
        try {
            $grupo->abrirLogin($account);
        } catch (RuntimeException $e) {
            return response()->json(['ok' => false, 'mensaje' => $e->getMessage()], 422);
        }

        return response()->json(['ok' => true]);
    }

    /** «Ya inicié sesión»: revisa el grupo para confirmar que la sesión quedó bien. */
    public function listo(Account $account, GrupoGoogle $grupo): RedirectResponse
    {
        try {
            $grupo->sincronizar($account);
        } catch (RuntimeException $e) {
            return back()->with('error', 'Todavía no quedó la sesión: '.$e->getMessage());
        }

        return redirect('/cuentas')->with('success', "Sesión de Google lista para {$account->email}. Grupo revisado.");
    }
}
