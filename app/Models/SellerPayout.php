<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Un pago del dueño a un vendedor: cubre su parte hasta `hasta` (incluido) y se le transfirió el `paid_on`. */
class SellerPayout extends Model
{
    protected $fillable = ['seller_id', 'hasta', 'paid_on', 'amount_cents', 'notes', 'created_by'];

    protected function casts(): array
    {
        return ['hasta' => 'date:Y-m-d', 'paid_on' => 'date:Y-m-d', 'amount_cents' => 'integer'];
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }

    public function autor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
