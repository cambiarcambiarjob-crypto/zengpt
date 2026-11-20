<?php

namespace App\Console\Commands;

use App\Models\Account;
use App\Services\GrupoGoogle;
use Illuminate\Console\Command;
use RuntimeException;

/**
 * «Generar ligas» en segundo plano (lo lanza el botón de la cuenta): manda las invitaciones del grupo familiar al correo
 * de ligas y va guardando el avance para que la tarjeta lo muestre.
 *
 *   php artisan zenbot:generar-ligas 12
 */
class GenerarLigas extends Command
{
    protected $signature = 'zenbot:generar-ligas {cuenta : id de la cuenta}';

    protected $description = 'Manda las invitaciones del grupo familiar al correo de ligas (una por lugar libre)';

    public function handle(GrupoGoogle $grupo): int
    {
        $cuenta = Account::query()->find((int) $this->argument('cuenta'));
        if ($cuenta === null) {
            $this->error('No existe esa cuenta.');

            return self::FAILURE;
        }

        GrupoGoogle::guardarEstadoLigas($cuenta, ['estado' => 'generando', 'enviadas' => 0, 'total' => null, 'mensaje' => null]);

        try {
            $r = $grupo->generarLigas($cuenta, fn (int $enviadas, int $total) => GrupoGoogle::guardarEstadoLigas($cuenta, ['estado' => 'generando', 'enviadas' => $enviadas, 'total' => $total, 'mensaje' => null]));
        } catch (RuntimeException $e) {
            GrupoGoogle::guardarEstadoLigas($cuenta, ['estado' => 'error', 'enviadas' => 0, 'total' => null, 'mensaje' => $e->getMessage()]);
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $mensaje = match (true) {
            $r['total'] === 0 => 'El grupo de Google ya no tiene lugares libres: no hacía falta mandar más ligas.',
            $r['error'] !== null => "Se mandaron {$r['enviadas']} de {$r['total']}: {$r['error']}",
            default => "Listo: {$r['enviadas']} invitaciones enviadas a tu correo de ligas. Pega cada liga en «Editar cuenta».",
        };
        GrupoGoogle::guardarEstadoLigas($cuenta, ['estado' => $r['error'] !== null ? 'error' : 'listo', 'enviadas' => $r['enviadas'], 'total' => $r['total'], 'mensaje' => $mensaje]);
        $this->info($mensaje);

        return $r['error'] !== null ? self::FAILURE : self::SUCCESS;
    }
}
