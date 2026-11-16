<?php

namespace App\Support;

/**
 * Código de verificación en 2 pasos (TOTP, RFC 6238: 6 dígitos cada 30 s), igual que una app autenticadora,
 * a partir de la clave base32 de la cuenta. Se usa para mostrarlo en el visor y copiarlo.
 */
final class Totp
{
    public static function codigo(string $secreto, ?int $momento = null): ?string
    {
        $clave = self::base32(strtoupper(preg_replace('/[^A-Za-z2-7]/', '', $secreto) ?? ''));
        if ($clave === '') {
            return null;
        }

        $contador = intdiv($momento ?? time(), 30);
        $hash = hash_hmac('sha1', pack('J', $contador), $clave, true);
        $o = ord($hash[19]) & 0x0F;
        $numero = ((ord($hash[$o]) & 0x7F) << 24) | (ord($hash[$o + 1]) << 16) | (ord($hash[$o + 2]) << 8) | ord($hash[$o + 3]);

        return str_pad((string) ($numero % 1000000), 6, '0', STR_PAD_LEFT);
    }

    /** Segundos que le quedan al código actual. */
    public static function restante(?int $momento = null): int
    {
        return 30 - (($momento ?? time()) % 30);
    }

    private static function base32(string $texto): string
    {
        $alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $bits = '';
        foreach (str_split($texto) as $c) {
            $bits .= str_pad(decbin(strpos($alfabeto, $c)), 5, '0', STR_PAD_LEFT);
        }

        return implode('', array_map(fn (string $b): string => chr(bindec($b)), array_filter(str_split($bits, 8), fn (string $b): bool => strlen($b) === 8)));
    }
}
