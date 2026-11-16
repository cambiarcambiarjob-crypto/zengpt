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
