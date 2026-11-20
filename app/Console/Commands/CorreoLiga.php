<?php

namespace App\Console\Commands;

use App\Models\Account;
use App\Services\GrupoGoogle;
use App\Support\CorreoLiga as Lector;
use App\Support\Hoy;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Recibe un correo del buzón de ligas (Postfix lo entrega aquí por la entrada estándar) y, si es una invitación de
 * Google para una cuenta (liga-<id>-…@<buzón>), pone la liga en el siguiente espacio vacío de esa cuenta.
 * Siempre termina bien (0) para que el servidor de correo no rebote nada; si la base no responde, pide reintento (75).
 *
 *   php artisan zenbot:correo-liga liga-12-a8f3k2@zengpt.codezen.online < correo.eml
 */
class CorreoLiga extends Command
{
    protected $signature = 'zenbot:correo-liga {destinatario} {--archivo= : Lee el correo de un archivo .eml (por omisión, de la entrada estándar)}';

    protected $description = 'Pone en la cuenta la liga de un correo de invitación que llegó al buzón de ligas';

    /** Días que dura la liga de una invitación de Google (caduca a las 2 semanas; se deja un día de margen). */
    private const DIAS_LIGA = 13;

    public function handle(): int
    {
        $destinatario = mb_strtolower(trim((string) $this->argument('destinatario')));
        $archivo = $this->option('archivo');
        $crudo = (string) file_get_contents(is_string($archivo) && $archivo !== '' ? $archivo : 'php://stdin');
        if (! $archivo) {
            $this->guardarCopia($destinatario, $crudo);
        }

        if (preg_match('/^liga-(\d+)-[a-z0-9]+@/', $destinatario, $m) !== 1 || ! Lector::deGoogle($crudo)) {
            return self::SUCCESS;
        }

        $liga = Lector::liga($crudo);
        if ($liga === null) {
            Log::warning("buzón de ligas: el correo para {$destinatario} no trae liga de invitación");

            return self::SUCCESS;
        }

        try {
            $espacio = DB::transaction(function () use ($m, $liga): ?int {
                $cuenta = Account::query()->lockForUpdate()->find((int) $m[1]);
                if ($cuenta === null) {
                    return null;
                }

                $ligas = (array) ($cuenta->invite_links ?? []);
                foreach ($ligas as $actual) {
                    if (($actual['url'] ?? null) === $liga) {
                        return null; // ya estaba (el mismo correo llegó dos veces)
                    }
                }

                for ($p = 1; $p <= Account::capacity(); $p++) {
                    $actual = $ligas[(string) $p] ?? null;
                    $vencida = is_array($actual) && filled($actual['expires_on'] ?? null) && $actual['expires_on'] < Hoy::fecha();
                    if (! is_array($actual) || blank($actual['url'] ?? null) || $vencida) {
                        $ligas[(string) $p] = ['url' => $liga, 'expires_on' => Hoy::carbon()->addDays(self::DIAS_LIGA)->toDateString()];
                        ksort($ligas);
                        $cuenta->forceFill(['invite_links' => $ligas])->save();
                        $cuenta->syncInviteLinks();

                        return $p;
                    }
                }

                return null;
            });
        } catch (Throwable $e) {
            Log::error("buzón de ligas: {$e->getMessage()}");

            return 75; // EX_TEMPFAIL: el servidor de correo lo reintenta
        }

        $cuenta = Account::query()->find((int) $m[1]);
        if ($cuenta !== null && $espacio !== null) {
            Log::info("buzón de ligas: liga puesta en el espacio {$espacio} de {$cuenta->email}");
            $estado = GrupoGoogle::estadoLigas($cuenta);
            if (is_array($estado)) {
                $recibidas = (int) ($estado['recibidas'] ?? 0) + 1;
                $faltan = max(0, (int) ($estado['enviadas'] ?? 0) - $recibidas);
                GrupoGoogle::guardarEstadoLigas($cuenta, array_merge($estado, [
                    'recibidas' => $recibidas,
                    'estado' => $estado['estado'] === 'esperando' && $faltan === 0 ? 'listo' : $estado['estado'],
                    'mensaje' => $estado['estado'] === 'esperando' && $faltan === 0
                        ? "Listo: {$recibidas} ".($recibidas === 1 ? 'liga puesta' : 'ligas puestas').' en los espacios de la cuenta.'
                        : $estado['mensaje'],
                ]));
            }
        }

        return self::SUCCESS;
    }

    /** Copia privada del correo (para revisar si Google cambia el formato); se borran a los 7 días. */
    private function guardarCopia(string $destinatario, string $crudo): void
    {
        $carpeta = (string) config('zengpt.google.correos');
        if ($carpeta === '' || (! is_dir($carpeta) && ! @mkdir($carpeta, 0700, true))) {
            return;
        }

        $archivo = $carpeta.'/'.now()->format('Ymd-His').'-'.preg_replace('/[^a-z0-9@._-]/', '_', $destinatario).'.eml';
        if (@file_put_contents($archivo, $crudo) !== false) {
            @chmod($archivo, 0600);
        }

        foreach (glob($carpeta.'/*.eml') ?: [] as $viejo) {
            if (filemtime($viejo) < time() - 7 * 86400) {
                @unlink($viejo);
            }
        }
    }
}
