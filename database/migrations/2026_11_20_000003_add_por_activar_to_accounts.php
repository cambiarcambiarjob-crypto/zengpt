<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cuentas compradas que todavía no se usan: no cuentan como activas (ni en «Con espacio», ni en el panel) hasta que
 * alguien las activa; al activarlas empiezan a correr sus meses de vigencia.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->boolean('por_activar')->default(false)->index();
        });
    }

    public function down(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->dropIndex(['por_activar']);
            $table->dropColumn('por_activar');
        });
    }
};
