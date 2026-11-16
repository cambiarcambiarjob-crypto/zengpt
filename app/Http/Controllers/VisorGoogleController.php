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
 * Visor del Chrome de cada cuenta en el servidor, para iniciar sesión A MANO en Google (la primera vez o cuando la
 * sesión se cierra): la pantalla (noVNC) más los datos de la cuenta para copiarlos o pegarlos directo. Solo el administrador.
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
        return response()->view('visor-google', [
            'cuenta' => $account,
            'tiene2fa' => GrupoGoogle::secreto2fa($account->twofa_url) !== '',
        ])->header('Cache-Control', 'no-store');
    }

    /** Código 2FA vigente y segundos que le quedan. */
    public function codigo(Account $account): JsonResponse
    {
        $secreto = GrupoGoogle::secreto2fa($account->twofa_url);

        return response()->json(['codigo' => $secreto !== '' ? Totp::codigo($secreto) : null, 'restante' => Totp::restante()])->header('Cache-Control', 'no-store');
    }

    /** Abre el Chrome de ESTA cuenta en la pantalla del visor (cada cuenta tiene el suyo, con su propia sesión). */
    public function login(Account $account, GrupoGoogle $grupo): JsonResponse
    {
        try {
            $sesion = $grupo->abrirVisor($account);
        } catch (RuntimeException $e) {
            return response()->json(['ok' => false, 'mensaje' => $e->getMessage()], 422);
        }

        return response()->json(['ok' => true, 'sesion' => $sesion]);
    }

    /** Cierra el Chrome de la cuenta sin revisar nada. */
    public function cerrar(Account $account, GrupoGoogle $grupo): RedirectResponse
    {
        try {
            $grupo->cerrarVisor($account);
        } catch (RuntimeException) {
            // Si ya estaba cerrado no pasa nada.
        }

        return redirect('/cuentas');
    }

    /** «Ya inicié sesión»: revisa el grupo para confirmar que la sesión quedó bien. */
    public function listo(Account $account, GrupoGoogle $grupo): RedirectResponse
    {
        try {
            $account->forceFill(['google_conectada' => true])->save();
            $grupo->sincronizar($account);
        } catch (RuntimeException $e) {
            $account->forceFill(['google_conectada' => false])->save();

            return back()->with('error', 'Todavía no quedó la sesión: '.$e->getMessage());
        }

        try {
            $grupo->cerrarVisor($account);
        } catch (RuntimeException) {
            // El Chrome se cierra solo al pasar el tiempo del visor.
        }

        return redirect('/cuentas')->with('success', "Sesión de Google lista para {$account->email}. Grupo revisado.");
    }
}
