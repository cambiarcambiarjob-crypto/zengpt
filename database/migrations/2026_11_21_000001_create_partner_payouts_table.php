<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pagos del dueño al socio (Christian, su porcentaje del neto). Igual que con los vendedores: lo que se le debe es su
 * parte acumulada menos lo ya pagado, así que un pago parcial o una venta capturada tarde se arrastran solos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('partner_payouts', function (Blueprint $table) {
            $table->id();
            // Último día que cubre el pago (incluido).
            $table->date('hasta')->unique();
            // Día en que se le transfirió.
            $table->date('paid_on');
            $table->bigInteger('amount_cents');
            $table->string('notes', 255)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('partner_payouts');
    }
};
