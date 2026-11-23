<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cuentas sin Gemini: Gmails que todavía no tienen el plan. Van en su propio apartado, fuera de «Por activar», y no
 * cuentan como activas; cuando ya tienen Gemini pasan a «Por activar». Siempre son también `por_activar`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->boolean('sin_gemini')->default(false)->index();
        });
    }

    public function down(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->dropIndex(['sin_gemini']);
            $table->dropColumn('sin_gemini');
        });
    }
};
