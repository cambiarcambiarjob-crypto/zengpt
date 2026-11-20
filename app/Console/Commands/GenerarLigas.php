<?php

namespace App\Console\Commands;

use App\Models\Account;
use App\Services\GrupoGoogle;
use Illuminate\Console\Command;
use RuntimeException;

/**
 * «Generar liga» en segundo plano (lo lanza el botón de la cuenta): manda UNA invitación del grupo familiar al correo de
 * ligas y guarda el resultado para que la tarjeta lo muestre.
 *
 *   php artisan zenbot:generar-ligas 12
 */
class GenerarLigas extends Command
{
    protected $signature = 'zenbot:generar-ligas {cuenta : id de la cuenta}';

    protected $description = 'Manda una invitación del grupo familiar al correo de ligas (una a la vez)';

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
            GrupoGoogle::guardarEstadoLigas($cuenta, ['estado' => 'error', 'enviadas' => 0, 'total' => 1, 'mensaje' => $e->getMessage()]);
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $mensaje = match (true) {
            $r['error'] !== null => "No se mandó la liga: {$r['error']}",
            $r['motivo'] === 'pendiente' => 'Ya hay una liga pendiente en tu correo de ligas para esta cuenta: úsala primero y luego genera la siguiente.',
            $r['motivo'] === 'sin_lugar' => 'El grupo de Google ya no tiene lugares libres: no hace falta otra liga.',
            default => 'Listo: te llegó una liga a tu correo de ligas. Pégala en «Editar cuenta» y, cuando se use, genera la siguiente.',
        };
        GrupoGoogle::guardarEstadoLigas($cuenta, ['estado' => $r['error'] !== null ? 'error' : 'listo', 'enviadas' => $r['enviadas'], 'total' => 1, 'mensaje' => $mensaje]);
        $this->info($mensaje);

        return $r['error'] !== null ? self::FAILURE : self::SUCCESS;
    }
}
