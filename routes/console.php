<?php

use App\Models\Account;
use App\Services\GrupoGoogle;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
| Revisión automática del grupo de Google de las cuentas con sesión abierta en el servidor (solo lectura +
| alta de quienes estén en Google y no en el sistema). Cada 30 minutos, una cuenta tras otra.
*/
Artisan::command('google:revisar', function () {
    $grupo = app(GrupoGoogle::class);

    foreach (Account::query()->active()->get()->filter(fn (Account $a): bool => GrupoGoogle::conectada($a)) as $cuenta) {
        try {
            $r = $grupo->sincronizar($cuenta);
            $this->info("{$cuenta->email}: ".json_encode($r));
        } catch (RuntimeException $e) {
            Log::warning("google:revisar {$cuenta->email}: {$e->getMessage()}");
            $this->warn("{$cuenta->email}: {$e->getMessage()}");
        }
    }
})->purpose('Revisa el grupo familiar en Google de las cuentas conectadas');

Schedule::command('google:revisar')->everyThirtyMinutes()->withoutOverlapping(20);

/*
| Visores olvidados: si la pestaña de un visor se cerró sin avisar (celular apagado, sin internet, computadora
| suspendida), su Chrome se quedaba prendido en el servidor para siempre. Cada visor abierto avisa cada minuto; el que
| lleva 5 minutos sin avisar se cierra (la sesión de Google queda guardada en su perfil). Se revisa cada minuto.
*/
Artisan::command('zenbot:cerrar-olvidados {--minutos=5}', function () {
    foreach (app(GrupoGoogle::class)->cerrarOlvidados(max(1, (int) $this->option('minutos'))) as $visor) {
        $this->info("Se cerró el visor olvidado de {$visor}.");
    }
})->purpose('Cierra el Chrome de los visores cuya pestaña ya no está abierta');

Schedule::command('zenbot:cerrar-olvidados')->everyMinute()->withoutOverlapping(5);
