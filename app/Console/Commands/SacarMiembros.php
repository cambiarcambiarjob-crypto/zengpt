<?php

namespace App\Console\Commands;

use App\Models\Account;
use App\Services\GrupoGoogle;
use Illuminate\Console\Command;
use RuntimeException;

/**
 * «Sacar a todos los miembros» en segundo plano (lo lanza el botón del visor): Google quita del grupo familiar a todos
 * menos al administrador, en el Chrome de la cuenta. El visor muestra el avance y el tiempo que lleva.
 *
 *   php artisan zenbot:sacar-miembros 12
 */
class SacarMiembros extends Command
{
    protected $signature = 'zenbot:sacar-miembros {cuenta : id de la cuenta}';

    protected $description = 'Saca del grupo familiar de Google a todos los miembros de una cuenta (menos al administrador)';

    public function handle(GrupoGoogle $grupo): int
    {
        $cuenta = Account::query()->find((int) $this->argument('cuenta'));
        if ($cuenta === null) {
            $this->error('No existe esa cuenta.');

            return self::FAILURE;
        }

        $inicio = (GrupoGoogle::estadoSacar($cuenta)['inicio'] ?? null) ?: now()->getTimestamp();
        $guardar = fn (array $estado) => GrupoGoogle::guardarEstadoSacar($cuenta, $estado + ['inicio' => $inicio, 'fin' => $estado['estado'] === 'sacando' ? null : now()->getTimestamp()]);
        $guardar(['estado' => 'sacando', 'mensaje' => null]);

        try {
            $r = $grupo->sacarTodos($cuenta);
        } catch (RuntimeException $e) {
            $guardar(['estado' => 'error', 'mensaje' => $e->getMessage()]);
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        // Ya sin ellos, se revisa el grupo para dejar todo al día.
        try {
            $grupo->sincronizar($cuenta);
        } catch (RuntimeException) {
            // La siguiente revisión lo deja al día.
        }

        $sacados = count($r['sacados']);
        $mensaje = match (true) {
            $r['total'] === 0 => 'El grupo ya no tenía miembros: solo queda el administrador.',
            $r['siguen'] === [] => "Listo: se sacó a {$sacados} ".($sacados === 1 ? 'miembro' : 'miembros').'. El grupo quedó solo con el administrador.',
            default => "Se sacó a {$sacados} de {$r['total']}. Siguen en el grupo: ".implode(', ', $r['siguen']).'. Vuelve a intentarlo o quítalos a mano en la pantalla.',
        };
        $guardar(['estado' => $r['siguen'] === [] ? 'listo' : 'error', 'mensaje' => $mensaje, 'sacados' => $sacados, 'total' => $r['total']]);
        $this->info($mensaje);

        return $r['siguen'] === [] ? self::SUCCESS : self::FAILURE;
    }
}
