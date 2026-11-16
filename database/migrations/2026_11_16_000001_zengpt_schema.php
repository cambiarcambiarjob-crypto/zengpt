<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('username', 60)->unique()->after('name');
            // admin = dueño (todo); socio = ve todo y captura, pero no edita la publicidad.
            $table->string('role', 20)->default('socio')->after('username');
        });

        Schema::create('sellers', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60)->unique();
            // El dueño (Leo): sus ventas no se reparten mitad y mitad.
            $table->boolean('is_owner')->default(false);
            $table->boolean('active')->default(true);
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();
        });

        Schema::create('accounts', function (Blueprint $table) {
            $table->id();
            $table->string('email')->unique();
            $table->date('started_on');
            $table->date('expires_on')->index();
            $table->string('notes', 500)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('slots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained('accounts')->cascadeOnDelete();
            $table->unsignedTinyInteger('position');
            $table->string('client_email');
            $table->string('client_phone', 30)->nullable();
            $table->unsignedInteger('price_cents');
            $table->foreignId('seller_id')->constrained('sellers')->restrictOnDelete();
            $table->date('sold_on')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['account_id', 'position']);
        });

        Schema::create('ad_spends', function (Blueprint $table) {
            $table->id();
            $table->date('spent_on');
            $table->foreignId('seller_id')->constrained('sellers')->restrictOnDelete();
            $table->unsignedInteger('amount_cents');
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['spent_on', 'seller_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ad_spends');
        Schema::dropIfExists('slots');
        Schema::dropIfExists('accounts');
        Schema::dropIfExists('sellers');
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['username']);
            $table->dropColumn(['username', 'role']);
        });
    }
};
