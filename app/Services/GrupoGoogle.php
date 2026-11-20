<?php

namespace App\Services;

use App\Exceptions\VisorOcupado;
use App\Models\Account;
use App\Models\Slot;
use App\Support\Hoy;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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
     * `limite`: en el Chrome de la cuenta (p. ej. en el visor) Google mostraba «Has alcanzado el límite de invitaciones».
     *
     * `quedan`: lugares libres que dice Google («Enviar invitaciones (quedan N)»), o null si no lo mostró.
     *
     * @return array{admin: ?string, miembros: list<array{email: string, admin: bool}>, invitaciones: list<array{email: string, caduca: ?string}>, limite: bool, quedan: ?int}
     */
    public function leer(Account $account): array
    {
        $datos = $this->ejecutar($account, ['leer'], 50);
        if (mb_strtolower((string) ($datos['admin'] ?? '')) !== mb_strtolower($account->email)) {
            throw new RuntimeException('La sesión del servidor es de otra cuenta: no se hizo nada.');
        }

        return ['admin' => $datos['admin'] ?? null, 'miembros' => $datos['miembros'] ?? [], 'invitaciones' => $datos['invitaciones'] ?? [], 'limite' => (bool) ($datos['limite'] ?? false), 'quedan' => isset($datos['quedan']) ? (int) $datos['quedan'] : null];
    }

    /**
     * Abre el Chrome de la cuenta para el visor, en su propia pantalla (en su grupo familiar o, si no hay sesión, en el
     * inicio de sesión). `ficha` identifica la pestaña del visor; con `forzar`, si todas las pantallas tienen un visor
     * abierto, se cierra el más viejo. Devuelve si ya tenía la sesión iniciada y en qué pantalla quedó.
     *
     * @return array{sesion: bool, pantalla: int}
     */
    public function abrirVisor(Account $account, bool $forzar = false, ?string $ficha = null): array
    {
        $datos = $this->ejecutar($account, $forzar ? ['abrir', 'forzar'] : ['abrir'], 60, requiereConexion: false, entorno: ['ZENBOT_FICHA' => (string) $ficha]);

        return ['sesion' => (bool) ($datos['sesion'] ?? false), 'pantalla' => (int) ($datos['pantalla'] ?? 1)];
    }

    /** Cierra el Chrome de la cuenta (fin del visor). Con `ficha`, solo si sigue siendo el de esa pestaña. */
    public function cerrarVisor(Account $account, ?string $ficha = null): void
    {
        $this->ejecutar($account, ['cerrar'], 30, requiereConexion: false, entorno: ['ZENBOT_FICHA' => (string) $ficha]);
    }

    /**
     * Manda la invitación de Google al cliente y lo marca como invitado. Si Google la aceptó, ya pasó su límite de
     * invitaciones: se quita el bloqueo de la cuenta.
     */
    public function invitar(Slot $slot): void
    {
        $this->ejecutar($slot->account, ['invitar', $slot->client_email], 80);
        $slot->forceFill(['google_status' => 'invitado', 'invite_sent_at' => $slot->invite_sent_at ?? now(), 'invite_accepted_at' => null])->save();
        $slot->account->desbloquearInvitaciones();
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
     * Si en el Chrome de la cuenta Google mostraba el límite de invitaciones, la cuenta queda bloqueada.
     *
     * @return array{miembros: int, invitados: int, ausentes: int, agregados: int, extra: int, ligas: int, bloqueo: ?string}
     */
    public function sincronizar(Account $account): array
    {
        $grupo = $this->leer($account);
        if ($grupo['limite']) {
            $account->bloquearInvitaciones();
        }
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

        return $resumen + ['bloqueo' => $account->bloqueoHastaTexto()];
    }

    /**
     * Correos a los que se mandan las ligas: variantes «+1», «+2», … del correo de ligas (Gmail las entrega en el mismo
     * buzón y el sistema las reconoce como ligas, no como clientes).
     *
     * @return list<string>
     */
    public static function correosParaLigas(int $cuantos): array
    {
        $base = collect((array) config('zengpt.google.correos_ligas', []))->map(fn ($c): string => mb_strtolower(trim((string) $c)))->first(fn (string $c): bool => str_contains($c, '@'));
        if ($base === null || $cuantos < 1) {
            return [];
        }

        [$usuario, $dominio] = explode('@', $base, 2);
        $usuario = explode('+', $usuario, 2)[0];

        return array_map(fn (int $k): string => "{$usuario}+{$k}@{$dominio}", range(1, $cuantos));
    }

    /**
     * «Generar ligas»: manda una invitación del grupo familiar a una variante del correo de ligas por cada lugar libre
     * en Google (hasta llenar los espacios de la cuenta), para pegar después esas ligas en la cuenta. No repite las que
     * ya estén invitadas. `avance(enviadas, total)` se llama tras cada invitación. Se detiene en el primer error (por
     * ejemplo, el límite de invitaciones de Google, que además deja la cuenta bloqueada).
     *
     * @return array{enviadas: int, total: int, error: ?string}
     */
    public function generarLigas(Account $account, ?callable $avance = null): array
    {
        $grupo = $this->leer($account);
        $invitados = collect($grupo['invitaciones'])->pluck('email')->map(fn ($e): string => mb_strtolower((string) $e));
        $miembros = collect($grupo['miembros'])->reject(fn (array $m): bool => (bool) ($m['admin'] ?? false))->count();
        $lugares = min(Account::capacity(), $grupo['quedan'] ?? max(0, Account::capacity() - $miembros - $invitados->count()));

        $correos = collect(self::correosParaLigas(Account::capacity() * 2))->reject(fn (string $c): bool => $invitados->contains($c))->take($lugares)->values();
        if ($correos->isEmpty() && $lugares > 0) {
            throw new RuntimeException('No hay correo de ligas configurado en el servidor (ZENBOT_CORREOS_LIGAS).');
        }

        $enviadas = 0;
        $error = null;
        foreach ($correos as $correo) {
            try {
                $this->ejecutar($account, ['invitar', $correo], 80);
            } catch (RuntimeException $e) {
                $error = $e->getMessage();

                break;
            }
            $enviadas++;
            if ($avance) {
                $avance($enviadas, $correos->count());
            }
        }

        // Google aceptó todas: ya no hay límite de invitaciones (si se topó con él, la cuenta queda bloqueada).
        if ($enviadas > 0 && $error === null) {
            $account->desbloquearInvitaciones();
        }

        // Cuenta las ligas que quedaron pendientes en Google.
        try {
            $this->sincronizar($account);
        } catch (RuntimeException) {
            // La siguiente revisión las contará.
        }

        return ['enviadas' => $enviadas, 'total' => $correos->count(), 'error' => $error];
    }

    /**
     * «Sacar a todos los miembros» (cuentas por activar con clientes viejos que no renovaron): Google los quita del grupo
     * uno por uno en el Chrome de la cuenta (se ve en su visor). Tarda 1–3 minutos; el avance lo deja el script en un
     * archivo (progresoSacar). Funciona con la sesión que esté abierta en el visor aunque la cuenta no esté marcada
     * como conectada; si sale bien, queda conectada.
     *
     * @return array{total: int, sacados: list<string>, siguen: list<string>, fallidos: list<array{email: string, error: string}>}
     */
    public function sacarTodos(Account $account): array
    {
        $datos = $this->ejecutar($account, ['sacar-todos'], 900, requiereConexion: false);
        $account->forceFill(['google_conectada' => true])->save();

        return [
            'total' => (int) ($datos['total'] ?? 0),
            'sacados' => array_values((array) ($datos['sacados'] ?? [])),
            'siguen' => array_values((array) ($datos['siguen'] ?? [])),
            'fallidos' => array_values((array) ($datos['fallidos'] ?? [])),
        ];
    }

    /** Archivo donde el script va dejando el avance de «sacar a todos» de una cuenta. */
    public static function archivoProgreso(Account $account): string
    {
        return rtrim((string) config('zengpt.google.perfiles'), '/').'/.progreso-'.preg_replace('/[^a-z0-9@._-]/', '_', mb_strtolower($account->email)).'.json';
    }

    /**
     * Cómo va «sacar a todos» de una cuenta: el estado de la tarea (sacando | listo | error, con su hora de inicio para
     * el contador) más el avance que dejó el script (total, sacados, quién va). null si no se ha pedido.
     *
     * @return array<string, mixed>|null
     */
    public static function estadoSacar(Account $account): ?array
    {
        $estado = Cache::get("sacar-miembros:{$account->id}");
        if (! is_array($estado)) {
            return null;
        }

        $archivo = self::archivoProgreso($account);
        $avance = is_readable($archivo) ? json_decode((string) file_get_contents($archivo), true) : null;
        if (is_array($avance) && ($avance['actualizado'] ?? 0) >= ($estado['inicio'] ?? 0) * 1000) {
            $estado['avance'] = [
                'paso' => $avance['paso'] ?? null,
                'total' => $avance['total'] ?? null,
                'sacados' => count((array) ($avance['sacados'] ?? [])),
                'actual' => $avance['actual'] ?? null,
            ];
        }

        return $estado;
    }

    /** @param  array<string, mixed>  $estado */
    public static function guardarEstadoSacar(Account $account, array $estado): void
    {
        Cache::put("sacar-miembros:{$account->id}", $estado, now()->addMinutes($estado['estado'] === 'sacando' ? 20 : 15));
    }

    /**
     * Cómo va «Generar ligas» de una cuenta (se genera en segundo plano): estado generando | listo | error, cuántas se
     * mandaron y un mensaje. null si no se ha pedido en los últimos minutos.
     *
     * @return array{estado: string, enviadas: int, total: ?int, mensaje: ?string}|null
     */
    public static function estadoLigas(Account $account): ?array
    {
        $estado = Cache::get("ligas-generando:{$account->id}");

        return is_array($estado) ? $estado : null;
    }

    /** @param  array{estado: string, enviadas: int, total: ?int, mensaje: ?string}  $estado */
    public static function guardarEstadoLigas(Account $account, array $estado): void
    {
        // Mientras se genera dura lo que tardaría lo peor (5 invitaciones); el resultado se ve unos minutos.
        Cache::put("ligas-generando:{$account->id}", $estado, now()->addMinutes($estado['estado'] === 'generando' ? 12 : 10));
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
    private function ejecutar(Account $account, array $argumentos, int $segundos, bool $requiereConexion = true, array $entorno = []): array
    {
        if ($requiereConexion && ! self::conectada($account)) {
            throw new RuntimeException('Esta cuenta aún no tiene su sesión de Google en el servidor: conéctala con «Conectar con Google (visor)».');
        }

        $lock = Cache::lock('zenbot-navegador', $segundos + 10);
        try {
            $lock->block((int) config('zengpt.google.espera', 15));
        } catch (LockTimeoutException) {
            throw new RuntimeException('El servidor está ocupado con otra cuenta; intenta en unos segundos.');
        }

        try {
            $resultado = Process::timeout($segundos)
                ->env([
                    'ZENBOT_ADMIN' => mb_strtolower($account->email),
                    // Por si Google pide «verifica que eres tú»: contraseña y clave 2FA de la cuenta (solo en el entorno del proceso).
                    'ZENBOT_PASS' => (string) $account->password,
                    'ZENBOT_TOTP' => self::secreto2fa($account->twofa_url),
                    'ZENBOT_PANTALLAS' => (string) config('zengpt.google.pantallas', 3),
                ] + $entorno)
                ->run([(string) config('zengpt.google.node', 'node'), (string) config('zengpt.google.script'), ...$argumentos]);
        } finally {
            $lock->release();
        }

        $datos = json_decode(trim($resultado->output()), true);
        if (! is_array($datos)) {
            throw new RuntimeException('No se pudo hablar con Google (el lector no respondió).');
        }

        if (! ($datos['ok'] ?? false)) {
            if (filled($datos['detalle'] ?? null)) {
                Log::info("zenbot {$account->email}: {$datos['error']} en {$datos['detalle']}");
            }

            // Cada visor abierto ocupa una pantalla; si están todas en uso, se dice con qué cuentas.
            if (($datos['error'] ?? '') === 'sin_pantalla') {
                throw new VisorOcupado(array_values(array_filter((array) ($datos['ocupadas'] ?? []), 'is_string')));
            }

            // «Has alcanzado el límite de invitaciones al grupo familiar»: se marca el bloqueo (sus espacios libres
            // salen en rojo con la cuenta regresiva) y se avisa hasta cuándo.
            if (($datos['error'] ?? '') === 'limite_invitaciones') {
                $account->bloquearInvitaciones();

                throw new RuntimeException("Google no deja invitar a nadie más por ahora (límite de invitaciones del grupo familiar). La cuenta quedó marcada como bloqueada hasta el {$account->bloqueoHastaTexto()}; si Google la libera antes o después, ajústalo en «Editar cuenta».");
            }

            throw new RuntimeException(code: ($datos['error'] ?? '') === 'no_encontrado' ? self::NO_ENCONTRADO : 0, message: match ($datos['error'] ?? '') {
                'sin_sesion' => 'Google cerró la sesión del servidor: entra con «Abrir visor» en la cuenta.',
                'sin_navegador' => 'El Chrome del servidor no arrancó. Intenta de nuevo en un momento.',
                'otra_cuenta' => 'La sesión del servidor es de otra cuenta: no se hizo nada.',
                'no_encontrado' => 'Ese cliente no está en el grupo de Google (ni con invitación pendiente).',
                'sin_lugar' => 'El grupo de Google ya no tiene lugares para invitar.',
                'no_confirmado' => 'Google no confirmó el cambio. Revisa el grupo y vuelve a intentar.',
                'lectura_incompleta' => 'Google tardó en cargar el grupo. Intenta de nuevo en un momento.',
                'falta_contrasena' => 'Google pidió confirmar la contraseña: guárdala en la cuenta (Editar cuenta) y vuelve a intentar.',
                'falta_2fa' => 'Google pidió el código de 2 pasos: guarda la liga de 2FA en la cuenta y vuelve a intentar.',
                'requiere_persona' => 'Google pidió confirmar que eres una persona (captcha). Quedó abierto: entra con «Abrir visor», resuélvelo y vuelve a intentar.',
                'verificacion_rechazada' => 'Google rechazó la contraseña o el código 2FA guardados en la cuenta. Revísalos; quedó abierto en «Abrir visor».',
                'verificacion_distinta' => 'Google pidió otra forma de verificación (teléfono o app). Quedó abierto: termínalo en «Abrir visor» y vuelve a intentar.',
                'verificacion_atorada' => 'Google no aceptó la verificación automática. Quedó abierto: termínalo en «Abrir visor» y vuelve a intentar.',
                default => 'Google no respondió como se esperaba. Intenta de nuevo en un momento.',
            });
        }

        return $datos;
    }
}
