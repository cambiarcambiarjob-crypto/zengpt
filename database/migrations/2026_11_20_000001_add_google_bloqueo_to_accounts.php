<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Hasta cuándo Google no deja invitar a nadie más al grupo familiar de la cuenta («Has alcanzado el límite de
 * invitaciones al grupo familiar»). Mientras no pase, sus espacios libres no se pueden vender.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->timestamp('google_bloqueo_hasta')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->dropColumn('google_bloqueo_hasta');
        });
    }
};
