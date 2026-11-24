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
use Illuminate\Support\Facades\Process;
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
            'sacando' => GrupoGoogle::estadoSacar($account),
            'tiene2fa' => GrupoGoogle::secreto2fa($account->twofa_url) !== '',
        ])->header('Cache-Control', 'no-store');
    }

    /** La pestaña del visor sigue abierta (cada minuto): sin este aviso, su Chrome se cierra solo a los 15 minutos. */
    public function latido(Account $account): Response
    {
        GrupoGoogle::latido($account->email);

        return response()->noContent();
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

        // Si se cerró la pestaña mientras se saca a los miembros, el Chrome sigue hasta que termine.
        if ($ficha !== null && (GrupoGoogle::estadoSacar($account)['estado'] ?? null) === 'sacando') {
            return response()->noContent();
        }

        try {
            $grupo->cerrarVisor($account, $ficha);
        } catch (RuntimeException) {
            // Si ya estaba cerrado no pasa nada.
        }

        return $ficha !== null ? response()->noContent() : redirect('/cuentas');
    }

    /**
     * «Sacar a todos los miembros» (solo cuentas por activar): se lanza en segundo plano porque tarda 1–3 minutos; el
     * visor va preguntando el avance (estadoSacar) y lo ve pasar en la pantalla.
     */
    public function sacarMiembros(Account $account): JsonResponse
    {
        if (! $account->por_activar) {
            return response()->json(['ok' => false, 'mensaje' => 'Solo en cuentas por activar: en las activas se saca a cada cliente desde su espacio.'], 422);
        }

        if ((GrupoGoogle::estadoSacar($account)['estado'] ?? null) === 'sacando') {
            return response()->json(['ok' => false, 'mensaje' => 'Ya se está sacando a los miembros de esta cuenta.'], 409);
        }

        GrupoGoogle::guardarEstadoSacar($account, ['estado' => 'sacando', 'mensaje' => null, 'inicio' => now()->getTimestamp(), 'fin' => null]);
        Process::path(base_path())->run(sprintf('setsid nohup %s artisan zenbot:sacar-miembros %d > /dev/null 2>&1 &', escapeshellarg((string) config('zengpt.google.php')), $account->id));

        return response()->json(['ok' => true] + (GrupoGoogle::estadoSacar($account) ?? []));
    }

    /** Avance de «sacar a todos» (el visor lo pregunta cada 2 segundos). */
    public function estadoSacar(Account $account): JsonResponse
    {
        return response()->json(['ahora' => now()->getTimestamp()] + (GrupoGoogle::estadoSacar($account) ?? ['estado' => null]))->header('Cache-Control', 'no-store');
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
