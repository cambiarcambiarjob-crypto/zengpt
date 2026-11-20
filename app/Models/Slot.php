<?php

namespace App\Models;

use App\Support\Hoy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un espacio es un cliente dentro de una cuenta: su Gmail, teléfono opcional, precio y vendedor.
 * Dura lo que dure la cuenta.
 */
class Slot extends Model
{
    protected $fillable = ['account_id', 'position', 'client_email', 'client_phone', 'price_cents', 'cost_cents', 'seller_id', 'sold_on', 'paid_on', 'created_by', 'invite_url', 'invite_expires_on', 'invite_sent_at', 'invite_accepted_at', 'origen'];

    protected function casts(): array
    {
        return ['position' => 'integer', 'price_cents' => 'integer', 'cost_cents' => 'integer', 'sold_on' => 'date:Y-m-d', 'paid_on' => 'date:Y-m-d', 'invite_expires_on' => 'date:Y-m-d', 'invite_sent_at' => 'datetime', 'invite_accepted_at' => 'datetime'];
    }

    /** Si nadie dijo lo contrario, el cliente pagó el día de su venta (los pendientes llegan con paid_on = null). */
    protected static function booted(): void
    {
        static::creating(function (Slot $slot): void {
            if (! array_key_exists('paid_on', $slot->getAttributes())) {
                $slot->paid_on = $slot->sold_on;
            }
            if (! array_key_exists('cost_cents', $slot->getAttributes())) {
                $slot->cost_cents = self::costoEspacio();
            }
        });
    }

    /** Parte del costo de la cuenta que le toca a un espacio, en centavos ($117 ÷ 5 = $23.40). */
    public static function costoEspacio(): int
    {
        return (int) round(((float) config('zengpt.costo_cuenta', 117)) * 100 / max(1, (int) config('zengpt.capacidad', 5)));
    }

    public function isPaid(): bool
    {
        return $this->paid_on !== null;
    }

    /**
     * Debe dinero: no ha pagado y tiene precio. Un cliente «Sin precio» (llegó solo desde el grupo de Google y nadie le
     * ha puesto precio) no tiene nada que cobrar; si después se le pone precio y no ha pagado, ya cuenta.
     */
    public function porCobrar(): bool
    {
        return $this->paid_on === null && $this->price_cents > 0;
    }

    /** Lo mismo que porCobrar(), en consulta. */
    public function scopePorCobrar(Builder $query): Builder
    {
        return $query->whereNull('paid_on')->where('price_cents', '>', 0);
    }

    public function setClientEmailAttribute(string $value): void
    {
        $this->attributes['client_email'] = mb_strtolower(trim($value));
    }

    /** sin_liga | lista | enviada | aceptada | caducada (la liga venció sin que el cliente aceptara). */
    public function inviteStatus(): string
    {
        if ($this->invite_accepted_at !== null) {
            return 'aceptada';
        }

        if ($this->invite_url === null) {
            return 'sin_liga';
        }

        if ($this->invite_expires_on !== null && $this->invite_expires_on->toDateString() < Hoy::fecha()) {
            return 'caducada';
        }

        return $this->invite_sent_at !== null ? 'enviada' : 'lista';
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }
}
