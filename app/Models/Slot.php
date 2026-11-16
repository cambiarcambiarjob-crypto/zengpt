<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un espacio es un cliente dentro de una cuenta: su Gmail, teléfono opcional, precio y vendedor.
 * Dura lo que dure la cuenta.
 */
class Slot extends Model
{
    protected $fillable = ['account_id', 'position', 'client_email', 'client_phone', 'price_cents', 'seller_id', 'sold_on', 'created_by'];

    protected function casts(): array
    {
        return ['position' => 'integer', 'price_cents' => 'integer', 'sold_on' => 'date:Y-m-d'];
    }

    public function setClientEmailAttribute(string $value): void
    {
        $this->attributes['client_email'] = mb_strtolower(trim($value));
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
