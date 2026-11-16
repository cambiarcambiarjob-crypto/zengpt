<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Clientes que el sistema da de alta solo al encontrarlos en el grupo de Google (origen = 'google'): llegan sin
 * precio ni vendedor y pendientes de pago; se completan después.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('slots', function (Blueprint $table) {
            $table->string('origen', 10)->nullable();
            $table->foreignId('seller_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('slots', function (Blueprint $table) {
            $table->dropColumn('origen');
        });
    }
};
