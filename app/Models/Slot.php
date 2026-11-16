<?php

namespace App\Models;

use App\Support\Hoy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un espacio es un cliente dentro de una cuenta: su Gmail, teléfono opcional, precio y vendedor.
 * Dura lo que dure la cuenta.
 */
class Slot extends Model
{
    protected $fillable = ['account_id', 'position', 'client_email', 'client_phone', 'price_cents', 'seller_id', 'sold_on', 'created_by', 'invite_url', 'invite_expires_on', 'invite_sent_at', 'invite_accepted_at'];

    protected function casts(): array
    {
        return ['position' => 'integer', 'price_cents' => 'integer', 'sold_on' => 'date:Y-m-d', 'invite_expires_on' => 'date:Y-m-d', 'invite_sent_at' => 'datetime', 'invite_accepted_at' => 'datetime'];
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
