<?php

namespace App\Services;

use App\Models\AdSpend;
use App\Models\PartnerPayout;
use App\Models\Slot;
use App\Support\Hoy;
use App\Support\Reparto;
use Illuminate\Support\Carbon;

/**
 * Lo que el dueño le debe al socio: su porcentaje del neto de TODAS las ventas (App\Support\Reparto, vendedor por
 * vendedor), acumulado desde el inicio, menos lo que ya se le pagó. Mismo criterio que PagosVendedor: un pago parcial
 * o una venta/publicidad capturada después del pago se arrastran solos al siguiente (se ven como «ajuste»).
 */
final class PagosSocio
{
    private const INICIO = '2000-01-01';

    private const CEROS = ['ventas' => 0, 'costo' => 0, 'publicidad' => 0];

    /** Parte del socio acumulada hasta `hasta` (incluido). */
    public static function parte(string $hasta): int
    {
        return self::socioDe(self::sumasPorVendedor(self::INICIO, $hasta));
    }

    public static function ultimo(): ?PartnerPayout
    {
        return PartnerPayout::query()->orderByDesc('hasta')->first();
    }

    public static function pagado(): int
    {
        return (int) PartnerPayout::query()->sum('amount_cents');
    }

    /** Lo que se le debe por todo lo acumulado hasta `hasta` (incluido): su parte histórica − lo ya pagado. */
    public static function porPagarHasta(string $hasta): int
    {
        return self::parte($hasta) - self::pagado();
    }

    /**
     * Mismo formato que PagosVendedor::estado(): pendiente, desde (primer día sin pagar), ajuste, último pago y los
     * cortes (cuánto se le debería si se le paga hasta cada día con movimiento sin pagar).
     *
     * @return array{pendiente: int, desde: ?string, ajuste: int, ultimo: ?array{hasta: string, paid_on: string, amount_cents: int}, cortes: list<array{fecha: string, por_pagar: int}>}
     */
    public static function estado(): array
    {
        $hoy = Hoy::fecha();
        $ultimo = self::ultimo();
        $pagado = self::pagado();

        // Lo acumulado (por vendedor) hasta el último pago, y día por día desde entonces: la parte del socio se calcula
        // sobre lo acumulado de cada vendedor, igual que en Reportes, para que los centavos cuadren exacto.
        $acumulado = $ultimo ? self::sumasPorVendedor(self::INICIO, $ultimo->hasta->toDateString()) : [];
        $ajuste = $ultimo ? self::socioDe($acumulado) - $pagado : 0;
        $inicio = $ultimo ? $ultimo->hasta->copy()->addDay()->toDateString() : self::INICIO;
        $dias = $inicio <= $hoy ? self::porDia($inicio, $hoy) : [];

        $cortes = [];
        foreach ($dias as $fecha => $vendedores) {
            foreach ($vendedores as $id => $sumas) {
                $acumulado[$id] ??= self::CEROS;
                foreach ($sumas as $clave => $valor) {
                    $acumulado[$id][$clave] += $valor;
                }
            }
            $cortes[] = ['fecha' => $fecha, 'por_pagar' => self::socioDe($acumulado) - $pagado];
        }

        return [
            'pendiente' => $cortes !== [] ? end($cortes)['por_pagar'] : $ajuste,
            'desde' => $ultimo ? $inicio : (array_key_first($dias) ?? null),
            'ajuste' => $ajuste,
            'ultimo' => $ultimo ? ['hasta' => $ultimo->hasta->toDateString(), 'paid_on' => $ultimo->paid_on->toDateString(), 'amount_cents' => $ultimo->amount_cents] : null,
            'cortes' => $cortes,
        ];
    }

    /**
     * Historial de pagos al socio, del más reciente al más viejo, con el tramo que cubre cada uno.
     *
     * @return list<array{id: int, desde: ?string, hasta: string, paid_on: string, amount_cents: int, notes: ?string, registrado_por: ?string, puede_borrar: bool}>
     */
    public static function historial(): array
    {
        $pagos = PartnerPayout::query()->with('autor:id,name')->orderBy('hasta')->get();
        $filas = [];
        $anterior = null;

        foreach ($pagos as $i => $pago) {
            $filas[] = [
                'id' => $pago->id,
                'desde' => $anterior ? Carbon::parse($anterior)->addDay()->toDateString() : null,
                'hasta' => $pago->hasta->toDateString(),
                'paid_on' => $pago->paid_on->toDateString(),
                'amount_cents' => $pago->amount_cents,
                'notes' => $pago->notes,
                'registrado_por' => $pago->autor?->name,
                // Solo se deshace el último: los anteriores ya tienen otro pago encima.
                'puede_borrar' => $i === $pagos->count() - 1,
            ];
            $anterior = $pago->hasta->toDateString();
        }

        return array_reverse($filas);
    }

    /** @param  array<int, array{ventas: int, costo: int, publicidad: int}>  $porVendedor */
    private static function socioDe(array $porVendedor): int
    {
        $socio = 0;
        foreach ($porVendedor as $sumas) {
            // La parte del socio no depende de quién vendió (dueño o vendedor): siempre su porcentaje del neto.
            $socio += Reparto::calcular($sumas['ventas'], $sumas['publicidad'], false, $sumas['costo'])['socio'];
        }

        return $socio;
    }

    /** @return array<int, array{ventas: int, costo: int, publicidad: int}> ventas pagadas, costo y publicidad por vendedor */
    private static function sumasPorVendedor(string $desde, string $hasta): array
    {
        $sumas = [];

        Slot::query()->whereNotNull('seller_id')->whereNotNull('paid_on')->whereDate('paid_on', '>=', $desde)->whereDate('paid_on', '<=', $hasta)
            ->selectRaw('seller_id, COALESCE(SUM(price_cents), 0) as total, COALESCE(SUM(cost_cents), 0) as costo')
            ->groupBy('seller_id')->get()
            ->each(function (Slot $fila) use (&$sumas): void {
                $sumas[(int) $fila->seller_id] = ['ventas' => (int) $fila->total, 'costo' => (int) $fila->costo, 'publicidad' => 0];
            });

        AdSpend::query()->whereNotNull('seller_id')->whereDate('spent_on', '>=', $desde)->whereDate('spent_on', '<=', $hasta)
            ->selectRaw('seller_id, COALESCE(SUM(amount_cents), 0) as total')->groupBy('seller_id')->get()
            ->each(function (AdSpend $fila) use (&$sumas): void {
                $sumas[(int) $fila->seller_id] ??= self::CEROS;
                $sumas[(int) $fila->seller_id]['publicidad'] = (int) $fila->total;
            });

        return $sumas;
    }

    /** @return array<string, array<int, array{ventas: int, costo: int, publicidad: int}>> movimiento por día y vendedor, en orden */
    private static function porDia(string $desde, string $hasta): array
    {
        $dias = [];

        Slot::query()->whereNotNull('seller_id')->whereNotNull('paid_on')->whereDate('paid_on', '>=', $desde)->whereDate('paid_on', '<=', $hasta)
            ->get(['paid_on', 'seller_id', 'price_cents', 'cost_cents'])
            ->each(function (Slot $slot) use (&$dias): void {
                $f = $slot->paid_on->toDateString();
                $dias[$f][(int) $slot->seller_id] ??= self::CEROS;
                $dias[$f][(int) $slot->seller_id]['ventas'] += $slot->price_cents;
                $dias[$f][(int) $slot->seller_id]['costo'] += $slot->cost_cents;
            });

        AdSpend::query()->whereNotNull('seller_id')->whereDate('spent_on', '>=', $desde)->whereDate('spent_on', '<=', $hasta)
            ->get(['spent_on', 'seller_id', 'amount_cents'])
            ->each(function (AdSpend $gasto) use (&$dias): void {
                $f = $gasto->spent_on->toDateString();
                $dias[$f][(int) $gasto->seller_id] ??= self::CEROS;
                $dias[$f][(int) $gasto->seller_id]['publicidad'] += $gasto->amount_cents;
            });

        ksort($dias);

        return $dias;
    }
}
