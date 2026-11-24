<?php

namespace App\Http\Controllers;

use App\Exceptions\VisorOcupado;
use App\Models\Account;
use App\Services\GrupoGoogle;
use App\Support\Hoy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use RuntimeException;

/**
 * Visor de «Crear cuenta» (apartado «Sin Gemini»): un Chrome nuevo del servidor abierto en el alta de Google, para crear
 * el Gmail A MANO ahí mismo. Al guardar el correo, ese Chrome (con la sesión que dejó el alta) se le asigna a la cuenta
 * nueva, que queda en «Sin Gemini»: así no hay que crear las cuentas en otros equipos y luego iniciar sesión aquí.
 * Administrador y socio.
 */
class CrearCuentaGoogleController extends Controller
{
    private const CLAVE = '/^[a-z0-9]{16}$/';

    /** Empieza un alta nueva con su propia clave (su propio perfil de Chrome). */
    public function nueva(): RedirectResponse
    {
        GrupoGoogle::limpiarAltasViejas();

        return redirect()->route('google.crear.visor', ['clave' => Str::lower(Str::random(16))]);
    }

    public function show(string $clave): Response
    {
        $this->revisarClave($clave);

        return response()->view('visor-crear', ['clave' => $clave])->header('Cache-Control', 'no-store');
    }

    /** Abre (o vuelve a mostrar) el Chrome de esta alta en su propia pantalla. */
    public function login(Request $request, string $clave, GrupoGoogle $grupo): JsonResponse
    {
        $this->revisarClave($clave);
        $datos = $request->validate(['ficha' => ['nullable', 'string', 'regex:/^[A-Za-z0-9-]{8,64}$/'], 'forzar' => ['nullable', 'boolean']]);

        try {
            $abierto = $grupo->abrirAlta($clave, (bool) ($datos['forzar'] ?? false), $datos['ficha'] ?? null);
        } catch (VisorOcupado $e) {
            return response()->json(['ok' => false, 'mensaje' => $e->getMessage(), 'ocupadas' => $e->ocupadas], 409);
        } catch (RuntimeException $e) {
            return response()->json(['ok' => false, 'mensaje' => $e->getMessage()], 422);
        }

        return response()->json(['ok' => true] + $abierto);
    }

    /** La pestaña del alta sigue abierta (cada minuto): sin este aviso, su Chrome se cierra solo a los 15 minutos. */
    public function latido(string $clave): Response
    {
        $this->revisarClave($clave);
        GrupoGoogle::latido(GrupoGoogle::correoAlta($clave));

        return response()->noContent();
    }

    /**
     * Con `ficha` (la pestaña se cerró): solo cierra el Chrome; el perfil se queda por si se vuelve a abrir. Sin ficha
     * («Cancelar»): cierra el Chrome y borra el perfil provisional.
     */
    public function cerrar(Request $request, string $clave, GrupoGoogle $grupo): RedirectResponse|Response
    {
        $this->revisarClave($clave);
        $ficha = $request->validate(['ficha' => ['nullable', 'string', 'regex:/^[A-Za-z0-9-]{8,64}$/']])['ficha'] ?? null;

        if ($ficha !== null) {
            try {
                $grupo->cerrarAlta($clave, $ficha);
            } catch (RuntimeException) {
                // Si ya estaba cerrado no pasa nada.
            }

            return response()->noContent();
        }

        $grupo->descartarAlta($clave);

        return redirect('/cuentas?estado=sin_gemini')->with('success', 'Se canceló la cuenta nueva y se cerró su Chrome.');
    }

    /** Ya se creó el Gmail en el visor: se guarda en «Sin Gemini» y se le asigna el Chrome del alta. */
    public function guardar(Request $request, string $clave, GrupoGoogle $grupo): RedirectResponse
    {
        $this->revisarClave($clave);
        $request->merge(['email' => mb_strtolower(trim((string) $request->input('email')))]);
        $datos = $request->validate([
            'email' => ['required', 'email:rfc', 'max:255', Rule::unique('accounts', 'email')],
            'password' => ['nullable', 'string', 'max:255'],
            'twofa_url' => ['nullable', 'url:https,http', 'max:500'],
        ], ['email.unique' => 'Esa cuenta ya está registrada.'], ['email' => 'correo de la cuenta', 'password' => 'contraseña de la cuenta', 'twofa_url' => 'liga de 2FA']);

        try {
            $grupo->asignarAlta($clave, $datos['email']);
        } catch (RuntimeException $e) {
            return back()->withInput($request->except('password'))->with('error', $e->getMessage());
        }

        $inicio = Carbon::parse(Hoy::fecha());
        $cuenta = Account::query()->create([
            'email' => $datos['email'],
            'password' => filled($datos['password'] ?? null) ? $datos['password'] : null,
            'twofa_url' => filled($datos['twofa_url'] ?? null) ? trim($datos['twofa_url']) : null,
            'started_on' => $inicio->toDateString(),
            'expires_on' => $inicio->copy()->addMonthsNoOverflow((int) config('zengpt.meses_cuenta'))->toDateString(),
            'created_by' => $request->user()->id,
            'por_activar' => true,
            'sin_gemini' => true,
        ]);

        return redirect('/cuentas?estado=sin_gemini')->with('success', "{$cuenta->email} quedó en «Sin Gemini» con su Chrome del servidor (la sesión del alta queda guardada ahí).");
    }

    private function revisarClave(string $clave): void
    {
        abort_unless(preg_match(self::CLAVE, $clave) === 1, 404);
    }
}
