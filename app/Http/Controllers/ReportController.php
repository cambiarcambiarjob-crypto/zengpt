<?php

namespace App\Http\Controllers;

use App\Models\Seller;
use App\Services\PagosVendedor;
use App\Services\Resumen;
use App\Support\Hoy;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $hoy = Hoy::carbon();
        $valida = fn ($v): bool => is_string($v) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) === 1 && strtotime($v) !== false;

        $desde = $valida($request->query('desde')) ? $request->query('desde') : $hoy->copy()->startOfMonth()->toDateString();
        $hasta = $valida($request->query('hasta')) ? $request->query('hasta') : $hoy->toDateString();

        if ($desde > $hasta) {
            [$desde, $hasta] = [$hasta, $desde];
        }

        // La serie por día se limita a un año para no mandar miles de filas.
        $inicioSerie = max($desde, Carbon::parse($hasta)->subDays(365)->toDateString());
        $resumen = Resumen::porVendedor($desde, $hasta);

        return Inertia::render('Reportes/Index', [
            'desde' => $desde,
            'hasta' => $hasta,
            'filas' => $resumen['filas'],
            'totales' => $resumen['totales'],
            'serie' => Resumen::serieDiaria($inicioSerie, $hasta),
            // Lo que se le debe hoy a cada vendedor (no depende del periodo elegido). Los dados de baja solo si se les debe algo.
            'pagos' => Seller::query()->ordered()->where('is_owner', false)->get()
                ->map(fn (Seller $s): array => ['seller_id' => $s->id, 'name' => $s->name, 'active' => $s->active] + Arr::except(PagosVendedor::estado($s), ['cortes']))
                ->filter(fn (array $p): bool => $p['active'] || $p['pendiente'] !== 0)->values()->all(),
        ]);
    }
}
