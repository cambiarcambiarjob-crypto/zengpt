<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Costo de la cuenta prorrateado por espacio (costo de la cuenta ÷ 5) y cargado al vendedor que lo vendió.
 * Se guarda en cada espacio para que un cambio de precio de las cuentas no altere lo ya vendido.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('slots', function (Blueprint $table) {
            $table->unsignedInteger('cost_cents')->default(0)->after('price_cents');
        });

        DB::table('slots')->update(['cost_cents' => (int) round(((float) config('zengpt.costo_cuenta', 117)) * 100 / max(1, (int) config('zengpt.capacidad', 5)))]);
    }

    public function down(): void
    {
        Schema::table('slots', function (Blueprint $table) {
            $table->dropColumn('cost_cents');
        });
    }
};
