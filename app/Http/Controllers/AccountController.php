<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\Seller;
use App\Support\Hoy;
use App\Support\Presentar;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AccountController extends Controller
{
    public function index(Request $request): Response
    {
        $estado = in_array($request->query('estado'), ['activas', 'vencidas', 'todas', 'con_espacio'], true) ? $request->query('estado') : 'activas';
        $q = trim((string) $request->query('q'));

        $cuentas = Account::query()
            ->with('slots.seller')
            ->when($estado === 'activas' || $estado === 'con_espacio', fn ($query) => $query->active())
            ->when($estado === 'vencidas', fn ($query) => $query->expired())
            ->when($q !== '', fn ($query) => $query->where(fn ($w) => $w
                ->where('email', 'like', "%{$q}%")
                ->orWhereHas('slots', fn ($s) => $s->where('client_email', 'like', "%{$q}%")->orWhere('client_phone', 'like', "%{$q}%"))))
            ->orderByDesc('started_on')->orderByDesc('id')
            ->get()
            ->when($estado === 'con_espacio', fn ($c) => $c->filter(fn (Account $a): bool => $a->slots->count() < Account::capacity()))
            ->map(fn (Account $a): array => Presentar::cuenta($a))->values()->all();

        return Inertia::render('Cuentas/Index', [
            'cuentas' => $cuentas,
            'filtros' => ['estado' => $estado, 'q' => $q],
            'vendedores' => Seller::query()->where('active', true)->ordered()->get(['id', 'name', 'is_owner']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        $inicio = Carbon::parse($data['started_on']);

        Account::query()->create([
            'email' => $data['email'],
            'started_on' => $inicio->toDateString(),
            'expires_on' => $inicio->copy()->addMonthsNoOverflow((int) config('zengpt.meses_cuenta'))->toDateString(),
            'notes' => $data['notes'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        return back()->with('success', 'Cuenta agregada.');
    }

    public function update(Request $request, Account $account): RedirectResponse
    {
        $data = $this->validated($request, $account);
        $inicio = Carbon::parse($data['started_on']);

        $account->update([
            'email' => $data['email'],
            'started_on' => $inicio->toDateString(),
            // La vigencia se recalcula desde el inicio salvo que el administrador fije otra fecha.
            'expires_on' => $request->user()->isAdmin() && filled($data['expires_on'] ?? null)
                ? Carbon::parse($data['expires_on'])->toDateString()
                : $inicio->copy()->addMonthsNoOverflow((int) config('zengpt.meses_cuenta'))->toDateString(),
            'notes' => $data['notes'] ?? null,
        ]);

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

    /** @return array<string, mixed> */
    private function validated(Request $request, ?Account $account = null): array
    {
        $request->merge(['email' => mb_strtolower(trim((string) $request->input('email')))]);

        return $request->validate([
            'email' => ['required', 'email:rfc', 'max:255', Rule::unique('accounts', 'email')->ignore($account?->id)],
            'started_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.Hoy::carbon()->addDay()->toDateString()],
            'expires_on' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:started_on'],
            'notes' => ['nullable', 'string', 'max:500'],
        ], ['email.unique' => 'Esa cuenta ya está registrada.'], ['email' => 'correo de la cuenta', 'started_on' => 'fecha de inicio', 'expires_on' => 'fecha de vencimiento', 'notes' => 'notas']);
    }
}
