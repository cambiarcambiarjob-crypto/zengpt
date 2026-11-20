<?php

namespace App\Console\Commands;

use App\Models\Account;
use App\Services\GrupoGoogle;
use Illuminate\Console\Command;
use RuntimeException;

/**
 * «Generar ligas» en segundo plano (lo lanza el botón de la cuenta): manda las invitaciones del grupo familiar al buzón
 * de ligas (una por lugar libre) y guarda el avance; las ligas se ponen solas al llegar cada correo (zenbot:correo-liga).
 *
 *   php artisan zenbot:generar-ligas 12
 */
class GenerarLigas extends Command
{
    protected $signature = 'zenbot:generar-ligas {cuenta : id de la cuenta}';

    protected $description = 'Manda las invitaciones del grupo familiar al buzón de ligas (una por lugar libre)';

    public function handle(GrupoGoogle $grupo): int
    {
        $cuenta = Account::query()->find((int) $this->argument('cuenta'));
        if ($cuenta === null) {
            $this->error('No existe esa cuenta.');

            return self::FAILURE;
        }

        $base = ['enviadas' => 0, 'total' => null, 'recibidas' => 0, 'mensaje' => null, 'desde' => now()->getTimestamp()];
        GrupoGoogle::guardarEstadoLigas($cuenta, ['estado' => 'generando'] + $base);

        try {
            $r = $grupo->generarLigas($cuenta, fn (int $enviadas, int $total) => GrupoGoogle::guardarEstadoLigas($cuenta, array_merge(GrupoGoogle::estadoLigas($cuenta) ?? $base, ['estado' => 'generando', 'enviadas' => $enviadas, 'total' => $total])));
        } catch (RuntimeException $e) {
            GrupoGoogle::guardarEstadoLigas($cuenta, ['estado' => 'error', 'mensaje' => $e->getMessage()] + $base);
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        // Las ligas del buzón pueden haber llegado mientras se mandaban las demás.
        $recibidas = (int) (GrupoGoogle::estadoLigas($cuenta)['recibidas'] ?? 0);
        $estado = match (true) {
            $r['error'] !== null => 'error',
            $r['buzon'] && $r['enviadas'] > $recibidas => 'esperando',
            default => 'listo',
        };
        $mensaje = match (true) {
            $r['error'] !== null => ($r['enviadas'] > 0 ? "Se mandaron {$r['enviadas']} de {$r['total']}: " : 'No se mandó: ').$r['error'],
            $r['motivo'] === 'pendiente' => 'Ya hay una liga pendiente en tu correo de ligas para esta cuenta: úsala primero y luego genera la siguiente.',
            $r['motivo'] === 'sin_lugar' => 'No hace falta: el grupo de Google ya no tiene lugares libres o los espacios ya tienen su liga.',
            $estado === 'esperando' => "Se mandaron {$r['enviadas']} invitaciones al buzón: cada liga se pone sola en su espacio en cuanto llega el correo de Google.",
            $r['buzon'] => "Listo: {$recibidas} ".($recibidas === 1 ? 'liga puesta' : 'ligas puestas').' en los espacios de la cuenta.',
            default => 'Listo: te llegó una liga a tu correo de ligas. Pégala en «Editar cuenta» y, cuando se use, genera la siguiente.',
        };
        GrupoGoogle::guardarEstadoLigas($cuenta, array_merge($base, ['estado' => $estado, 'enviadas' => $r['enviadas'], 'total' => $r['total'], 'recibidas' => $recibidas, 'mensaje' => $mensaje]));
        $this->info($mensaje);

        return $r['error'] !== null ? self::FAILURE : self::SUCCESS;
    }
}
