<?php

namespace App\Services;

use App\Models\Account;
use App\Models\Slot;
use App\Support\Hoy;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Process;
use RuntimeException;

/**
 * Grupo familiar de Google de una cuenta, a través del navegador del servidor que tiene abierta la sesión del
 * administrador del grupo (scripts/zenbot/familia.cjs): leerlo, invitar a un cliente y sacarlo.
 * Una sola acción a la vez (candado) y siempre comprobando que la sesión sea de esa cuenta.
 */
class GrupoGoogle
{
    /** La cuenta tiene su sesión de Google guardada en su Chrome del servidor (o está en ZENBOT_CUENTAS). */
    public static function conectada(Account $account): bool
    {
        return (bool) $account->google_conectada || in_array(mb_strtolower($account->email), self::cuentas(), true);
    }

    /**
     * ¿Es una invitación apartada como liga para mandar (al correo de ligas), y no un cliente?
     * En Gmail ignora puntos y «+algo»: luis.leo+3@gmail.com cuenta igual que luisleo@gmail.com.
     */
    public static function esCorreoDeLigas(string $correo): bool
    {
        $base = array_filter(array_map(fn (string $c): string => self::gmailBase($c), (array) config('zengpt.google.correos_ligas', [])));

        return $base !== [] && in_array(self::gmailBase($correo), $base, true);
    }

    private static function gmailBase(string $correo): string
    {
        $correo = mb_strtolower(trim($correo));
        if (! str_contains($correo, '@')) {
            return '';
        }
        [$usuario, $dominio] = explode('@', $correo, 2);
        if (in_array($dominio, ['gmail.com', 'googlemail.com'], true)) {
            $usuario = str_replace('.', '', explode('+', $usuario, 2)[0]);
            $dominio = 'gmail.com';
        }

        return $usuario.'@'.$dominio;
    }

    /** @return list<string> */
    public static function cuentas(): array
    {
        return array_values(array_filter(array_map(fn (string $c): string => mb_strtolower(trim($c)), (array) config('zengpt.google.cuentas', []))));
    }

    /**
     * @return array{admin: ?string, miembros: list<array{email: string, admin: bool}>, invitaciones: list<array{email: string, caduca: ?string}>}
     */
    public function leer(Account $account): array
    {
        $datos = $this->ejecutar($account, ['leer'], 50);
        if (mb_strtolower((string) ($datos['admin'] ?? '')) !== mb_strtolower($account->email)) {
            throw new RuntimeException('La sesión del servidor es de otra cuenta: no se hizo nada.');
        }

        return ['admin' => $datos['admin'] ?? null, 'miembros' => $datos['miembros'] ?? [], 'invitaciones' => $datos['invitaciones'] ?? []];
    }

    /**
     * Abre el Chrome de la cuenta para el visor (en su grupo familiar o, si no hay sesión, en el inicio de sesión).
     * Devuelve si ya tenía la sesión iniciada.
     */
    public function abrirVisor(Account $account): bool
    {
        return (bool) ($this->ejecutar($account, ['abrir'], 60, requiereConexion: false)['sesion'] ?? false);
    }

    /** Cierra el Chrome de la cuenta (fin del visor). */
    public function cerrarVisor(Account $account): void
    {
        $this->ejecutar($account, ['cerrar'], 30, requiereConexion: false);
    }

    /** Manda la invitación de Google al cliente y lo marca como invitado. */
    public function invitar(Slot $slot): void
    {
        $this->ejecutar($slot->account, ['invitar', $slot->client_email], 80);
        $slot->forceFill(['google_status' => 'invitado', 'invite_sent_at' => $slot->invite_sent_at ?? now(), 'invite_accepted_at' => null])->save();
    }

    /**
     * Saca al cliente del grupo (o cancela su invitación pendiente) y libera su espacio en el sistema.
     * Si Google ya no lo tenía, igual se libera el espacio.
     */
    public function sacar(Slot $slot): void
    {
        try {
            $this->ejecutar($slot->account, ['sacar', $slot->client_email], 80);
        } catch (RuntimeException $e) {
            if ($e->getCode() !== self::NO_ENCONTRADO) {
                throw $e;
            }
        }

        $slot->delete();
    }

    private const NO_ENCONTRADO = 404;

    /**
     * Marca a cada cliente como miembro / invitado / ausente según Google y da de alta (sin precio ni vendedor,
     * pendientes de pago) a quienes están en Google pero no en el sistema, mientras haya espacio.
     *
     * @return array{miembros: int, invitados: int, ausentes: int, agregados: int, extra: int, ligas: int}
     */
    public function sincronizar(Account $account): array
    {
        $grupo = $this->leer($account);
        $miembros = collect($grupo['miembros'])->reject(fn (array $m): bool => (bool) ($m['admin'] ?? false))->pluck('email')->map(fn ($e) => mb_strtolower($e));
        $invitados = collect($grupo['invitaciones'])->pluck('email')->map(fn ($e) => mb_strtolower($e));
        // Las invitaciones al correo de ligas son ligas por mandar, no clientes: no ocupan espacio en el sistema.
        $ligas = $invitados->filter(fn (string $e): bool => self::esCorreoDeLigas($e))->count();
        $miembros = $miembros->reject(fn (string $e): bool => self::esCorreoDeLigas($e))->values()->all();
        $invitados = $invitados->reject(fn (string $e): bool => self::esCorreoDeLigas($e))->values()->all();
        $resumen = ['miembros' => 0, 'invitados' => 0, 'ausentes' => 0, 'agregados' => 0, 'extra' => 0, 'ligas' => $ligas];

        DB::transaction(function () use ($account, $miembros, $invitados, $ligas, &$resumen): void {
            $cuenta = Account::query()->lockForUpdate()->findOrFail($account->id);
            $clientes = [];

            foreach ($cuenta->slots()->get() as $slot) {
                /** @var Slot $slot */
                $correo = mb_strtolower($slot->client_email);

                // Si una liga se había dado de alta sola como cliente, se quita y su espacio queda libre.
                if ($slot->origen === 'google' && self::esCorreoDeLigas($correo)) {
                    $slot->delete();

                    continue;
                }

                $clientes[] = $correo;
                $this->marcar($slot, in_array($correo, $miembros, true) ? 'miembro' : (in_array($correo, $invitados, true) ? 'invitado' : 'ausente'));
                $resumen[match ($slot->google_status) {
                    'miembro' => 'miembros', 'invitado' => 'invitados', default => 'ausentes'
                }]++;
            }

            $nuevos = collect($miembros)->map(fn (string $e): array => ['email' => $e, 'tipo' => 'miembro'])
                ->merge(collect($invitados)->map(fn (string $e): array => ['email' => $e, 'tipo' => 'invitado']))
                ->reject(fn (array $x): bool => in_array($x['email'], $clientes, true))->values();

            $sinLugar = [];
            foreach ($nuevos as $nuevo) {
                $posicion = $cuenta->firstFreePosition();
                if ($posicion === null || ! $cuenta->isActive()) {
                    $sinLugar[] = $nuevo;

                    continue;
                }

                $slot = $cuenta->slots()->create([
                    'position' => $posicion, 'client_email' => $nuevo['email'], 'price_cents' => 0, 'seller_id' => null,
                    'sold_on' => Hoy::fecha(), 'paid_on' => null, 'origen' => 'google',
                ]);
                $this->marcar($slot, $nuevo['tipo']);
                $cuenta->unsetRelation('slots');
                $resumen['agregados']++;
                $resumen[$nuevo['tipo'] === 'miembro' ? 'miembros' : 'invitados']++;
            }

            $resumen['extra'] = count($sinLugar);
            $cuenta->forceFill(['google_synced_at' => now(), 'google_extra' => $sinLugar, 'google_conectada' => true, 'google_ligas' => $ligas])->save();
        });

        return $resumen;
    }

    /** Clave base32 del 2FA a partir de la liga guardada (p. ej. https://api2fa.com/CLAVE → CLAVE). */
    public static function secreto2fa(?string $liga): string
    {
        if (blank($liga)) {
            return '';
        }

        $ultimo = basename((string) parse_url(trim($liga), PHP_URL_PATH));
        parse_str((string) parse_url(trim($liga), PHP_URL_QUERY), $query);
        $candidato = (string) ($query['secret'] ?? $ultimo);

        return preg_match('/^[A-Za-z2-7]{16,}$/', $candidato) === 1 ? strtoupper($candidato) : '';
    }

    private function marcar(Slot $slot, string $estado): void
    {
        $slot->google_status = $estado;
        if ($estado === 'miembro') {
            $slot->invite_accepted_at ??= now();
        } else {
            $slot->invite_accepted_at = null;
            if ($estado === 'invitado') {
                $slot->invite_sent_at ??= now();
            }
        }
        $slot->save();
    }

    /**
     * Corre una acción del lector con candado (el navegador es uno solo) y traduce los errores.
     *
     * @param  list<string>  $argumentos
     * @return array<string, mixed>
     */
    private function ejecutar(Account $account, array $argumentos, int $segundos, bool $requiereConexion = true): array
    {
        if ($requiereConexion && ! self::conectada($account)) {
            throw new RuntimeException('Esta cuenta aún no tiene su sesión de Google en el servidor: entra con «Iniciar sesión (visor)».');
        }

        $lock = Cache::lock('zenbot-navegador', $segundos + 10);
        if (! $lock->block(15)) {
            throw new RuntimeException('El servidor está ocupado con otra cuenta; intenta en unos segundos.');
        }

        try {
            $resultado = Process::timeout($segundos)
                ->env([
                    'ZENBOT_ADMIN' => mb_strtolower($account->email),
                    // Por si Google pide «verifica que eres tú»: contraseña y clave 2FA de la cuenta (solo en el entorno del proceso).
                    'ZENBOT_PASS' => (string) $account->password,
                    'ZENBOT_TOTP' => self::secreto2fa($account->twofa_url),
                ])
                ->run([(string) config('zengpt.google.node', 'node'), (string) config('zengpt.google.script'), ...$argumentos]);
        } finally {
            $lock->release();
        }

        $datos = json_decode(trim($resultado->output()), true);
        if (! is_array($datos)) {
            throw new RuntimeException('No se pudo hablar con Google (el lector no respondió).');
        }

        if (! ($datos['ok'] ?? false)) {
            throw new RuntimeException(code: ($datos['error'] ?? '') === 'no_encontrado' ? self::NO_ENCONTRADO : 0, message: match ($datos['error'] ?? '') {
                'sin_sesion' => 'Google cerró la sesión del servidor: entra con «Iniciar sesión (visor)» en la cuenta.',
                'sin_navegador' => 'El Chrome del servidor no arrancó. Intenta de nuevo en un momento.',
                'visor_ocupado' => 'El visor está abierto con otra cuenta: ciérralo (o espera unos minutos) y vuelve a intentar.',
                'otra_cuenta' => 'La sesión del servidor es de otra cuenta: no se hizo nada.',
                'no_encontrado' => 'Ese cliente no está en el grupo de Google (ni con invitación pendiente).',
                'sin_lugar' => 'El grupo de Google ya no tiene lugares para invitar.',
                'no_confirmado' => 'Google no confirmó el cambio. Revisa el grupo y vuelve a intentar.',
                'lectura_incompleta' => 'Google tardó en cargar el grupo. Intenta de nuevo en un momento.',
                'falta_contrasena' => 'Google pidió confirmar la contraseña: guárdala en la cuenta (Editar cuenta) y vuelve a intentar.',
                'falta_2fa' => 'Google pidió el código de 2 pasos: guarda la liga de 2FA en la cuenta y vuelve a intentar.',
                'verificacion_rechazada' => 'Google rechazó la contraseña o el código 2FA guardados en la cuenta. Revísalos.',
                'verificacion_distinta' => 'Google pidió otra forma de verificación (teléfono o app). Hay que hacerlo a mano en el servidor.',
                'verificacion_atorada' => 'Google no aceptó la verificación automática. Intenta de nuevo o hazlo a mano en el servidor.',
                default => 'Google no respondió como se esperaba. Intenta de nuevo en un momento.',
            });
        }

        return $datos;
    }
}
