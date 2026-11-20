<?php

namespace App\Models;

use App\Support\Hoy;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Una cuenta es un Gmail con vigencia de 3 meses y 5 espacios para clientes.
 */
class Account extends Model
{
    protected $hidden = ['password'];

    protected $fillable = ['email', 'password', 'twofa_url', 'invite_links', 'started_on', 'expires_on', 'notes', 'created_by'];

    protected function casts(): array
    {
        return ['started_on' => 'date:Y-m-d', 'expires_on' => 'date:Y-m-d', 'password' => 'encrypted', 'invite_links' => 'array', 'google_extra' => 'array', 'google_conectada' => 'boolean', 'google_ligas' => 'integer', 'google_synced_at' => 'datetime', 'google_bloqueo_hasta' => 'datetime'];
    }

    public function setEmailAttribute(string $value): void
    {
        $this->attributes['email'] = mb_strtolower(trim($value));
    }

    public function slots(): HasMany
    {
        return $this->hasMany(Slot::class)->orderBy('position');
    }

    /** Vigente hoy (el día de vencimiento todavía cuenta). */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereDate('expires_on', '>=', Hoy::fecha());
    }

    public function scopeExpired(Builder $query): Builder
    {
        return $query->whereDate('expires_on', '<', Hoy::fecha());
    }

    public function isActive(): bool
    {
        return $this->expires_on->toDateString() >= Hoy::fecha();
    }

    /**
     * «Llena»: vigente, con todos sus espacios ocupados, nadie pendiente de pago y todos dentro del grupo familiar
     * (según la última revisión en Google si la cuenta está conectada; si no, con la invitación aceptada).
     * Estas cuentas se apartan en la pestaña «Llenas» para que no ocupen lugar entre las que aún requieren algo.
     */
    public function estaLlena(bool $conectada): bool
    {
        $slots = $this->slots;

        return $this->isActive()
            && $slots->count() >= self::capacity()
            && $slots->every(fn (Slot $slot): bool => $slot->paid_on !== null
                && ($conectada ? $slot->google_status === 'miembro' : $slot->invite_accepted_at !== null));
    }

    /**
     * Google no deja invitar a nadie más al grupo por ahora («límite de invitaciones»): sus espacios libres no se
     * pueden vender hasta `google_bloqueo_hasta`. Al pasar esa fecha deja de estar bloqueada sola.
     */
    public function invitacionesBloqueadas(): bool
    {
        return $this->google_bloqueo_hasta !== null && $this->google_bloqueo_hasta->isFuture();
    }

    /**
     * Marca el bloqueo de Google. Sin fecha, dura los días de config('zengpt.google.dias_bloqueo') desde ahora; si ya
     * estaba bloqueada, se respeta la fecha que tenía (volver a toparse con el límite no la alarga).
     */
    public function bloquearInvitaciones(?CarbonInterface $hasta = null): void
    {
        if ($hasta === null && $this->invitacionesBloqueadas()) {
            return;
        }

        $hasta ??= now()->addDays((int) config('zengpt.google.dias_bloqueo', 7));

        // La base guarda la hora tal cual: se pasa a la zona de la aplicación (p. ej. de las 0:00 de Chihuahua a UTC).
        $this->forceFill(['google_bloqueo_hasta' => $hasta->copy()->setTimezone(config('app.timezone'))])->save();
    }

    /** «27 de noviembre, 0:30» (hora del negocio) o null si no está bloqueada. */
    public function bloqueoHastaTexto(): ?string
    {
        return $this->invitacionesBloqueadas()
            ? $this->google_bloqueo_hasta->copy()->setTimezone(config('zengpt.zona', 'America/Chihuahua'))->locale('es')->isoFormat('D [de] MMMM, H:mm')
            : null;
    }

    public function desbloquearInvitaciones(): void
    {
        if ($this->google_bloqueo_hasta !== null) {
            $this->forceFill(['google_bloqueo_hasta' => null])->save();
        }
    }

    /** Vigente, con algún espacio libre y sin bloqueo de Google: se le puede acomodar un cliente nuevo hoy. */
    public function tieneEspacioParaVender(): bool
    {
        return $this->isActive() && $this->slots->count() < self::capacity() && ! $this->invitacionesBloqueadas();
    }

    public function daysLeft(): int
    {
        return (int) Hoy::carbon()->diffInDays($this->expires_on->copy()->startOfDay(), false);
    }

    public static function capacity(): int
    {
        return (int) config('zengpt.capacidad', 5);
    }

    /**
     * Liga de invitación del espacio $position, o null si la cuenta no tiene liga para ese espacio.
     *
     * @return array{url: string, expires_on: ?string}|null
     */
    public function inviteLinkFor(int $position): ?array
    {
        $liga = ($this->invite_links ?? [])[(string) $position] ?? null;

        return is_array($liga) && filled($liga['url'] ?? null) ? ['url' => $liga['url'], 'expires_on' => $liga['expires_on'] ?? null] : null;
    }

    /**
     * Lleva las ligas de la cuenta a sus clientes: el cliente de cada espacio toma la liga de ese espacio si es
     * distinta a la que tenía y todavía no aceptó (una liga nueva reinicia «enviada»).
     */
    public function syncInviteLinks(): void
    {
        foreach ($this->slots()->get() as $slot) {
            $liga = $this->inviteLinkFor($slot->position);

            if ($liga === null || $slot->invite_accepted_at !== null) {
                continue;
            }

            if ($liga['url'] !== $slot->invite_url || $liga['expires_on'] !== $slot->invite_expires_on?->toDateString()) {
                $cambiaLiga = $liga['url'] !== $slot->invite_url;
                $slot->fill(['invite_url' => $liga['url'], 'invite_expires_on' => $liga['expires_on']]);
                if ($cambiaLiga) {
                    $slot->invite_sent_at = null;
                }
                $slot->save();
            }
        }
    }

    /** Primera posición libre (1..capacidad) o null si la cuenta está llena. */
    public function firstFreePosition(): ?int
    {
        $taken = $this->slots()->pluck('position')->all();

        for ($p = 1; $p <= self::capacity(); $p++) {
            if (! in_array($p, $taken, true)) {
                return $p;
            }
        }

        return null;
    }
}
