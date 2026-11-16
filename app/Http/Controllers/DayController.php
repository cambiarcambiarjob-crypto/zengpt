<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\AdSpend;
use App\Models\Seller;
use App\Models\Slot;
use App\Services\Resumen;
use App\Support\Hoy;
use App\Support\Presentar;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class DayController extends Controller
{
    public function show(Request $request, ?string $fecha = null): Response
    {
        $fecha = self::fecha($fecha);
        $dia = Carbon::parse($fecha);

        $gastos = AdSpend::query()->whereDate('spent_on', $fecha)->pluck('amount_cents', 'seller_id');

        return Inertia::render('Dia/Show', [
            'fecha' => $fecha,
            'anterior' => $dia->copy()->subDay()->toDateString(),
            'siguiente' => $fecha < Hoy::fecha() ? $dia->copy()->addDay()->toDateString() : null,
            'esHoy' => $fecha === Hoy::fecha(),
            'ventas' => Slot::query()->with(['account', 'seller'])->whereDate('sold_on', $fecha)->orderBy('id')->get()
                ->map(fn (Slot $s): array => Presentar::espacio($s))->all(),
            'publicidad' => Seller::query()->ordered()->get()
                ->filter(fn (Seller $s): bool => $s->active || isset($gastos[$s->id]))
                ->map(fn (Seller $s): array => ['seller_id' => $s->id, 'name' => $s->name, 'amount_cents' => (int) ($gastos[$s->id] ?? 0)])->values()->all(),
            'reparto' => Resumen::porVendedor($fecha, $fecha),
            'puedeEditarPublicidad' => $request->user()->isAdmin(),
            'vendedores' => Seller::query()->where('active', true)->ordered()->get(['id', 'name', 'is_owner']),
            'conEspacio' => Account::query()->active()->with('slots.seller')->orderBy('expires_on')->get()
                ->filter(fn (Account $a): bool => $a->slots->count() < Account::capacity())
                ->map(fn (Account $a): array => Presentar::cuenta($a))->values()->all(),
        ]);
    }

    /** Publicidad del día por vendedor, en pesos. Solo el administrador (ruta con middleware admin). */
    public function publicidad(Request $request, string $fecha): RedirectResponse
    {
        $fecha = self::fecha($fecha);

        $data = $request->validate([
            'gastos' => ['required', 'array'],
            'gastos.*' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
        ], [], ['gastos.*' => 'publicidad']);

        $vendedores = Seller::query()->pluck('id')->all();

        foreach ($data['gastos'] as $sellerId => $pesos) {
            if (! in_array((int) $sellerId, $vendedores, true)) {
                continue;
            }

            $cents = (int) round(((float) ($pesos ?? 0)) * 100);
            $actual = AdSpend::query()->whereDate('spent_on', $fecha)->where('seller_id', (int) $sellerId)->first();

            if ($cents === 0) {
                $actual?->delete();

                continue;
            }

            $actual
                ? $actual->update(['amount_cents' => $cents, 'updated_by' => $request->user()->id])
                : AdSpend::query()->create(['spent_on' => $fecha, 'seller_id' => (int) $sellerId, 'amount_cents' => $cents, 'updated_by' => $request->user()->id]);
        }

        return back()->with('success', 'Publicidad del día guardada.');
    }

    /** Fecha válida (Y-m-d) no posterior a hoy; por defecto, hoy. */
    private static function fecha(?string $fecha): string
    {
        if ($fecha === null || preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha) !== 1 || ! checkdate((int) substr($fecha, 5, 2), (int) substr($fecha, 8, 2), (int) substr($fecha, 0, 4))) {
            return Hoy::fecha();
        }

        return min($fecha, Hoy::fecha());
    }
}
