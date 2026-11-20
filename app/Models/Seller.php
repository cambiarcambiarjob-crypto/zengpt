<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Seller extends Model
{
    protected $fillable = ['name', 'is_owner', 'active', 'sort'];

    protected function casts(): array
    {
        return ['is_owner' => 'boolean', 'active' => 'boolean', 'sort' => 'integer'];
    }

    public function slots(): HasMany
    {
        return $this->hasMany(Slot::class);
    }

    /** Pagos que el dueño le ha hecho (su parte de las ventas). */
    public function payouts(): HasMany
    {
        return $this->hasMany(SellerPayout::class)->orderBy('hasta');
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('sort')->orderBy('id');
    }
}
