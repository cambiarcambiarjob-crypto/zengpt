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

    protected $fillable = ['email', 'password', 'twofa_url', 'started_on', 'expires_on', 'notes', 'created_by'];

    protected function casts(): array
    {
        return ['started_on' => 'date:Y-m-d', 'expires_on' => 'date:Y-m-d', 'password' => 'encrypted'];
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
