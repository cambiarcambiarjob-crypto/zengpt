<?php

namespace App\Support;

/**
 * Reparto de la ganancia de UN vendedor en un periodo (un día o varios):
 *
 *   neto     = ventas − publicidad del vendedor − costo de sus espacios (costo de la cuenta ÷ 5 por cliente)
 *   socio    = 10 % del neto                      (Christian, sobre todas las ventas)
 *   resto    = neto − socio
 *   vendedor = mitad del resto                    (0 si el vendedor es el dueño)
 *   dueño    = resto − vendedor                   (Leo; todo el resto si él vendió)
 *
 * Todo en centavos. Con neto negativo (más publicidad que ventas) las partes salen negativas en la
 * misma proporción: la pérdida se reparte igual que la ganancia.
 */
final class Reparto
{
    /**
     * @return array{ventas: int, publicidad: int, costo: int, neto: int, socio: int, vendedor: int, dueno: int}
     */
    public static function calcular(int $ventasCents, int $publicidadCents, bool $esDueno, int $costoCents = 0): array
    {
        $neto = $ventasCents - $publicidadCents - $costoCents;
        $socio = (int) round($neto * self::porcentajeSocio() / 100);
        $resto = $neto - $socio;
        $vendedor = $esDueno ? 0 : (int) round($resto * self::porcentajeVendedor() / 100);

        return [
            'ventas' => $ventasCents,
            'publicidad' => $publicidadCents,
            'costo' => $costoCents,
            'neto' => $neto,
            'socio' => $socio,
            'vendedor' => $vendedor,
            'dueno' => $resto - $vendedor,
        ];
    }

    public static function porcentajeSocio(): float
    {
        return (float) config('zengpt.porcentaje_socio', 10);
    }

    public static function porcentajeVendedor(): float
    {
        return (float) config('zengpt.porcentaje_vendedor', 50);
    }
}
