<?php

namespace App\Models;

use App\Support\Hoy;
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
        return ['started_on' => 'date:Y-m-d', 'expires_on' => 'date:Y-m-d', 'password' => 'encrypted', 'invite_links' => 'array', 'google_extra' => 'array', 'google_conectada' => 'boolean', 'google_ligas' => 'integer', 'google_synced_at' => 'datetime'];
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
