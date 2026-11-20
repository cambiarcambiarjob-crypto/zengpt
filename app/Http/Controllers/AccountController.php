<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\Seller;
use App\Services\GrupoGoogle;
use App\Support\Hoy;
use App\Support\Presentar;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Process;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class AccountController extends Controller
{
    public function index(Request $request): Response
    {
        $estado = in_array($request->query('estado'), ['activas', 'llenas', 'bloqueadas', 'por_activar', 'vencidas', 'todas', 'con_espacio', 'por_cobrar'], true) ? $request->query('estado') : 'activas';
        $q = trim((string) $request->query('q'));

        $cuentas = Account::query()
            ->with('slots.seller')
            ->when(in_array($estado, ['activas', 'llenas', 'bloqueadas', 'con_espacio'], true), fn ($query) => $query->active())
            ->when($estado === 'bloqueadas', fn ($query) => $query->where('google_bloqueo_hasta', '>', now()))
            ->when($estado === 'vencidas', fn ($query) => $query->expired())
            ->when($estado === 'por_activar', fn ($query) => $query->porActivar())
            ->when($estado === 'por_cobrar', fn ($query) => $query->whereHas('slots', fn ($s) => $s->porCobrar()))
            ->when($q !== '', fn ($query) => $query->where(fn ($w) => $w
                ->where('email', 'like', "%{$q}%")
                ->orWhereHas('slots', fn ($s) => $s->where('client_email', 'like', "%{$q}%")->orWhere('client_phone', 'like', "%{$q}%"))))
            ->orderByDesc('started_on')->orderByDesc('id')
            ->get()
            // «Con espacio» = donde se puede acomodar a alguien hoy: sin el bloqueo de invitaciones de Google.
            ->when($estado === 'con_espacio', fn ($c) => $c->filter(fn (Account $a): bool => $a->tieneEspacioParaVender()))
            // Las llenas (5 ocupados, todos pagados y dentro del grupo) se apartan de «Activas»; al buscar sí aparecen.
            ->when($estado === 'activas' && $q === '', fn ($c) => $c->reject(fn (Account $a): bool => $a->estaLlena(GrupoGoogle::conectada($a))))
            ->when($estado === 'llenas', fn ($c) => $c->filter(fn (Account $a): bool => $a->estaLlena(GrupoGoogle::conectada($a))))
            ->map(fn (Account $a): array => Presentar::cuenta($a))->values()->all();

        $llenas = Account::query()->active()->with('slots')->get()
            ->filter(fn (Account $a): bool => $a->estaLlena(GrupoGoogle::conectada($a)))->count();

        return Inertia::render('Cuentas/Index', [
            'cuentas' => $cuentas,
            'filtros' => ['estado' => $estado, 'q' => $q],
            'llenas' => $llenas,
            'bloqueadas' => Account::query()->active()->where('google_bloqueo_hasta', '>', now())->count(),
            'por_activar' => Account::query()->porActivar()->count(),
            'vendedores' => Seller::query()->where('active', true)->ordered()->get(['id', 'name', 'is_owner']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        $inicio = Carbon::parse($data['started_on']);

        $cuenta = Account::query()->create([
            'invite_links' => $this->ligas($data),
            'email' => $data['email'],
            'password' => filled($data['password'] ?? null) ? $data['password'] : null,
            'twofa_url' => filled($data['twofa_url'] ?? null) ? trim($data['twofa_url']) : null,
            'started_on' => $inicio->toDateString(),
            'expires_on' => $inicio->copy()->addMonthsNoOverflow((int) config('zengpt.meses_cuenta'))->toDateString(),
            'notes' => $data['notes'] ?? null,
            'created_by' => $request->user()->id,
            'por_activar' => $request->boolean('por_activar'),
        ]);
        $cuenta->syncInviteLinks();

        return back()->with('success', $cuenta->por_activar ? 'Cuenta agregada en «Por activar».' : 'Cuenta agregada.');
    }

    /**
     * «Generar liga»: en segundo plano (tarda unos segundos), Google manda UNA invitación del grupo familiar al correo de
     * ligas; luego se pega esa liga en la cuenta como siempre y se genera la siguiente. La tarjeta muestra el resultado.
     */
    public function generarLigas(Account $account): RedirectResponse
    {
        if (! GrupoGoogle::conectada($account)) {
            return back()->with('error', 'Primero conecta la cuenta con Google: entra una vez con «Conectar con Google (visor)» y luego genera las ligas.');
        }

        if ((GrupoGoogle::estadoLigas($account)['estado'] ?? null) === 'generando') {
            return back()->with('error', 'Ya se está mandando una liga de esta cuenta: espera a que termine.');
        }

        GrupoGoogle::guardarEstadoLigas($account, ['estado' => 'generando', 'enviadas' => 0, 'total' => null, 'mensaje' => null]);
        Process::path(base_path())->run(sprintf('setsid nohup %s artisan zenbot:generar-ligas %d > /dev/null 2>&1 &', escapeshellarg((string) config('zengpt.google.php')), $account->id));

        return back()->with('success', 'Mandando la liga: Google te manda una invitación a tu correo de ligas (tarda unos segundos).');
    }

    /** Activa una cuenta que estaba «por activar»: su vigencia corre desde la fecha de inicio elegida (hoy por omisión). */
    public function activar(Request $request, Account $account): RedirectResponse
    {
        if (! $account->por_activar) {
            return back()->with('error', 'Esa cuenta ya estaba activa.');
        }

        $data = $request->validate([
            'started_on' => ['nullable', 'date_format:Y-m-d', 'before_or_equal:'.Hoy::carbon()->addDay()->toDateString()],
        ], [], ['started_on' => 'fecha de inicio']);

        $account->activar($data['started_on'] ?? Hoy::fecha());

        return back()->with('success', "{$account->email} activada: vence el ".$account->expires_on->locale('es')->isoFormat('D [de] MMMM [de] YYYY').'.');
    }

    public function update(Request $request, Account $account): RedirectResponse
    {
        $data = $this->validated($request, $account);
        $inicio = Carbon::parse($data['started_on']);

        $account->update([
            'invite_links' => $this->ligas($data),
            'email' => $data['email'],
            'password' => filled($data['password'] ?? null) ? $data['password'] : null,
            'twofa_url' => filled($data['twofa_url'] ?? null) ? trim($data['twofa_url']) : null,
            'started_on' => $inicio->toDateString(),
            // La vigencia se recalcula desde el inicio salvo que el administrador fije otra fecha.
            'expires_on' => $request->user()->isAdmin() && filled($data['expires_on'] ?? null)
                ? Carbon::parse($data['expires_on'])->toDateString()
                : $inicio->copy()->addMonthsNoOverflow((int) config('zengpt.meses_cuenta'))->toDateString(),
            'notes' => $data['notes'] ?? null,
        ]);

        // Bloqueo de invitaciones de Google capturado a mano: «se liberan el …» (vacío = ya no está bloqueada).
        if ($request->exists('google_bloqueo_hasta')) {
            $this->fijarBloqueo($account, $data['google_bloqueo_hasta'] ?? null);
        }

        $account->syncInviteLinks();

        return back()->with('success', 'Cuenta actualizada.');
    }

    /**
     * Bloqueo de invitaciones de Google con un clic (desde el visor o la tarjeta de la cuenta): `bloquear` lo marca por
     * los días de config('zengpt.google.dias_bloqueo') y `quitar` lo quita (Google ya deja invitar).
     */
    public function bloqueo(Request $request, Account $account): RedirectResponse
    {
        $accion = $request->validate(['accion' => ['required', Rule::in(['bloquear', 'quitar'])]])['accion'];

        if ($accion === 'quitar') {
            $account->desbloquearInvitaciones();

            return back()->with('success', "Listo: {$account->email} ya puede invitar de nuevo.");
        }

        $account->bloquearInvitaciones();

        return back()->with('success', "Invitaciones de {$account->email} marcadas como bloqueadas por Google hasta el {$account->bloqueoHastaTexto()}.");
    }

    /** Fija el bloqueo desde el formulario: la fecha en que Google vuelve a dejar invitar (desde las 0:00 de ese día). */
    private function fijarBloqueo(Account $account, ?string $fecha): void
    {
        if (blank($fecha)) {
            $account->desbloquearInvitaciones();

            return;
        }

        $zona = config('zengpt.zona', 'America/Chihuahua');

        // Si la fecha es la misma que ya tenía (p. ej. la que puso Google sola), se conserva la hora exacta.
        if ($account->invitacionesBloqueadas() && $account->google_bloqueo_hasta->copy()->setTimezone($zona)->toDateString() === $fecha) {
            return;
        }

        $account->bloquearInvitaciones(Carbon::parse($fecha, $zona)->startOfDay());
    }

    public function destroy(Request $request, Account $account): RedirectResponse
    {
        // Con clientes dentro solo la borra el administrador (se pierden sus ventas).
        if ($account->slots()->exists() && ! $request->user()->isAdmin()) {
            return back()->with('error', 'La cuenta tiene clientes: solo el administrador puede eliminarla.');
        }

        $account->delete();

        return back()->with('success', 'Cuenta eliminada.');
    }

    /**
     * Ligas por espacio normalizadas: {"1": {url, expires_on}, …}. Sin fecha, la liga vence en 7 días.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, array{url: string, expires_on: string}>|null
     */
    /** Revisa en Google (solo lectura) quién está en el grupo familiar de la cuenta y actualiza a sus clientes. */
    public function google(Account $account, GrupoGoogle $grupo): RedirectResponse
    {
        try {
            $r = $grupo->sincronizar($account);
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        $partes = array_filter([
            $r['agregados'] ? "{$r['agregados']} agregados al sistema" : null,
            $r['miembros'] ? "{$r['miembros']} en el grupo" : null,
            $r['invitados'] ? "{$r['invitados']} con invitación pendiente" : null,
            $r['ausentes'] ? "{$r['ausentes']} que no aparecen" : null,
            $r['extra'] ? "{$r['extra']} sin espacio libre en la cuenta" : null,
            ($r['ligas'] ?? 0) ? "{$r['ligas']} ligas por mandar" : null,
            $r['bloqueo'] ? "invitaciones bloqueadas por Google hasta el {$r['bloqueo']}" : null,
        ]);

        return back()->with('success', 'Revisado en Google: '.($partes ? implode(' · ', $partes) : 'el grupo está vacío').'.');
    }

    private function ligas(array $data): ?array
    {
        $ligas = [];

        foreach ((array) ($data['invite_links'] ?? []) as $posicion => $liga) {
            $posicion = (int) $posicion;
            $url = trim((string) ($liga['url'] ?? ''));

            if ($posicion < 1 || $posicion > Account::capacity() || $url === '') {
                continue;
            }

            $ligas[(string) $posicion] = ['url' => $url, 'expires_on' => $liga['expires_on'] ?? Hoy::carbon()->addDays(7)->toDateString()];
        }

        return $ligas === [] ? null : $ligas;
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, ?Account $account = null): array
    {
        $request->merge(['email' => mb_strtolower(trim((string) $request->input('email')))]);

        return $request->validate([
            'email' => ['required', 'email:rfc', 'max:255', Rule::unique('accounts', 'email')->ignore($account?->id)],
            'password' => ['nullable', 'string', 'max:255'],
            'twofa_url' => ['nullable', 'url:https,http', 'max:500'],
            'invite_links' => ['nullable', 'array', 'max:'.Account::capacity()],
            'invite_links.*.url' => ['nullable', 'url:https,http', 'max:500'],
            'invite_links.*.expires_on' => ['nullable', 'date_format:Y-m-d'],
            'started_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.Hoy::carbon()->addDay()->toDateString()],
            'expires_on' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:started_on'],
            'notes' => ['nullable', 'string', 'max:500'],
            // Hoy se acepta para no trabar el guardado el mismo día en que se libera (ese día ya cuenta como libre).
            'google_bloqueo_hasta' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:'.Hoy::fecha()],
        ], ['email.unique' => 'Esa cuenta ya está registrada.', 'google_bloqueo_hasta.after_or_equal' => 'Pon una fecha de hoy en adelante; si Google ya deja invitar, quita el bloqueo.'], ['google_bloqueo_hasta' => 'fecha en que se liberan las invitaciones', 'email' => 'correo de la cuenta', 'password' => 'contraseña de la cuenta', 'twofa_url' => 'liga de 2FA', 'invite_links.*.url' => 'liga de invitación', 'invite_links.*.expires_on' => 'caducidad de la liga', 'started_on' => 'fecha de inicio', 'expires_on' => 'fecha de vencimiento', 'notes' => 'notas']);
    }
}
