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
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class AccountController extends Controller
{
    public function index(Request $request): Response
    {
        $estado = in_array($request->query('estado'), ['activas', 'llenas', 'vencidas', 'todas', 'con_espacio', 'por_cobrar'], true) ? $request->query('estado') : 'activas';
        $q = trim((string) $request->query('q'));

        $cuentas = Account::query()
            ->with('slots.seller')
            ->when(in_array($estado, ['activas', 'llenas', 'con_espacio'], true), fn ($query) => $query->active())
            ->when($estado === 'vencidas', fn ($query) => $query->expired())
            ->when($estado === 'por_cobrar', fn ($query) => $query->whereHas('slots', fn ($s) => $s->whereNull('paid_on')))
            ->when($q !== '', fn ($query) => $query->where(fn ($w) => $w
                ->where('email', 'like', "%{$q}%")
                ->orWhereHas('slots', fn ($s) => $s->where('client_email', 'like', "%{$q}%")->orWhere('client_phone', 'like', "%{$q}%"))))
            ->orderByDesc('started_on')->orderByDesc('id')
            ->get()
            ->when($estado === 'con_espacio', fn ($c) => $c->filter(fn (Account $a): bool => $a->slots->count() < Account::capacity()))
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
        ]);
        $cuenta->syncInviteLinks();

        return back()->with('success', 'Cuenta agregada.');
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

        $account->syncInviteLinks();

        return back()->with('success', 'Cuenta actualizada.');
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
        ], ['email.unique' => 'Esa cuenta ya está registrada.'], ['email' => 'correo de la cuenta', 'password' => 'contraseña de la cuenta', 'twofa_url' => 'liga de 2FA', 'invite_links.*.url' => 'liga de invitación', 'invite_links.*.expires_on' => 'caducidad de la liga', 'started_on' => 'fecha de inicio', 'expires_on' => 'fecha de vencimiento', 'notes' => 'notas']);
    }
}
