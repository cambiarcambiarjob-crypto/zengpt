<?php

namespace App\Services;

use App\Models\AdSpend;
use App\Models\Seller;
use App\Models\Slot;
use App\Support\Reparto;
use Illuminate\Support\Carbon;

/**
 * Solo cuentan los clientes que ya pagaron, en la fecha en que pagaron (paid_on). También suma ChatGPT (App\Services\Chatgpt):
 * sus ventas en la fecha del corte y el pago fijo de cada día 6 como costo de su vendedor.
 * Cifras del negocio entre dos fechas (ambas incluidas, formato Y-m-d): ventas, publicidad y reparto
 * por vendedor, y la serie por día. Las fechas se comparan con whereDate para que funcione igual en
 * SQLite (pruebas) y MySQL (producción).
 */
class Resumen
{
    /**
     * @return array{filas: list<array<string, mixed>>, totales: array<string, int>}
     */
    public static function porVendedor(string $desde, string $hasta): array
    {
        $ventas = Slot::query()
            ->whereNotNull('paid_on')->whereDate('paid_on', '>=', $desde)->whereDate('paid_on', '<=', $hasta)
            ->selectRaw('seller_id, COUNT(*) as n, SUM(price_cents) as total, SUM(cost_cents) as costo')
            ->groupBy('seller_id')->get()->keyBy('seller_id');

        $publicidad = AdSpend::query()
            ->whereDate('spent_on', '>=', $desde)->whereDate('spent_on', '<=', $hasta)
            ->selectRaw('seller_id, SUM(amount_cents) as total')
            ->groupBy('seller_id')->pluck('total', 'seller_id');

        $chatgpt = Chatgpt::porVendedor($desde, $hasta);

        $filas = [];
        $totales = ['ventas_count' => 0, 'ventas' => 0, 'publicidad' => 0, 'costo' => 0, 'neto' => 0, 'socio' => 0, 'vendedor' => 0, 'dueno' => 0];

        foreach (Seller::query()->ordered()->get() as $seller) {
            $n = (int) ($ventas[$seller->id]->n ?? 0) + ($chatgpt[$seller->id]['ventas_count'] ?? 0);
            $v = (int) ($ventas[$seller->id]->total ?? 0) + ($chatgpt[$seller->id]['ventas'] ?? 0);
            $p = (int) ($publicidad[$seller->id] ?? 0);
            $c = (int) ($ventas[$seller->id]->costo ?? 0) + ($chatgpt[$seller->id]['costo'] ?? 0);

            // Un vendedor dado de baja solo aparece si tuvo movimiento en el periodo.
            if (! $seller->active && $n === 0 && $p === 0 && $c === 0) {
                continue;
            }

            $fila = ['seller_id' => $seller->id, 'name' => $seller->name, 'is_owner' => $seller->is_owner, 'ventas_count' => $n]
                + Reparto::calcular($v, $p, $seller->is_owner, $c);
            $filas[] = $fila;

            foreach ($totales as $clave => $_) {
                $totales[$clave] += (int) $fila[$clave];
            }
        }

        return ['filas' => $filas, 'totales' => $totales];
    }

    /** Totales del periodo (lo mismo que porVendedor()['totales']). */
    public static function totales(string $desde, string $hasta): array
    {
        return self::porVendedor($desde, $hasta)['totales'];
    }

    /**
     * Ventas, publicidad, costo de cuentas y neto por día, con los días sin movimiento en cero.
     *
     * @return list<array{fecha: string, ventas_count: int, ventas: int, publicidad: int, costo: int, neto: int}>
     */
    public static function serieDiaria(string $desde, string $hasta): array
    {
        $dias = [];
        for ($d = Carbon::parse($desde); $d->toDateString() <= $hasta; $d->addDay()) {
            $dias[$d->toDateString()] = ['fecha' => $d->toDateString(), 'ventas_count' => 0, 'ventas' => 0, 'publicidad' => 0, 'costo' => 0, 'neto' => 0];
        }

        Slot::query()->whereNotNull('paid_on')->whereDate('paid_on', '>=', $desde)->whereDate('paid_on', '<=', $hasta)
            ->get(['paid_on', 'price_cents', 'cost_cents'])
            ->each(function (Slot $slot) use (&$dias): void {
                $f = $slot->paid_on->toDateString();
                if (isset($dias[$f])) {
                    $dias[$f]['ventas_count']++;
                    $dias[$f]['ventas'] += $slot->price_cents;
                    $dias[$f]['costo'] += $slot->cost_cents;
                }
            });

        AdSpend::query()->whereDate('spent_on', '>=', $desde)->whereDate('spent_on', '<=', $hasta)
            ->get(['spent_on', 'amount_cents'])
            ->each(function (AdSpend $gasto) use (&$dias): void {
                $f = $gasto->spent_on->toDateString();
                if (isset($dias[$f])) {
                    $dias[$f]['publicidad'] += $gasto->amount_cents;
                }
            });

        foreach (Chatgpt::porDia($desde, $hasta) as $f => $vendedores) {
            foreach ($vendedores as $mov) {
                if (isset($dias[$f])) {
                    $dias[$f]['ventas_count'] += $mov['ventas_count'];
                    $dias[$f]['ventas'] += $mov['ventas'];
                    $dias[$f]['costo'] += $mov['costo'];
                }
            }
        }

        foreach ($dias as $f => $d) {
            $dias[$f]['neto'] = $d['ventas'] - $d['publicidad'] - $d['costo'];
        }

        return array_values($dias);
    }
}
