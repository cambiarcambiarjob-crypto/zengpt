<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ChatGPT de Jorge: en el corte de cada día se anota cuántos se vendieron y a qué precio ($450 o personalizado). No
 * hay cuentas ni espacios. El pago fijo de cada día 6 no se guarda aquí: lo calcula App\Services\Chatgpt.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chatgpt_sales', function (Blueprint $table) {
            $table->id();
            $table->date('sold_on')->index();
            $table->unsignedInteger('quantity');
            $table->unsignedInteger('price_cents');
            $table->foreignId('seller_id')->nullable()->constrained('sellers')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chatgpt_sales');
    }
};
