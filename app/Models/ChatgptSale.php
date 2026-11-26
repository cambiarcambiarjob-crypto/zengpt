<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** ChatGPT vendidos en un corte: cuántos y a qué precio cada uno (en centavos). Solo los vende Jorge. */
class ChatgptSale extends Model
{
    protected $fillable = ['sold_on', 'quantity', 'price_cents', 'seller_id', 'created_by'];

    protected function casts(): array
    {
        return ['sold_on' => 'date:Y-m-d', 'quantity' => 'integer', 'price_cents' => 'integer'];
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** Lo que suma este registro: cantidad × precio, en centavos. */
    public function total(): int
    {
        return $this->quantity * $this->price_cents;
    }
}
