<?php

namespace App\Services;

use App\Models\AdSpend;
use App\Models\Seller;
use App\Models\SellerPayout;
use App\Models\Slot;
use App\Support\Hoy;
use App\Support\Reparto;
use Illuminate\Support\Carbon;

/**
 * Métricas de UN vendedor y lo que el dueño le debe.
 *
 * Su parte sale de App\Support\Reparto (ventas pagadas en su fecha de pago − su publicidad − costo de sus espacios;
 * 10 % al socio y del resto, la mitad para él). Lo que se le debe es SIEMPRE su parte acumulada desde el inicio menos
 * todo lo que ya se le pagó: un pago parcial, una venta que se marca pagada con fecha atrasada o publicidad capturada
 * tarde se arrastran solos al siguiente pago (se ven como «ajuste»). Al dueño no se le registran pagos.
 */
final class PagosVendedor
{
    private const INICIO = '2000-01-01';

    private const CEROS = ['ventas_count' => 0, 'ventas' => 0, 'costo' => 0, 'publicidad' => 0];

    /**
     * Ventas (por fecha de pago), costo de sus espacios y publicidad del vendedor entre dos fechas (incluidas).
     *
     * @return array{ventas_count: int, ventas: int, costo: int, publicidad: int}
     */
    public static function sumas(Seller $seller, string $desde, string $hasta): array
    {
        $ventas = Slot::query()->where('seller_id', $seller->id)->whereNotNull('paid_on')
            ->whereDate('paid_on', '>=', $desde)->whereDate('paid_on', '<=', $hasta)
            ->selectRaw('COUNT(*) as n, COALESCE(SUM(price_cents), 0) as total, COALESCE(SUM(cost_cents), 0) as costo')->first();

        // ChatGPT: sus ventas y el pago de cada día 6 (si este vendedor es el de ChatGPT).
        $chatgpt = Chatgpt::porVendedor($desde, $hasta)[$seller->id] ?? ['ventas_count' => 0, 'ventas' => 0, 'costo' => 0];

        return [
            'ventas_count' => (int) ($ventas->n ?? 0) + $chatgpt['ventas_count'],
            'ventas' => (int) ($ventas->total ?? 0) + $chatgpt['ventas'],
            'costo' => (int) ($ventas->costo ?? 0) + $chatgpt['costo'],
            'publicidad' => (int) AdSpend::query()->where('seller_id', $seller->id)
                ->whereDate('spent_on', '>=', $desde)->whereDate('spent_on', '<=', $hasta)->sum('amount_cents'),
        ];
    }

    /**
     * Reparto de unas sumas, más `parte`: lo que le toca a ese vendedor (al dueño, la parte del dueño).
     *
     * @param  array{ventas_count: int, ventas: int, costo: int, publicidad: int}  $sumas
     * @return array{ventas_count: int, ventas: int, publicidad: int, costo: int, neto: int, socio: int, vendedor: int, dueno: int, parte: int}
     */
    public static function reparto(Seller $seller, array $sumas): array
    {
        $r = Reparto::calcular($sumas['ventas'], $sumas['publicidad'], $seller->is_owner, $sumas['costo']);

        return ['ventas_count' => $sumas['ventas_count']] + $r + ['parte' => $seller->is_owner ? $r['dueno'] : $r['vendedor']];
    }

    /**
     * Días con movimiento (ventas o publicidad) entre dos fechas, en orden.
     *
     * @return array<string, array{ventas_count: int, ventas: int, costo: int, publicidad: int}>
     */
    public static function porDia(Seller $seller, string $desde, string $hasta): array
    {
        $dias = [];

        Slot::query()->where('seller_id', $seller->id)->whereNotNull('paid_on')
            ->whereDate('paid_on', '>=', $desde)->whereDate('paid_on', '<=', $hasta)
            ->get(['paid_on', 'price_cents', 'cost_cents'])
            ->each(function (Slot $slot) use (&$dias): void {
                $f = $slot->paid_on->toDateString();
                $dias[$f] ??= self::CEROS;
                $dias[$f]['ventas_count']++;
                $dias[$f]['ventas'] += $slot->price_cents;
                $dias[$f]['costo'] += $slot->cost_cents;
            });

        AdSpend::query()->where('seller_id', $seller->id)
            ->whereDate('spent_on', '>=', $desde)->whereDate('spent_on', '<=', $hasta)
            ->get(['spent_on', 'amount_cents'])
            ->each(function (AdSpend $gasto) use (&$dias): void {
                $f = $gasto->spent_on->toDateString();
                $dias[$f] ??= self::CEROS;
                $dias[$f]['publicidad'] += $gasto->amount_cents;
            });

        foreach (Chatgpt::porDia($desde, $hasta, $seller->id) as $f => $vendedores) {
            foreach ($vendedores as $mov) {
                $dias[$f] ??= self::CEROS;
                $dias[$f]['ventas_count'] += $mov['ventas_count'];
                $dias[$f]['ventas'] += $mov['ventas'];
                $dias[$f]['costo'] += $mov['costo'];
            }
        }

        ksort($dias);

        return $dias;
    }

    public static function ultimo(Seller $seller): ?SellerPayout
    {
        return SellerPayout::query()->where('seller_id', $seller->id)->orderByDesc('hasta')->first();
    }

    public static function pagado(Seller $seller): int
    {
        return (int) SellerPayout::query()->where('seller_id', $seller->id)->sum('amount_cents');
    }

    /** Lo que se le debe por todo lo acumulado hasta `hasta` (incluido): su parte histórica − lo ya pagado. */
    public static function porPagarHasta(Seller $seller, string $hasta): int
    {
        return self::reparto($seller, self::sumas($seller, self::INICIO, $hasta))['parte'] - self::pagado($seller);
    }

    /**
     * Estado de pago del vendedor hoy (null para el dueño):
     *   pendiente → lo que se le debe hoy;
     *   desde     → primer día sin pagar (el siguiente al último pago, o su primer movimiento);
     *   ajuste    → cambios en días ya pagados (ventas o publicidad capturadas después del pago), ya incluido en pendiente;
     *   cortes    → cuánto se le debería si se le paga hasta cada día con movimiento sin pagar (para «pagar hasta…»).
     *
     * @return array{pendiente: int, desde: ?string, ajuste: int, ultimo: ?array{hasta: string, paid_on: string, amount_cents: int}, cortes: list<array{fecha: string, por_pagar: int}>}|null
     */
    public static function estado(Seller $seller): ?array
    {
        if ($seller->is_owner) {
            return null;
        }

        $hoy = Hoy::fecha();
        $ultimo = self::ultimo($seller);
        $pagado = self::pagado($seller);

        // Lo acumulado hasta el día del último pago, y día por día desde entonces (las partes se calculan sobre lo
        // acumulado, igual que porPagarHasta(), para que los centavos cuadren exacto).
        $acumulado = $ultimo ? self::sumas($seller, self::INICIO, $ultimo->hasta->toDateString()) : self::CEROS;
        $ajuste = $ultimo ? self::reparto($seller, $acumulado)['parte'] - $pagado : 0;
        $inicio = $ultimo ? $ultimo->hasta->copy()->addDay()->toDateString() : self::INICIO;
        $dias = $inicio <= $hoy ? self::porDia($seller, $inicio, $hoy) : [];

        $cortes = [];
        foreach ($dias as $fecha => $dia) {
            foreach ($acumulado as $clave => $valor) {
                $acumulado[$clave] = $valor + $dia[$clave];
            }
            $cortes[] = ['fecha' => $fecha, 'por_pagar' => self::reparto($seller, $acumulado)['parte'] - $pagado];
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
     * Días del periodo con movimiento, cada uno con su reparto y el pago que lo cubre (si ya se pagó).
     *
     * @return list<array<string, mixed>>
     */
    public static function dias(Seller $seller, string $desde, string $hasta): array
    {
        $pagos = $seller->is_owner ? collect() : SellerPayout::query()->where('seller_id', $seller->id)->orderBy('hasta')->get();
        $filas = [];

        foreach (self::porDia($seller, $desde, $hasta) as $fecha => $sumas) {
            $pago = $pagos->first(fn (SellerPayout $p): bool => $p->hasta->toDateString() >= $fecha);
            $filas[] = ['fecha' => $fecha] + self::reparto($seller, $sumas)
                + ['pago' => $pago ? ['id' => $pago->id, 'paid_on' => $pago->paid_on->toDateString()] : null];
        }

        return $filas;
    }

    /**
     * Historial de pagos, del más reciente al más viejo, con el tramo que cubre cada uno.
     *
     * @return list<array{id: int, desde: ?string, hasta: string, paid_on: string, amount_cents: int, notes: ?string, registrado_por: ?string, puede_borrar: bool}>
     */
    public static function historial(Seller $seller): array
    {
        $pagos = SellerPayout::query()->with('autor:id,name')->where('seller_id', $seller->id)->orderBy('hasta')->get();
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
}
