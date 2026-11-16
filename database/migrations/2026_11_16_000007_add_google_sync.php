<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sincronización (solo lectura) con el grupo familiar de Google de cada cuenta:
 * cuándo se revisó, quién está en Google sin estar en el sistema y, por cliente, si Google lo tiene
 * como miembro, invitado o no aparece.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->timestamp('google_synced_at')->nullable();
            $table->json('google_extra')->nullable();
        });

        Schema::table('slots', function (Blueprint $table) {
            $table->string('google_status', 12)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->dropColumn(['google_synced_at', 'google_extra']);
        });

        Schema::table('slots', function (Blueprint $table) {
            $table->dropColumn('google_status');
        });
    }
};
