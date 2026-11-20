<?php

namespace App\Support;

/**
 * Lee un correo de invitación al grupo familiar de Google (tal como llega al buzón de ligas) y saca la liga
 * https://families.google.com/join/…. Decodifica las partes en quoted-printable y base64, y las ligas que Google
 * envuelve en google.com/url?q=….
 */
final class CorreoLiga
{
    /** El correo viene de Google (remitente @google.com). */
    public static function deGoogle(string $crudo): bool
    {
        $cabeceras = preg_split('/\r?\n\r?\n/', $crudo, 2)[0] ?? '';

        return preg_match('/^(from|sender|return-path):[^\r\n]*@(\w+\.)*google\.com\b/im', $cabeceras) === 1;
    }

    /** La liga de invitación, o null si el correo no trae ninguna. */
    public static function liga(string $crudo): ?string
    {
        $texto = self::texto($crudo);

        foreach ([$texto, urldecode($texto)] as $donde) {
            if (preg_match('#https://families\.google\.com/join[^\s"\'<>()\\\\]*#i', $donde, $m) === 1) {
                return rtrim(html_entity_decode($m[0], ENT_QUOTES | ENT_HTML5), '.,;:!?]&');
            }
        }

        return null;
    }

    /** Todo el texto del correo con sus partes ya decodificadas. */
    private static function texto(string $crudo): string
    {
        $salida = '';
        foreach (preg_split('/\r?\n--[^\r\n]*\r?\n/', $crudo) ?: [] as $parte) {
            [$cabeceras, $cuerpo] = array_pad(preg_split('/\r?\n\r?\n/', $parte, 2) ?: [], 2, '');
            if (preg_match('/content-transfer-encoding:\s*base64/i', $cabeceras) === 1) {
                $salida .= base64_decode((string) preg_replace('/\s+/', '', $cuerpo), false)."\n";
            } elseif (preg_match('/content-transfer-encoding:\s*quoted-printable/i', $cabeceras) === 1) {
                $salida .= quoted_printable_decode($cuerpo)."\n";
            } else {
                $salida .= $parte."\n";
            }
        }

        return html_entity_decode($salida, ENT_QUOTES | ENT_HTML5);
    }
}
