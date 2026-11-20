<?php

namespace App\Http\Controllers;

use App\Exceptions\VisorOcupado;
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
 * sesión se cierra): la pantalla (noVNC) más los datos de la cuenta para copiarlos o pegarlos directo. Administrador y socio.
 */
class VisorGoogleController extends Controller
{
    /** nginx (auth_request) pregunta aquí antes de dejar pasar a /zenbot-visor/: cualquier usuario con sesión en ZenGPT. */
    public function autorizar(Request $request): Response
    {
        return response('', $request->user() !== null ? 204 : 403);
    }

    public function show(Account $account): Response
    {
        return response()->view('visor-google', [
            'cuenta' => $account,
            'bloqueo' => $account->bloqueoHastaTexto(),
            'tiene2fa' => GrupoGoogle::secreto2fa($account->twofa_url) !== '',
        ])->header('Cache-Control', 'no-store');
    }

    /** Código 2FA vigente y segundos que le quedan. */
    public function codigo(Account $account): JsonResponse
    {
        $secreto = GrupoGoogle::secreto2fa($account->twofa_url);

        return response()->json(['codigo' => $secreto !== '' ? Totp::codigo($secreto) : null, 'restante' => Totp::restante()])->header('Cache-Control', 'no-store');
    }

    /**
     * Abre el Chrome de ESTA cuenta en su propia pantalla del visor (varias cuentas pueden tener su visor abierto a la
     * vez). `ficha` identifica la pestaña; `forzar` cierra el visor más viejo si todas las pantallas están en uso.
     */
    public function login(Request $request, Account $account, GrupoGoogle $grupo): JsonResponse
    {
        $datos = $request->validate(['ficha' => ['nullable', 'string', 'regex:/^[A-Za-z0-9-]{8,64}$/'], 'forzar' => ['nullable', 'boolean']]);

        try {
            $abierto = $grupo->abrirVisor($account, (bool) ($datos['forzar'] ?? false), $datos['ficha'] ?? null);
        } catch (VisorOcupado $e) {
            return response()->json(['ok' => false, 'mensaje' => $e->getMessage(), 'ocupadas' => $e->ocupadas], 409);
        } catch (RuntimeException $e) {
            return response()->json(['ok' => false, 'mensaje' => $e->getMessage()], 422);
        }

        return response()->json(['ok' => true] + $abierto);
    }

    /**
     * Cierra el Chrome de la cuenta sin revisar nada. La pestaña del visor lo pide sola al cerrarse (con su `ficha`, para
     * no cerrar uno que otra pestaña acaba de abrir): a esa se le contesta 204 sin redirigir.
     */
    public function cerrar(Request $request, Account $account, GrupoGoogle $grupo): RedirectResponse|Response
    {
        $ficha = $request->validate(['ficha' => ['nullable', 'string', 'regex:/^[A-Za-z0-9-]{8,64}$/']])['ficha'] ?? null;

        try {
            $grupo->cerrarVisor($account, $ficha);
        } catch (RuntimeException) {
            // Si ya estaba cerrado no pasa nada.
        }

        return $ficha !== null ? response()->noContent() : redirect('/cuentas');
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

        $bloqueo = $account->refresh()->bloqueoHastaTexto();

        return redirect('/cuentas')->with('success', "Sesión de Google lista para {$account->email}. Grupo revisado.".($bloqueo ? " Google no deja invitar: quedó bloqueada hasta el {$bloqueo}." : ''));
    }
}
