<?php

namespace App\Support;

use Illuminate\Support\Carbon;

/** «Hoy» en el calendario del negocio (America/Chihuahua), no en UTC. */
final class Hoy
{
    public static function carbon(): Carbon
    {
        return Carbon::now(config('zengpt.zona', 'America/Chihuahua'))->startOfDay();
    }

    public static function fecha(): string
    {
        return self::carbon()->toDateString();
    }
}
