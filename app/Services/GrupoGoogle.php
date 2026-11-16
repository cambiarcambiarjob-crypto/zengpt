<?php

namespace App\Services;

use App\Models\Account;
use App\Models\Slot;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Process;
use RuntimeException;

/**
 * Lee (SOLO LECTURA) el grupo familiar de Google de una cuenta a través del navegador del servidor que
 * tiene abierta la sesión del administrador del grupo (scripts/zenbot/familia.cjs) y actualiza a sus clientes.
 */
class GrupoGoogle
{
    /** Cuentas cuya sesión está abierta en el navegador del servidor (ZENBOT_CUENTAS). */
    public static function conectada(Account $account): bool
    {
        return in_array(mb_strtolower($account->email), self::cuentas(), true);
    }

    /** @return list<string> */
    public static function cuentas(): array
    {
        return array_values(array_filter(array_map(fn (string $c): string => mb_strtolower(trim($c)), (array) config('zengpt.google.cuentas', []))));
    }

    /**
     * @return array{admin: ?string, miembros: list<array{email: string, nombre: string, admin: bool}>, invitaciones: list<array{email: string, caduca: ?string}>}
     */
    public function leer(): array
    {
        $resultado = Process::timeout(50)->run([(string) config('zengpt.google.node', 'node'), (string) config('zengpt.google.script'), 'leer']);
        $datos = json_decode(trim($resultado->output()), true);

        if (! is_array($datos)) {
            throw new RuntimeException('No se pudo leer el grupo familiar (el lector no respondió).');
        }

        if (! ($datos['ok'] ?? false)) {
            throw new RuntimeException(match ($datos['error'] ?? '') {
                'sin_sesion' => 'Google cerró la sesión del servidor: hay que volver a iniciar sesión en la cuenta.',
                'sin_navegador' => 'El navegador del servidor no está encendido.',
                default => 'Google no respondió como se esperaba. Intenta de nuevo en un momento.',
            });
        }

        return ['admin' => $datos['admin'] ?? null, 'miembros' => $datos['miembros'] ?? [], 'invitaciones' => $datos['invitaciones'] ?? []];
    }

    /**
     * Marca a cada cliente como miembro / invitado / ausente según Google y guarda quién está en Google sin estar en
     * el sistema. Devuelve el resumen para el aviso.
     *
     * @return array{miembros: int, invitados: int, ausentes: int, extra: int}
     */
    public function sincronizar(Account $account): array
    {
        if (! self::conectada($account)) {
            throw new RuntimeException('Esta cuenta no tiene su sesión abierta en el servidor.');
        }

        $lock = Cache::lock('zenbot-navegador', 60);
        if (! $lock->get()) {
            throw new RuntimeException('Ya se está revisando otra cuenta; intenta en unos segundos.');
        }

        try {
            $grupo = $this->leer();
        } finally {
            $lock->release();
        }

        if (mb_strtolower((string) $grupo['admin']) !== mb_strtolower($account->email)) {
            throw new RuntimeException('La sesión del servidor es de otra cuenta ('.($grupo['admin'] ?? 'desconocida').').');
        }

        $miembros = collect($grupo['miembros'])->reject(fn (array $m): bool => (bool) ($m['admin'] ?? false))->pluck('email')->map(fn ($e) => mb_strtolower($e))->all();
        $invitados = collect($grupo['invitaciones'])->pluck('email')->map(fn ($e) => mb_strtolower($e))->all();
        $resumen = ['miembros' => 0, 'invitados' => 0, 'ausentes' => 0, 'extra' => 0];

        DB::transaction(function () use ($account, $miembros, $invitados, &$resumen): void {
            $clientes = [];

            foreach ($account->slots()->get() as $slot) {
                /** @var Slot $slot */
                $correo = mb_strtolower($slot->client_email);
                $clientes[] = $correo;

                if (in_array($correo, $miembros, true)) {
                    $slot->google_status = 'miembro';
                    $slot->invite_accepted_at ??= now();
                    $resumen['miembros']++;
                } elseif (in_array($correo, $invitados, true)) {
                    $slot->google_status = 'invitado';
                    $slot->invite_sent_at ??= now();
                    $slot->invite_accepted_at = null;
                    $resumen['invitados']++;
                } else {
                    $slot->google_status = 'ausente';
                    $slot->invite_accepted_at = null;
                    $resumen['ausentes']++;
                }

                $slot->save();
            }

            $extra = collect($miembros)->map(fn (string $e): array => ['email' => $e, 'tipo' => 'miembro'])
                ->merge(collect($invitados)->map(fn (string $e): array => ['email' => $e, 'tipo' => 'invitado']))
                ->reject(fn (array $x): bool => in_array($x['email'], $clientes, true))->values()->all();
            $resumen['extra'] = count($extra);

            $account->forceFill(['google_synced_at' => now(), 'google_extra' => $extra])->save();
        });

        return $resumen;
    }
}
