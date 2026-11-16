<?php

namespace Database\Seeders;

use App\Models\Seller;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /** Catálogo inicial de vendedores. Los usuarios se crean con `php artisan zengpt:usuario`. */
    public function run(): void
    {
        foreach ([['Leo', true], ['Jorge', false], ['Iván', false], ['Gera', false]] as $i => [$name, $owner]) {
            Seller::query()->firstOrCreate(['name' => $name], ['is_owner' => $owner, 'active' => true, 'sort' => $i + 1]);
        }
    }
}
