<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Publicidad gastada por un vendedor en un día (solo la captura el dueño). */
class AdSpend extends Model
{
    protected $fillable = ['spent_on', 'seller_id', 'amount_cents', 'updated_by'];

    protected function casts(): array
    {
        return ['spent_on' => 'date:Y-m-d', 'amount_cents' => 'integer'];
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(Seller::class);
    }
}
