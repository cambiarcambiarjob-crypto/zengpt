<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\Slot;
use App\Services\Resumen;
use App\Support\Hoy;
use App\Support\Presentar;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(): Response
    {
        $hoy = Hoy::carbon();
        $fecha = $hoy->toDateString();
        $inicioMes = $hoy->copy()->startOfMonth()->toDateString();
        $inicioSerie = $hoy->copy()->subDays(29)->toDateString();

        $activas = Account::query()->active()->with('slots.seller')->orderBy('expires_on')->get();
        $ocupados = $activas->sum(fn (Account $a): int => $a->slots->count());
        $capacidadTotal = $activas->count() * Account::capacity();

        return Inertia::render('Dashboard', [
            'hoy' => ['fecha' => $fecha] + Resumen::totales($fecha, $fecha),
            'mes' => ['desde' => $inicioMes, 'hasta' => $fecha] + Resumen::totales($inicioMes, $fecha),
            'historico' => Resumen::totales('2000-01-01', '2999-12-31'),
            'porVendedorMes' => Resumen::porVendedor($inicioMes, $fecha)['filas'],
            'serie' => Resumen::serieDiaria($inicioSerie, $fecha),
            'cuentas' => [
                'activas' => $activas->count(),
                'vencidas' => Account::query()->expired()->count(),
                'espacios_ocupados' => $ocupados,
                'espacios_libres' => $capacidadTotal - $ocupados,
                'capacidad_total' => $capacidadTotal,
                'clientes' => Slot::query()->count(),
            ],
            // Cuentas vigentes con lugar: «las opciones que tengo» para acomodar al siguiente cliente.
            'conEspacio' => $activas->filter(fn (Account $a): bool => $a->slots->count() < Account::capacity())
                ->map(fn (Account $a): array => Presentar::cuenta($a))->values()->all(),
            'porVencer' => $activas->filter(fn (Account $a): bool => $a->daysLeft() <= (int) config('zengpt.dias_aviso'))
                ->map(fn (Account $a): array => Presentar::cuenta($a))->values()->all(),
        ]);
    }
}
