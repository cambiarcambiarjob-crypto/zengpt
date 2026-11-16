<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Contraseña (cifrada) y liga de verificación en dos pasos de cada cuenta, para entregarlas al cliente. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->text('password')->nullable()->after('email');
            $table->string('twofa_url', 500)->nullable()->after('password');
        });
    }

    public function down(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->dropColumn(['password', 'twofa_url']);
        });
    }
};
