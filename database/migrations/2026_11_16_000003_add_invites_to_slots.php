<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Invitación al grupo familiar de Google, una liga por cliente: la liga, su caducidad y si se envió o se aceptó. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('slots', function (Blueprint $table) {
            $table->string('invite_url', 500)->nullable()->after('sold_on');
            $table->date('invite_expires_on')->nullable()->after('invite_url');
            $table->dateTime('invite_sent_at')->nullable()->after('invite_expires_on');
            $table->dateTime('invite_accepted_at')->nullable()->after('invite_sent_at');
        });
    }

    public function down(): void
    {
        Schema::table('slots', function (Blueprint $table) {
            $table->dropColumn(['invite_url', 'invite_expires_on', 'invite_sent_at', 'invite_accepted_at']);
        });
    }
};
