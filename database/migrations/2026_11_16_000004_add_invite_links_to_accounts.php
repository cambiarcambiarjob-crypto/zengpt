<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Ligas de invitación al grupo familiar de la cuenta: una por espacio (posición 1–5), con su caducidad. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->json('invite_links')->nullable()->after('twofa_url');
        });
    }

    public function down(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->dropColumn('invite_links');
        });
    }
};
