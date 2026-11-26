<?php

namespace App\Services;

use App\Models\ChatgptSale;
use App\Models\Seller;
use App\Support\Hoy;
use Illuminate\Support\Carbon;

/**
 * ChatGPT de Jorge, para el reparto: las ventas anotadas en cada corte (cantidad × precio, en la fecha del corte) y el
 * pago fijo de cada día 6 ($400, sin importar cuántos se vendan), que es su costo. Ese pago se le carga al vendedor de
 * ChatGPT el día 6, igual que el costo de las cuentas en Gemini: neto = ventas − publicidad − costo.
 *
 * Los pagos van desde el primer día 6 (config zengpt.chatgpt.desde o, si está vacío, el día 6 del periodo de la primera
 * venta anotada) hasta hoy: un día 6 que todavía no llega no cuenta.
 */
final class Chatgpt
{
    private const CEROS = ['ventas_count' => 0, 'ventas' => 0, 'costo' => 0];

    /** El vendedor de ChatGPT (por nombre, config zengpt.chatgpt.vendedor), o null si no existe. */
    public static function vendedor(): ?Seller
    {
        $nombre = mb_strtolower(trim((string) config('zengpt.chatgpt.vendedor', 'Jorge')));

        return Seller::query()->get()->first(fn (Seller $s): bool => mb_strtolower(trim($s->name)) === $nombre);
    }

    public static function precio(): int
    {
        return (int) round(((float) config('zengpt.chatgpt.precio', 450)) * 100);
    }

    public static function costoMensual(): int
    {
        return (int) round(((float) config('zengpt.chatgpt.costo_mensual', 400)) * 100);
    }

    public static function diaPago(): int
    {
        return max(1, min(28, (int) config('zengpt.chatgpt.dia_pago', 6)));
    }

    /** Primer día de pago (Y-m-d), o null si no hay fecha configurada ni ventas anotadas. */
    public static function primerPago(): ?string
    {
        $configurado = config('zengpt.chatgpt.desde');
        if (filled($configurado)) {
            return Carbon::parse($configurado)->toDateString();
        }

        $primera = ChatgptSale::query()->min('sold_on');
        if ($primera === null) {
            return null;
        }

        // El periodo que se paga el día 6 va del 6 al 5 del mes siguiente: la primera venta cae en el de ese día 6.
        $venta = Carbon::parse($primera);
        $pago = $venta->copy()->day(self::diaPago());

        return ($venta->day >= self::diaPago() ? $pago : $pago->subMonthNoOverflow())->toDateString();
    }

    /**
     * Días de pago entre dos fechas (incluidas), desde el primero y sin pasar de hoy.
     *
     * @return list<string>
     */
    public static function pagos(string $desde, string $hasta): array
    {
        $primero = self::primerPago();
        if ($primero === null) {
            return [];
        }

        $tope = min($hasta, Hoy::fecha());
        $fechas = [];
        for ($d = Carbon::parse($primero); $d->toDateString() <= $tope; $d = $d->copy()->addMonthNoOverflow()->day(self::diaPago())) {
            if ($d->toDateString() >= $desde) {
                $fechas[] = $d->toDateString();
            }
        }

        return $fechas;
    }

    /** El siguiente día de pago a partir de hoy (hoy incluido). */
    public static function siguientePago(): string
    {
        $hoy = Hoy::carbon();
        $pago = $hoy->copy()->day(self::diaPago());

        return ($hoy->day <= self::diaPago() ? $pago : $pago->addMonthNoOverflow()->day(self::diaPago()))->toDateString();
    }

    /**
     * Movimiento de ChatGPT por día y vendedor (solo días con algo), en orden: ventas del corte y el pago del día 6.
     *
     * @return array<string, array<int, array{ventas_count: int, ventas: int, costo: int}>>
     */
    public static function porDia(string $desde, string $hasta, ?int $sellerId = null): array
    {
        $dias = [];

        ChatgptSale::query()->whereNotNull('seller_id')
            ->whereDate('sold_on', '>=', $desde)->whereDate('sold_on', '<=', $hasta)
            ->when($sellerId !== null, fn ($q) => $q->where('seller_id', $sellerId))
            ->get(['sold_on', 'seller_id', 'quantity', 'price_cents'])
            ->each(function (ChatgptSale $venta) use (&$dias): void {
                $f = $venta->sold_on->toDateString();
                $s = (int) $venta->seller_id;
                $dias[$f][$s] ??= self::CEROS;
                $dias[$f][$s]['ventas_count'] += $venta->quantity;
                $dias[$f][$s]['ventas'] += $venta->total();
            });

        $vendedor = self::vendedor();
        if ($vendedor !== null && ($sellerId === null || $sellerId === $vendedor->id)) {
            foreach (self::pagos($desde, $hasta) as $f) {
                $dias[$f][$vendedor->id] ??= self::CEROS;
                $dias[$f][$vendedor->id]['costo'] += self::costoMensual();
            }
        }

        ksort($dias);

        return $dias;
    }

    /**
     * Totales del periodo por vendedor.
     *
     * @return array<int, array{ventas_count: int, ventas: int, costo: int}>
     */
    public static function porVendedor(string $desde, string $hasta): array
    {
        $totales = [];
        foreach (self::porDia($desde, $hasta) as $vendedores) {
            foreach ($vendedores as $s => $mov) {
                $totales[$s] ??= self::CEROS;
                foreach ($mov as $clave => $valor) {
                    $totales[$s][$clave] += $valor;
                }
            }
        }

        return $totales;
    }
}
