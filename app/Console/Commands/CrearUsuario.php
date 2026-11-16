<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

/**
 * Crea o actualiza un usuario del sistema.
 *
 *   php artisan zengpt:usuario Leo --rol=admin --nombre="Leo"
 *   ZG_PASSWORD='…' php artisan zengpt:usuario Christian --rol=socio --password-env
 *
 * Sin --password-env genera una contraseña y la muestra una sola vez.
 */
class CrearUsuario extends Command
{
    protected $signature = 'zengpt:usuario {usuario} {--rol=socio : admin o socio} {--nombre=} {--password-env : Toma la contraseña de la variable ZG_PASSWORD} {--nueva : Genera una contraseña nueva si el usuario ya existe}';

    protected $description = 'Crea o actualiza un usuario (admin o socio) del sistema';

    private const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    public function handle(): int
    {
        $username = mb_strtolower(trim((string) $this->argument('usuario')));
        $rol = (string) $this->option('rol');

        if (preg_match('/^[a-z0-9._-]{3,60}$/', $username) !== 1 || ! in_array($rol, [User::ROLE_ADMIN, User::ROLE_SOCIO], true)) {
            $this->error('Usuario (3-60 letras, números, punto o guion) o rol (admin|socio) inválido.');

            return self::INVALID;
        }

        $dada = null;
        if ($this->option('password-env')) {
            $dada = (string) getenv('ZG_PASSWORD');
            if (mb_strlen($dada) < 10) {
                $this->error('ZG_PASSWORD debe existir y tener al menos 10 caracteres.');

                return self::INVALID;
            }
        }

        $user = User::query()->where('username', $username)->first();
        $password = $dada ?? (($user === null || $this->option('nueva')) ? self::generar() : null);
        $nombre = trim((string) $this->option('nombre')) ?: ($user?->name ?? (string) $this->argument('usuario'));

        $datos = ['name' => $nombre, 'username' => $username, 'role' => $rol, 'email' => $user?->email ?? $username.'@zengpt.local'];
        if ($password !== null) {
            $datos['password'] = $password;
        }

        $user ? $user->update($datos) : User::query()->create($datos);

        $this->info(($user ? 'Actualizado' : 'Creado').": {$this->argument('usuario')} ({$rol})");
        if ($dada === null && $password !== null) {
            $this->line("Contraseña (se muestra solo esta vez): {$password}");
        }

        return self::SUCCESS;
    }

    public static function generar(): string
    {
        $bloques = [];
        for ($b = 0; $b < 4; $b++) {
            $bloque = '';
            for ($i = 0; $i < 4; $i++) {
                $bloque .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
            }
            $bloques[] = $bloque;
        }

        return implode('-', $bloques);
    }
}
